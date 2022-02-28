use {
    anchor_lang::prelude::*,
    crate::context::AuthorizedUpdate
};

pub fn handle(
    ctx: Context<AuthorizedUpdate>,
    mint: Pubkey,
    allocation: u16
) -> ProgramResult {
    ctx.accounts
        .bucket
        .add_collateral(mint, allocation)?;

    Ok(())
}
