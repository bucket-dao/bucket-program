use {crate::context::AuthorizedUpdate, anchor_lang::prelude::*};

pub fn handle(ctx: Context<AuthorizedUpdate>, mint: Pubkey, allocation: u16) -> ProgramResult {
    ctx.accounts.bucket.add_collateral(mint, allocation)?;

    Ok(())
}
