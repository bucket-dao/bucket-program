use {crate::context::Withdraw, crate::error::ErrorCode, anchor_lang::prelude::*};

pub fn handle(ctx: Context<Withdraw>, withdraw_amount: u64) -> ProgramResult {
    let bm = &ctx.accounts.bucket.crate_mint;
    require!(
        bm != &ctx.accounts.withdrawer_source.mint.key(),
        ErrorCode::WrongBurnError
    );

    // Burn the $BUCKET.
    anchor_spl::token::burn(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            anchor_spl::token::Burn {
                mint: ctx.accounts.crate_mint.to_account_info(),
                to: ctx.accounts.withdrawer_source.to_account_info(),
                authority: ctx.accounts.withdrawer.to_account_info(),
            },
        ),
        withdraw_amount,
    )?;

    let withdraw_authority_signer_seeds: &[&[&[u8]]] =
        &[&[b"withdraw", &[ctx.accounts.withdraw_authority.bump]]];

    // Withdraw the collateral tokens from the pool.
    crate_token::cpi::withdraw(
        CpiContext::new_with_signer(
            ctx.accounts.crate_token_program.to_account_info(),
            crate_token::cpi::accounts::Withdraw {
                crate_token: ctx.accounts.crate_token.to_account_info(),
                crate_underlying: ctx.accounts.collateral_reserve.to_account_info(),
                withdraw_authority: ctx.accounts.withdraw_authority.to_account_info(),
                withdraw_destination: ctx.accounts.withdraw_destination.to_account_info(),
                author_fee_destination: ctx.accounts.withdraw_destination.to_account_info(),
                protocol_fee_destination: ctx.accounts.withdraw_destination.to_account_info(),
                token_program: ctx.accounts.token_program.to_account_info(),
            },
            withdraw_authority_signer_seeds,
        ),
        // this should be different from the burn amount
        withdraw_amount,
    )?;

    Ok(())
}
