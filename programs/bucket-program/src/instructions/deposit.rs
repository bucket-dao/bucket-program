use {
    anchor_lang::prelude::*,
    anchor_spl::token::transfer,
    crate_token::cpi::issue,
    crate::{
        context::Deposit,
        error::ErrorCode,
    },
};

pub fn handle(
    ctx: Context<Deposit>,
    deposit_amount: u64,
) -> ProgramResult {
    require!(
        ctx.accounts
            .common
            .bucket
            .whitelist
            .contains(&ctx.accounts.depositor_collateral.mint.key()),
        ErrorCode::WrongCollateralError
    );

    transfer(
        ctx.accounts
            .into_transfer_token_context(),
        deposit_amount,
    )?;

    let issue_authority_signer_seeds: &[&[&[u8]]] =
        &[&[b"issue", &[ctx.accounts.issue_authority.bump]]];

    issue(
        ctx.accounts
            .into_issue_reserve_context()
            .with_signer(issue_authority_signer_seeds),
        // 1-1 conversion for now, devs pls do something
        deposit_amount,
    )?;

    Ok(())
}
