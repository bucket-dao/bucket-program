use {
    anchor_lang::prelude::*,
    crate::context::CreateBucket
};

pub fn handle(ctx: Context<CreateBucket>) -> ProgramResult {
    Ok(())
}
