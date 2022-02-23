use anchor_lang::prelude::*;

mod context;
mod instructions;
mod state;

use context::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod bucket_program {
    use super::*;

    pub fn create_bucket(ctx: Context<CreateBucket>) -> ProgramResult {
        instructions::create_bucket::handle(ctx)?;

        Ok(())
    }
}
