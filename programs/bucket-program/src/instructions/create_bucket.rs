use {
    anchor_lang::prelude::*,
    crate::context::CreateBucket
};

pub fn handle(ctx: Context<CreateBucket>, bucket_bump: u8, crate_bump: u8) -> ProgramResult {
    crate_token::cpi::new_crate(
        CpiContext::new(
            ctx.accounts.crate_token_program.to_account_info(),
            crate_token::cpi::accounts::NewCrate {
                crate_mint: ctx.accounts.bucket_mint.to_account_info(),
                crate_token: ctx.accounts.bucket_token_account.to_account_info(),
                fee_to_setter: ctx.accounts.bucket.to_account_info(),
                fee_setter_authority: ctx.accounts.bucket.to_account_info(),
                author_fee_to: ctx.accounts.bucket.to_account_info(),
                issue_authority: ctx.accounts.issue_authority.to_account_info(),
                withdraw_authority: ctx.accounts.withdraw_authority.to_account_info(),
                payer: ctx.accounts.payer.to_account_info(),
                system_program: ctx.accounts.system_program.to_account_info(),
            },
        ),
        crate_bump,
    )?;

    ctx.accounts.bucket.init(
        bucket_bump,
        ctx.accounts.bucket_mint.key(),
        ctx.accounts.bucket_token_account.key(),
        ctx.accounts.payer.key()
    );

    Ok(())
}
