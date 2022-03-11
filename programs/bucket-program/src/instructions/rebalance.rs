use {
    crate::{
        constant::{BUCKET_SEED, WITHDRAW_SEED},
        context::{Rebalance, RebalanceAsset},
        util::is_collateral_authorized,
        error::ErrorCode
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
    // verify both 
    let accounts_per_rebalance_operation: usize = 4;

    // remaining accounts are ATAs to assist in the collateral fanout distribution
    let num_remaining_accounts: usize = ctx.remaining_accounts.len();
    invariant!(
        num_remaining_accounts % accounts_per_rebalance_operation == 0,
        "invalid number token accounts"
    );

    // prematurely return if there are no rebalance operations to perform
    if num_remaining_accounts == 0 {
        return Ok(());
    }

    let remaining_accounts_iter = &mut ctx.remaining_accounts.iter();
    let rebalance_asset: RebalanceAsset = Accounts::try_accounts(
        &crate::ID,
        &mut next_account_infos(remaining_accounts_iter, accounts_per_rebalance_operation)?,
        &[],
    )?;

    // for now, verify that we are only attempting 1 rebalance operation.
    invariant!(
        unwrap_int!(num_remaining_accounts.checked_div(accounts_per_rebalance_operation)) == 1,
        "too many token accounts, expected accounts for 1 rebalance operation"
    );

    // verify both source and destination ATAs contain mints that are whitelisted. otherwise, the authority
    // could pass in arbitrary token accounts. there's no need to check the corresponding bucket ATAs because
    // we perform transfers fromm crate ATAs to bucket ATAs. so, if the bucket ATAs are for a different token
    // mint, the corresponding operations will fail.
    invariant!(
        is_collateral_authorized(&ctx.accounts.bucket.collateral, rebalance_asset.crate_source_ata.mint)
            && is_collateral_authorized(&ctx.accounts.bucket.collateral, rebalance_asset.crate_dest_ata.mint),
        ErrorCode::CollateralDoesNotExistError
    );

    withdraw(
        ctx.accounts
            .into_withdraw_collateral_context(&rebalance_asset)
            .with_signer(&[&[
                WITHDRAW_SEED.as_bytes(),
                &[ctx.accounts.withdraw_authority.bump],
            ]]),
        amount_in,
    )?;

    let bucket_signer_seeds: &[&[&[u8]]] = &[&[
        BUCKET_SEED.as_bytes(),
        ctx.accounts.crate_token.key.as_ref(),
        &[ctx.accounts.bucket.bump],
    ]];

    // this instruction blindly accepts the minimum_amount_out as specified by the
    // caller. however, we might want a mechanism to prevent a high amount of slippage since
    // too much slippage could really impact sum value of collateral assets.
    stable_swap_anchor::swap(
        ctx.accounts
            .into_saber_swap_context(&rebalance_asset)
            .with_signer(bucket_signer_seeds),
        amount_in,
        minimum_amount_out,
    )?;

    // after swap, transfer the minimum_amount_out tokens. this should be safe to do so since
    // garunteed the minimum number of tokens specified. otherwise, we could use the `amount`
    // on the account struct. however, we would first need to reload the account context.
    transfer(
        ctx.accounts
            .into_transfer_token_context(&rebalance_asset)
            .with_signer(bucket_signer_seeds),
        minimum_amount_out,
    )?;

    Ok(())
}
