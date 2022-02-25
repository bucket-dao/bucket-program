use {
    anchor_lang::prelude::*,
    crate_token::cpi::new_crate,
    crate::context::CreateBucket,
};

pub fn handle(
    ctx: Context<CreateBucket>,
    bucket_bump: u8,
    crate_bump: u8,
    issue_authority_bump: u8,
    withdraw_authority_bump: u8,
) -> ProgramResult {
    new_crate(
        ctx.accounts
            .into_new_crate_context(),
        crate_bump,
    )?;

    ctx.accounts.issue_authority.init(issue_authority_bump);
    ctx.accounts.withdraw_authority.init(withdraw_authority_bump);

    ctx.accounts.bucket.init(
        bucket_bump,
        ctx.accounts.crate_mint.key(),
        ctx.accounts.crate_token.key(),
        ctx.accounts.payer.key()
    );

    Ok(())
}
