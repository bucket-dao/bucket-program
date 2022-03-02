use {
    crate::{context::AuthorizedUpdate, state::bucket::Collateral},
    anchor_lang::prelude::*,
};

// use this ix to absolutely set per-mint allocations. can also use to de-authorize a mint
pub fn handle(ctx: Context<AuthorizedUpdate>, allocations: Vec<Collateral>) -> ProgramResult {
    ctx.accounts
        .bucket
        .set_collateral_allocations(&allocations)?;

    Ok(())
}
