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
    },
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

    let scaled_deposit_amount: u64 = scale_mint_decimals(
        deposit_amount,
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
