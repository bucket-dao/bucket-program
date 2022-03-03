use anchor_lang::prelude::*;

mod context;
mod error;
mod instructions;
mod state;
mod util;
mod constant;

use context::*;
use state::bucket::Collateral;

declare_id!("42SMgTM8zuez9AN5EyctZ9Si55cN3ioKpCVoCxRLuVBH");

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
