use {
    crate::{
        constant::{TARGET_ORACLE_PRECISION, WITHDRAW_SEED},
        context::{Redeem, RedeemAsset},
        error::ErrorCode,
        //instructions::pyth_client::*,
        math_error,
        state::oracle::{get_oracle_price, OraclePriceData},
    },
    anchor_lang::{prelude::*, solana_program::account_info::next_account_infos},
    anchor_spl::token::burn,
    crate_token::cpi::withdraw,
    num_traits::cast::ToPrimitive,
    std::cmp,
    vipers::{invariant, unwrap_int},
};

pub fn handle<'info>(
    ctx: Context<'_, '_, '_, 'info, Redeem<'info>>,
    redeem_amount: u64,
) -> ProgramResult {
    require!(
        ctx.accounts.common.bucket.crate_mint.key() == ctx.accounts.withdrawer_reserve.mint.key(),
        ErrorCode::WrongBurnError
    );

    burn(
        ctx.accounts.into_burn_reserve_token_context(),
        redeem_amount,
    )?;

    // remaining accounts are ATAs to assist in the collateral fanout distribution
    let num_remaining_accounts = ctx.remaining_accounts.len();

    invariant!(
        num_remaining_accounts % 5 == 0,
        "must have even number of tokens"
    );

    // prematurely return if there is no collateral to distribute
    if num_remaining_accounts == 0 {
        return Ok(());
    }
    let remaining_accounts_iter = &mut ctx.remaining_accounts.iter();
    let num_tokens = unwrap_int!(num_remaining_accounts.checked_div(5));
    let mut total_collateral_sum: i128 = 0;
    for _i in 0..num_tokens {
        let asset: RedeemAsset = Accounts::try_accounts(
            &crate::ID,
            &mut next_account_infos(remaining_accounts_iter, 5)?,
            &[],
        )?;

        let clock = Clock::get()?;

        // todo: verify oracle address. couple possible approaches. easiest could be a PDA-per-mint
        // with the pyth and switchboard oracle price feed addresses. regardless of approach, this
        // is a major attack vector we need to account for. also in deposit.
        let oracle_price_data: OraclePriceData =
            get_oracle_price(&ctx.accounts.oracle, clock.slot, TARGET_ORACLE_PRECISION)?;

        let price_per_coin = oracle_price_data
            .price
            .checked_mul(10i128.pow(asset.collateral_mint.decimals as u32))
            .unwrap();

        let collateral_sum = (asset.crate_collateral.amount as i128)
            .checked_mul(price_per_coin)
            .ok_or_else(math_error!())?
            .checked_div(10_i128.pow(asset.collateral_mint.decimals as u32))
            .ok_or_else(math_error!())?;
        total_collateral_sum = total_collateral_sum.checked_add(collateral_sum).unwrap()
    }

    // factor used to calculate actual price; add extra 2 digit buffer for decimal precision
    let precision_factor: i128 = 10_i128.pow(TARGET_ORACLE_PRECISION + 2);

    let total_collateral_sum = total_collateral_sum.checked_mul(precision_factor).unwrap();
    let bucket_supply = &ctx.accounts.common.crate_mint.supply;

    let price_per_bucket = (total_collateral_sum as i128)
        .checked_div(*bucket_supply as i128)
        .unwrap();

    // cap at 1-1 ratio for now
    let redeemable_amount = (redeem_amount as i128)
        .checked_mul(cmp::min(precision_factor, price_per_bucket as i128))
        .ok_or_else(math_error!())?
        .checked_div(precision_factor)
        .ok_or_else(math_error!())?;
    let remaining_accounts_iter = &mut ctx.remaining_accounts.iter();

    let withdraw_authority_signer_seeds: &[&[&[u8]]] = &[&[
        WITHDRAW_SEED.as_bytes(),
        &[ctx.accounts.withdraw_authority.bump],
    ]];

    let num_tokens = unwrap_int!(num_remaining_accounts.checked_div(5));
    for _i in 0..num_tokens {
        // none of these accounts need to be validated further, since
        // [crate_token::cpi::withdraw] already handles it.
        let asset: RedeemAsset = Accounts::try_accounts(
            &crate::ID,
            &mut next_account_infos(remaining_accounts_iter, 5)?,
            &[],
        )?;

        // compute an equal share of each collateral based on each's supply. over time,
        // this piece of logic will become increasingly complex to account for select
        // token fanouts and varying prices of the collateral.
        let share: u64 = unwrap_int!((asset.crate_collateral.amount as i128)
            .checked_mul(redeemable_amount as i128)
            .and_then(|num| num.checked_div(ctx.accounts.common.crate_mint.supply.into()))
            .and_then(|num| num.to_u64()));

        withdraw(
            ctx.accounts
                .into_withdraw_collateral_context(asset)
                .with_signer(withdraw_authority_signer_seeds),
            share,
        )?;
    }

    Ok(())
}
