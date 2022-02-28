use {
    crate::context::AuthorizedUpdate,
    anchor_lang::prelude::*,
};

pub fn handle(
	ctx: Context<AuthorizedUpdate>,
	rebalance_authority: Pubkey
) -> ProgramResult {
    ctx.accounts
        .bucket
        .update_rebalance_authority(rebalance_authority)?;

    Ok(())
}
