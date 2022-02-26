use anchor_lang::prelude::*;

mod context;
mod error;
mod instructions;
mod state;

use context::*;

declare_id!("4c5Ef9CjxnXmkyc7WxQwNvA4wFWu7dw1sPCHoHxMh6CY");

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

    pub fn authorize_collateral(
        ctx: Context<AuthorizeCollateral>,
        mint: Pubkey,
    ) -> ProgramResult {
        instructions::authorize_collateral::handle(ctx, mint)?;

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
