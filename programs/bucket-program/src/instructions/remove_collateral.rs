use {crate::context::AuthorizedUpdate, anchor_lang::prelude::*};

pub fn handle(ctx: Context<AuthorizedUpdate>, mint: Pubkey) -> ProgramResult {
    ctx.accounts.bucket.remove_collateral(mint)?;

    Ok(())
}
