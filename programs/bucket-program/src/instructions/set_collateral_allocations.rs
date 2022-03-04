use {
    crate::{context::AuthorizedUpdate, state::bucket::Collateral},
    anchor_lang::prelude::*,
};

pub fn handle(ctx: Context<AuthorizedUpdate>, allocations: Vec<Collateral>) -> ProgramResult {
    ctx.accounts
        .bucket
        .set_collateral_allocations(&allocations)?;

    Ok(())
}
