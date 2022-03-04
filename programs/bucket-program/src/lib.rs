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

    /// this instruction initializes the bucket PDA required for the rest of the instructions in this file.
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

    /// this instruction changes the entity that has the authority to invoke the rebalance instruction.
    /// this prevents a compromised or incapacitated rebalance_authority from halting the bucket's
    /// continued operation.
    ///
    /// instruction privilege: only bucket authority can call this instruction
    pub fn update_rebalance_authority(
        ctx: Context<AuthorizedUpdate>,
        rebalance_authority: Pubkey,
    ) -> ProgramResult {
        instructions::update_rebalance_authority::handle(ctx, rebalance_authority)?;

        Ok(())
    }

    /// this instruction authorizes a new collateral mint for a given bucket. after this operation,
    /// anyone will be able to deposit tokens of this mint and receive the relative amount of
    /// reserve in return. due to the nature of integer math, it's possible the actual allocation
    /// of this mint will be off by a few basis points. in that case, the bucket authority can call
    /// the set_collateral_allocations instruction to absolutely set allocations.
    ///
    /// instruction privilege: only bucket authority can call this instruction
    pub fn authorize_collateral(
        ctx: Context<AuthorizedUpdate>,
        mint: Pubkey,
        allocation: u16
    ) -> ProgramResult {
        instructions::authorize_collateral::handle(ctx, mint, allocation)?;

        Ok(())
    }

    /// remove a collateral mint from the bucket. this instruction will prevent entities from
    /// depositing anymore tokens with the given mint. however, this instruction will not
    /// remove tokens of this mint from the bucket. instead, the rebalance function should
    /// handle this scenario and update the collateral allocation accordingly.
    ///
    /// instruction privilege: only bucket authority can call this instruction
    pub fn remove_collateral(
        ctx: Context<AuthorizedUpdate>,
        mint: Pubkey
    ) -> ProgramResult {
        instructions::remove_collateral::handle(ctx, mint)?;

        Ok(())
    }

    /// this instruction absolutely sets per-collateral allocations, e.g. the authority wants
    /// to set mintA to 60%, mintB to 30%, and mintC to 10%. this instruction does not allow
    /// the authority to add or remove collateral. bulk modify operations are error prone, and
    /// we prefer to reduce the possibility for a risky change.
    ///
    /// instruction privilege: only bucket authority can call this instruction
    pub fn set_collateral_allocations(
        ctx: Context<AuthorizedUpdate>,
        allocations: Vec<Collateral>
    ) -> ProgramResult {
        instructions::set_collateral_allocations::handle(ctx, allocations)?;

        Ok(())
    }

    /// this instruction will transfer a certain number of the signer's authorized collateral tokens
    /// to the bucket. in return, it will mint an equivalent number of reserve tokens to the signer
    /// based on the relative value of collateral tokens depossited.
    ///
    /// for example: an entity wants to deposit 10 mintA tokens. let's assume a roughly 1-1 exchange
    /// rate for mintA to reserve tokens. in this case, this instruction will mint 10 reserve tokens
    /// to the entity. since the reserve token is a standard SPL token, the entity is then free to
    /// use the reserve token across the Solana ecosystem.
    ///
    /// instruction privilege: anyone can call this instruction
    pub fn deposit(
        ctx: Context<Deposit>,
        deposit_amount: u64,
    ) -> ProgramResult {
        instructions::deposit::handle(ctx, deposit_amount)?;

        Ok(())
    }

    /// this instruction will burn a signer's reserve token and redeem a proportional share of
    /// collateral tokens from the bucket. because tokens are burned as deposited, the actual supply
    /// of return tokens is adjusted based on the available collateral. thus, the reserve tokens value
    /// is completely derived from the values of the underlying collateral.
    ///
    /// for example: an entity wants to redeem 10 reserve tokens, and the bucket contains 60 mintA tokens,
    /// 30 mintB tokens, and 10 mintC tokens. Assuming roughly equal value of all mints,
    /// i.e. dollar pegged stable coins, the entity will recieve 6 mintA tokens, 2 mintB tokens,
    /// and 1 mintC token.
    ///
    /// instruction privilege: anyone can call this instruction
    pub fn redeem<'info>(
        ctx: Context<'_, '_, '_, 'info, Redeem<'info>>,
        withdraw_amount: u64,
    ) -> ProgramResult {
        instructions::redeem::handle(ctx, withdraw_amount)?;

        Ok(())
    }
}
