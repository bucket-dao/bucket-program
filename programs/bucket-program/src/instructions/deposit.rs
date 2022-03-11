use {
    crate::{
        constant::TARGET_ORACLE_PRECISION,
        context::Deposit,
        error::ErrorCode,
        state::oracle::{get_oracle_price, OraclePriceData},
        util::is_collateral_authorized,
    },
    anchor_lang::prelude::*,
    anchor_spl::token::transfer,
    crate_token::cpi::issue,
    std::convert::TryInto,
    vipers::invariant,
};

pub fn handle(ctx: Context<Deposit>, deposit_amount: u64) -> ProgramResult {
    invariant!(
        is_collateral_authorized(
            &ctx.accounts.common.bucket.collateral,
            ctx.accounts.depositor_collateral.mint.key()
        ),
        ErrorCode::WrongCollateralError
    );

    let clock = Clock::get()?;
    transfer(ctx.accounts.into_transfer_token_context(), deposit_amount)?;

    // todo: verify oracle address. couple possible approaches. easiest could be a PDA-per-mint
    // with the pyth and switchboard oracle price feed addresses. regardless of approach, this
    // is a major attack vector we need to account for. also in redeem.
    let oracle_price_data: OraclePriceData =
        get_oracle_price(&ctx.accounts.oracle, clock.slot, TARGET_ORACLE_PRECISION)?;

    let price_per_coin = oracle_price_data.price;
    let price_per_bucket_usd = 1;
    let deposit_sum = (deposit_amount as i128)
        .checked_mul(price_per_coin)
        .unwrap();
    let issue_amount = deposit_sum
        .checked_div(price_per_bucket_usd)
        .unwrap()
        .checked_div(10_i128.pow(TARGET_ORACLE_PRECISION))
        .unwrap();
    issue(
        ctx.accounts
            .into_issue_reserve_context()
            .with_signer(&[&[b"issue", &[ctx.accounts.issue_authority.bump]]]),
        issue_amount.try_into().unwrap(),
    )?;

    Ok(())
}
