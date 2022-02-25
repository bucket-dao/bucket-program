use {
    anchor_lang::prelude::*,
    crate::context::AuthorizeCollateral,
};

pub fn handle(
    ctx: Context<AuthorizeCollateral>,
    mint: Pubkey,
) -> ProgramResult {
    ctx.accounts
        .bucket
        .authorize_collateral(mint)?;

    Ok(())
}
