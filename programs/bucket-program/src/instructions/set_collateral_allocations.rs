use {
    anchor_lang::prelude::*,
    vipers::invariant,
    crate::{
        context::AuthorizedUpdate,
        state::bucket::Collateral,
        util::sum_allocations,
        constant::MAX_BASIS_POINTS,
        error::ErrorCode
    },
};

// use this ix to absolutely set per-mint allocations
pub fn handle(
    _ctx: Context<AuthorizedUpdate>,
    allocations: Vec<Collateral>
) -> ProgramResult {
    let proposed_allocation: u16 = sum_allocations(&allocations)?;

    // check proposed % all add up to 10000 bps
    invariant!(
        proposed_allocation == MAX_BASIS_POINTS,
        ErrorCode::WrongCollateralError
    );

    // check no duplicate mints
    // perform the update by setting values
    // msg that some mints are added/deleted if so

    Ok(())
}
