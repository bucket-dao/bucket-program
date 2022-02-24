use anchor_lang::prelude::*;

mod context;
mod instructions;
mod state;
mod error;

use context::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod bucket_program {
    use super::*;

    pub fn create_bucket(
        ctx: Context<CreateBucket>,
        bucket_bump: u8,
        crate_bump: u8,
    ) -> ProgramResult {
        instructions::create_bucket::handle(ctx, bucket_bump, crate_bump)?;

        Ok(())
    }

    pub fn authorize_collateral(ctx: Context<AuthorizeCollateral>, mint: Pubkey) -> ProgramResult {
        instructions::authorize_collateral::handle(ctx, mint)?;

        Ok(())
    }
    //deposit_issue?
    pub fn deposit(ctx: Context<Deposit>, deposit_amount: u64) -> ProgramResult {
        instructions::deposit::handle(ctx, deposit_amount)?;
        Ok(())
    }

    // deposit (issue), redeem (withdraw / redeem)
}
