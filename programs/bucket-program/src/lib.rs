use anchor_lang::prelude::*;

mod context;
mod error;
mod instructions;
mod state;
mod util;
mod constant;

use context::*;
use state::bucket::Collateral;

declare_id!("HHqKhZs3ReukRtGqCrj1DJoSknWuCddQ3oyuQY5Uhf5P");

#[program]
pub mod bucket_program {
    use super::*;

    pub fn create_bucket(
        ctx: Context<CreateBucket>,
        bucket_bump: u8,
        crate_bump: u8,
        issue_authority_bump: u8,
        withdraw_authority_bump: u8,
    ) -> ProgramResult {
        instructions::create_bucket::handle(
            ctx,
            bucket_bump,
            crate_bump,
            issue_authority_bump,
            withdraw_authority_bump,
        )?;

        Ok(())
    }

    pub fn update_rebalance_authority(
        ctx: Context<AuthorizedUpdate>,
        rebalance_authority: Pubkey,
    ) -> ProgramResult {
        instructions::update_rebalance_authority::handle(ctx, rebalance_authority)?;

        Ok(())
    }

    pub fn authorize_collateral(
        ctx: Context<AuthorizedUpdate>,
        mint: Pubkey,
        allocation: u16
    ) -> ProgramResult {
        instructions::authorize_collateral::handle(ctx, mint, allocation)?;

        Ok(())
    }

    // remove collateral from this list of approved should we extend this instruction
    // to swap the de-authorized collateral mint to an authorized collateral mint?
    // if not, users will still receive this mint on redeem without being able to deposit.
    // ultimately, this requirements for this instruction depend on the use case for
    // removing a mint, e.g. a collateral mint is determined too risky, sus, etc.
    // in this case, it's likely we would want to empty this mint from  the pool.
    // alt, the rebalance instruction _could_ help us, depending on implementation.
    pub fn remove_collateral(
        ctx: Context<AuthorizedUpdate>,
        mint: Pubkey
    ) -> ProgramResult {
        instructions::remove_collateral::handle(ctx, mint)?;

        Ok(())
    }

    pub fn set_collateral_allocations(
        ctx: Context<AuthorizedUpdate>,
        allocations: Vec<Collateral>
    ) -> ProgramResult {
        instructions::set_collateral_allocations::handle(ctx, allocations)?;

        Ok(())
    }

    pub fn deposit(
        ctx: Context<Deposit>,
        deposit_amount: u64,
    ) -> ProgramResult {
        instructions::deposit::handle(ctx, deposit_amount)?;

        Ok(())
    }

    pub fn redeem<'info>(
        ctx: Context<'_, '_, '_, 'info, Redeem<'info>>,
        withdraw_amount: u64,
    ) -> ProgramResult {
        instructions::redeem::handle(ctx, withdraw_amount)?;

        Ok(())
    }
}
