use {
    crate::{
        context::Deposit,
        util::{
            is_collateral_authorized,
        },
        error::ErrorCode,
        instructions::pyth_client::get_oracle_price,
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

    transfer(ctx.accounts.into_transfer_token_context(), deposit_amount)?;
    let precision = 6;
    let price_per_usdc = get_oracle_price(&ctx.accounts.oracle, precision);
    let price_per_bucket_usd = 1;
    let deposit_sum = (deposit_amount as u64).checked_mul(price_per_usdc).unwrap();
    let issue_amount = deposit_sum
        .checked_div(price_per_bucket_usd as u64)
        .unwrap()
        .checked_div(10_u64.pow(precision))
        .unwrap();

    issue(
        ctx.accounts
            .into_issue_reserve_context()
            .with_signer(&[&[b"issue", &[ctx.accounts.issue_authority.bump]]]),
issue_amount.try_into().unwrap(),
    )?;

    Ok(())
}
