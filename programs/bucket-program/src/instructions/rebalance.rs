use {
    crate::{
        constant::{BUCKET_SEED, MAX_BASIS_POINTS, WITHDRAW_SEED},
        context::{Rebalance, RebalanceAsset},
        error::ErrorCode,
        math_error,
        state::bucket::Collateral,
        util::{is_collateral_authorized, scale_amount_for_decimals},
    },
    anchor_lang::{prelude::*, solana_program::account_info::next_account_infos},
    anchor_spl::token::transfer,
    crate_token::cpi::withdraw,
    vipers::{invariant, unwrap_int},
};

pub fn handle<'info>(
    ctx: Context<'_, '_, '_, 'info, Rebalance<'info>>,
    amount_in: u64,
    minimum_amount_out: u64,
) -> ProgramResult {
    let rebalance_assets: Vec<RebalanceAsset> =
        rebalance_asset_from_account_infos(ctx.remaining_accounts)?;

    // prematurely return if there are no rebalance operations to perform
    if rebalance_assets.len() == 0 {
        return Ok(());
    }

    // for now due to compute units, verify that we are only attempting 1 rebalance operation.
    invariant!(
        rebalance_assets.len() == 1,
        "too many token accounts, expected accounts for 1 rebalance operation"
    );

    let rebalance_asset = &rebalance_assets[0];

    let caller_is_rebalance_authority =
        ctx.accounts.payer.key() == ctx.accounts.bucket.rebalance_authority.key();
    verify_collateral_for_caller(
        caller_is_rebalance_authority,
        &rebalance_asset,
        &ctx.accounts.bucket.collateral,
    )?;

    let swap_amounts = get_swap_amounts_for_caller(
        caller_is_rebalance_authority,
        &rebalance_asset,
        amount_in,
        minimum_amount_out,
    )?;

    let bucket = ctx.accounts.bucket.key();
    let withdraw_authority_signer_seeds: &[&[&[u8]]] = &[&[
        WITHDRAW_SEED.as_bytes(),
        bucket.as_ref(),
        &[ctx.accounts.withdraw_authority.bump],
    ]];
    withdraw(
        ctx.accounts
            .into_withdraw_collateral_context(&rebalance_asset)
            .with_signer(withdraw_authority_signer_seeds),
        swap_amounts.amount_in,
    )?;

    let bucket_signer_seeds: &[&[&[u8]]] = &[&[
        BUCKET_SEED.as_bytes(),
        ctx.accounts.crate_token.key.as_ref(),
        &[ctx.accounts.bucket.bump],
    ]];

    // (todo): verify tokens have same decimals since the Saber stable swap invariant formula
    // does not adjust for the number of decimal places that the underlying token has. more details:
    // https://docs.saber.so/docs/developing/decimal-wrappers. further, saber provides additional
    // contracts for interacting with saber: https://github.com/saber-hq/saber-periphery.
    stable_swap_anchor::swap(
        ctx.accounts
            .into_saber_swap_context(&rebalance_asset)
            .with_signer(bucket_signer_seeds),
        swap_amounts.amount_in,
        swap_amounts.amount_out,
    )?;

    // after swap, transfer the minimum_amount_out tokens. this should be safe to do so since
    // garunteed the minimum number of tokens specified. otherwise, we could use the `amount`
    // on the account struct. however, we would first need to reload the account context.
    transfer(
        ctx.accounts
            .into_transfer_token_context(&rebalance_asset)
            .with_signer(bucket_signer_seeds),
        swap_amounts.amount_out,
    )?;

    Ok(())
}

/// parse remaining accounts array into RebalanceAsset structs and add to a vec
fn rebalance_asset_from_account_infos<'a, 'info>(
    remaining_accounts: &'a [AccountInfo<'info>],
) -> Result<Vec<RebalanceAsset<'info>>, ProgramError> {
    let mut rebalance_assets: Vec<RebalanceAsset> = Vec::new();
    let accounts_per_rebalance_operation: usize = 6;

    // remaining accounts are ATAs to assist in the collateral fanout distribution
    let num_remaining_accounts: usize = remaining_accounts.len();
    invariant!(
        num_remaining_accounts % accounts_per_rebalance_operation == 0,
        "invalid number token accounts"
    );

    let remaining_accounts_iter = &mut remaining_accounts.iter();
    let num_assets =
        unwrap_int!(num_remaining_accounts.checked_div(accounts_per_rebalance_operation));
    for _i in 0..num_assets {
        let rebalance_asset: RebalanceAsset = Accounts::try_accounts(
            &crate::ID,
            &mut next_account_infos(remaining_accounts_iter, accounts_per_rebalance_operation)?,
            &[],
        )?;

        rebalance_assets.push(rebalance_asset);
    }

    Ok(rebalance_assets)
}

/// the source and destination token requirements are different depending on what
/// entity invokes the rebalance function.
///
/// - if the caller **is not** the authority, the source mint should not be authorized.
///   the destination must be authorized to prevent the user from swapping to an arbitrary mint.
/// - if the caller **is** the authority, the source mint can be authorized but doesn't have to be.
///   similar to above, the destination must be authorized.
fn verify_collateral_for_caller<'info>(
    caller_is_rebalance_authority: bool,
    rebalance_asset: &RebalanceAsset<'info>,
    collateral: &Vec<Collateral>,
) -> ProgramResult {
    msg!(
        "rebalance authority invoked instruction: {}",
        caller_is_rebalance_authority
    );

    // there is no need to check the corresponding bucket ATAs because we perform transfers from crate
    // ATAs to bucket ATAs. so, if the bucket ATAs are for a different token  mint, the  operations
    // will fail. there is also no need to check the ATA's mint vs the token's mint account because we use
    // an anchor constraint to validate this.
    let source_mint_authorized =
        is_collateral_authorized(collateral, rebalance_asset.crate_source_ata.mint);
    let dest_mint_authorized =
        is_collateral_authorized(collateral, rebalance_asset.crate_dest_ata.mint);

    let mut authorized_invariant_condition: bool = !source_mint_authorized && dest_mint_authorized;
    if caller_is_rebalance_authority {
        authorized_invariant_condition |= source_mint_authorized && dest_mint_authorized;
    }

    invariant!(
        authorized_invariant_condition,
        ErrorCode::CallerCannotRebalanceCollateral
    );

    Ok(())
}

fn get_swap_amounts_for_caller<'info>(
    caller_is_rebalance_authority: bool,
    rebalance_asset: &RebalanceAsset<'info>,
    requested_amount_in: u64,
    requested_amount_out: u64,
) -> Result<ExchangeAmount, ProgramError> {
    if caller_is_rebalance_authority {
        // blindly accept amounts in/out from authority
        Ok(ExchangeAmount {
            amount_in: requested_amount_in,
            amount_out: requested_amount_out,
        })
    } else {
        // (todo): store in config somewhere else? or accept dynamic percentage,
        // while making sure that max slippage stays under some predefined threshold?
        // this sttic value may lead to routine failed swaps depending on the pool &
        // per-asset liquidity depth. revisit later.
        let max_slippage_bps: u64 = 150; // 1.5%

        // we must scale token B's expected amount out based on token A's decimals.
        // otherwise, the difference in number of tokens received could be orders
        // of magnitude difference.
        //
        // e.g. consider aa token A with 9 decimals and token B
        // with 6 decimals. if a user tries to swap 1000 token A without scaling,
        // they woudld get 1 token B.
        //
        // as a further note, swapping tokens with different decimals can have
        // unintended consequences. see saber docs for more details:
        // https://docs.saber.so/docs/developing/decimal-wrappers
        let scaled_amount = scale_amount_for_decimals(
            rebalance_asset.crate_source_ata.amount,
            rebalance_asset.token_a.decimals,
            rebalance_asset.token_b.decimals,
        )
        .unwrap(); // change to unwrap_or to avoid panics?

        Ok(compute_exchange_amounts(
            scaled_amount,
            rebalance_asset.token_b.decimals,
            max_slippage_bps,
        )?)
    }
}

/// compute an expected amount out given an input amount, token decimals,
/// and max slippage in basis points. we need this value so that we can pass
/// it into saber. saber does not accept max slippage in bps/percent.
fn compute_exchange_amounts<'info>(
    amount: u64,
    decimals: u8,
    max_slippage_bps: u64,
) -> Result<ExchangeAmount, ProgramError> {
    let additional_precision_factor = 2;

    let slippage_factor = (MAX_BASIS_POINTS as u64)
        .checked_sub(max_slippage_bps)
        .ok_or_else(math_error!())?
        .checked_mul(
            10_u64
                .checked_pow(additional_precision_factor)
                .ok_or_else(math_error!())?,
        )
        .ok_or_else(math_error!())?;

    let amount_out = amount
        .checked_mul(slippage_factor)
        .ok_or_else(math_error!())?
        .checked_div(decimals as u64)
        .ok_or_else(math_error!())?;

    Ok(ExchangeAmount {
        amount_in: amount,
        amount_out,
    })
}

struct ExchangeAmount {
    amount_in: u64,
    amount_out: u64,
}
