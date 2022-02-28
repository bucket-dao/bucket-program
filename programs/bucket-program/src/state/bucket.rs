use {
    crate::{
        constant::{MAX_BASIS_POINTS, MAX_COLLATERAL_ELEMENTS},
        error::ErrorCode,
        util::{sum_allocations, is_collateral_authorized},
    },
    anchor_lang::prelude::*,
    std::convert::TryInto,
    vipers::invariant,
};

/// 🪣
///
/// Lets users print $BUCKET or redeem $BUCKET for its underlying.
///
/// rebalancing authority -> person who can invoke rebalance instruction
/// autority can change rebalance authority
/// how to
#[account]
#[derive(Debug, Default, PartialEq)]
pub struct Bucket {
    /// Bump.
    pub bump: u8,
    /// Mint of the [crate_token::CrateToken]. This is the reserve that
    /// is issued when an entity deposits collateral.
    pub crate_mint: Pubkey,
    /// The PDA of the [crate_token::CrateToken] protocol.
    pub crate_token: Pubkey,
    /// Account that has authority over what collateral is authorized
    pub authority: Pubkey,
    /// Account that has authority to invoke rebalance instruction
    pub rebalance_authority: Pubkey,
    /// List storing collateral mints
    pub collateral: Vec<Collateral>,
}

#[repr(C)]
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Default, PartialEq, Debug)]
pub struct Collateral {
    pub mint: Pubkey,
    // use bps for allocation %. requires a u16 (2^16 => 65,536) since max bps is 10000.
    // as ref, 100 bps => 1%, 1000 => 10%, 10000 => 100%
    pub allocation: u16,
}

impl Bucket {
    pub fn init(&mut self, bump: u8, crate_mint: Pubkey, crate_token: Pubkey, authority: Pubkey) {
        self.bump = bump;
        self.crate_mint = crate_mint;
        self.crate_token = crate_token;
        self.authority = authority;
        self.rebalance_authority = authority;
        self.collateral = Vec::new();
    }

    pub fn update_rebalance_authority(&mut self, rebalance_authority: Pubkey) -> ProgramResult {
        self.rebalance_authority = rebalance_authority;

        Ok(())
    }

    pub fn add_collateral(&mut self, mint: Pubkey, allocation: u16) -> ProgramResult {
        invariant!(
            !is_collateral_authorized(&self.collateral, mint),
            ErrorCode::CollateralAlreadyAuthorizedError
        );

        if self.collateral.len() >= MAX_COLLATERAL_ELEMENTS {
            return Err(ErrorCode::CollateralSizeLimitsExceeded.into());
        }

        let current_allocation: u16 = sum_allocations(&self.collateral)?;
        // if current allocation is non-zero, new alloc cannot === max_bps
        if current_allocation > 0 && allocation == MAX_BASIS_POINTS {
            return Err(ErrorCode::AllocationBpsExceeded.into());
        }

        let new_allocation: u16 = current_allocation
            .checked_add(allocation)
            .ok_or(ErrorCode::NumericalOverflowError)?;

        // new alloc already over max bps. take difference between max and new alloc,
        // subtract that proportionally from existing allocations
        if new_allocation > MAX_BASIS_POINTS {
            for mut col in self.collateral.iter_mut() {
                let col_64: u64 = col.allocation as u64;
                let updated_allocation: u16 = col_64
                    .checked_sub(
                        col_64
                            .checked_mul(allocation as u64)
                            .ok_or(ErrorCode::NumericalOverflowError)?
                            .checked_div(MAX_BASIS_POINTS as u64)
                            .ok_or(ErrorCode::NumericalDivisionError)?,
                    )
                    .ok_or(ErrorCode::NumericalOverflowError)?
                    .try_into()
                    .unwrap();

                col.allocation = updated_allocation;
            }
        }

        self.collateral.push(Collateral { mint, allocation });

        Ok(())
    }
}

// hard-coding collateral size of ~100
pub const BUCKET_ACCOUNT_SPACE: usize =
    // discriminator
    8 +
    // bump
    1 +
    // crate_mint
    32 +
    // crate_token
    32 +
    // authority
    32 +
    // collateral
    4 + (32 * 100);
