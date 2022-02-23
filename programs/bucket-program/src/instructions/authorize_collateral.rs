use {crate::context::AuthorizeCollateral, anchor_lang::prelude::*};

pub fn handle(ctx: Context<AuthorizeCollateral>, mint: Pubkey) -> ProgramResult {
    ctx.accounts.bucket.authorize_collateral(mint);

    Ok(())
}
