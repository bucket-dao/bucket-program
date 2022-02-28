use {
    anchor_lang::prelude::*,
    anchor_spl::token::transfer,
    crate_token::cpi::issue,
    vipers::invariant,
    crate::{
        context::Deposit,
        util::{
            is_collateral_authorized,
            scale_mint_decimals
        },
        error::ErrorCode,
        instructions::pyth_client::get_oracle_price
    },
    std::convert::TryInto,
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

    let price_per_usdc = get_oracle_price(&ctx.accounts.oracle, 6);
    let price_per_bucket_usd = 1;
    let deposit_sum = (deposit_amount as i128)
        .checked_mul(price_per_usdc)
        .unwrap();
    let issue_amount = deposit_sum
        .checked_div(price_per_bucket_usd as i128)
        .unwrap()
        .checked_div(1_000_000)
        .unwrap();

    let scaled_deposit_amount: u64 = scale_mint_decimals(
        issue_amount.try_into().unwrap(),
        ctx.accounts.collateral_mint.decimals,
        ctx.accounts.common.crate_mint.decimals
    ).unwrap();

    issue(
        ctx.accounts
            .into_issue_reserve_context()
            .with_signer(
                &[&[b"issue", &[ctx.accounts.issue_authority.bump]]]
            ),
        // 1-1 conversion for now, devs pls do something
        scaled_deposit_amount,
    )?;

    Ok(())
}
