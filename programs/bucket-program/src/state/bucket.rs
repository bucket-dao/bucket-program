use {
    crate::{
        constant::{MAX_BASIS_POINTS, MAX_COLLATERAL_ELEMENTS},
        error::ErrorCode,
        util::{get_collateral_idx, get_divisor, is_collateral_authorized, sum_allocations},
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

    pub fn set_collateral_allocations(&mut self, allocations: &Vec<Collateral>) -> ProgramResult {
        let mut new_allocation_sum: u16 = 0;

        // since we only loop through mints in the current collateral
        // list, we ignore any additional mints. error will be caught
        // in the new allocation sum check.
        for mut col in self.collateral.iter_mut() {
            let index = get_collateral_idx(&allocations, col.mint)?;

            let new_allocation = allocations[index].allocation;
            col.allocation = new_allocation;
            new_allocation_sum = new_allocation_sum
                .checked_add(new_allocation)
                .ok_or(ErrorCode::NumericalOverflowError)?;
        }

        invariant!(
            new_allocation_sum == MAX_BASIS_POINTS,
            ErrorCode::AllocationBpsError
        );

        Ok(())
    }

    pub fn remove_collateral(&mut self, mint: Pubkey) -> ProgramResult {
        let collateral_idx = get_collateral_idx(&self.collateral, mint)?;

        let removed_collateral = self.collateral.remove(collateral_idx);
        msg!("removing collateral: {:?}", removed_collateral);

        let mut running_alloc_sum: u64 = 0;
        for mut col in self.collateral.iter_mut() {
            let curr_alloc: u64 = col.allocation as u64;
            let removed_allocation: u64 = removed_collateral.allocation as u64;

            // curr_alloc + ((curr_alloc * alloc_to_remove) / (max_basis_points - alloc_to_remove))
            let curr_alloc_mult_new_alloc = curr_alloc
                .checked_mul(removed_allocation)
                .ok_or(ErrorCode::NumericalOverflowError)?;

            let change_in_alloc = curr_alloc_mult_new_alloc
                .checked_div(
                    (MAX_BASIS_POINTS as u64)
                        .checked_sub(removed_allocation)
                        .ok_or(ErrorCode::NumericalUnderflowError)?,
                )
                .ok_or(ErrorCode::NumericalDivisionError)?;

            let updated_alloc: u16 = curr_alloc
                .checked_add(change_in_alloc)
                .ok_or(ErrorCode::NumericalOverflowError)?
                .try_into()
                .unwrap();

            msg!(
                "mint: {} // curr_alloc: {} // curr_alloc_mult_new_alloc: {} // change_in_alloc: {} // updated_allocation: {}",
                col.mint,
                curr_alloc,
                curr_alloc_mult_new_alloc,
                change_in_alloc,
                updated_alloc
            );

            col.allocation = updated_alloc;

            running_alloc_sum = running_alloc_sum
                .checked_add(updated_alloc.try_into().unwrap())
                .ok_or(ErrorCode::NumericalOverflowError)?;
        }

        let max_bps_running_alloc_diff: u64 = (MAX_BASIS_POINTS as u64)
            .checked_sub(running_alloc_sum)
            .ok_or(ErrorCode::NumericalUnderflowError)?;

        msg!(
            "diff between max bps and running alloc: {}",
            max_bps_running_alloc_diff
        );

        if max_bps_running_alloc_diff > 0 {
            // add back any remaining allocation needed to reach 10000 to first value
            let mut collateral = &mut self.collateral[0];
            collateral.allocation = collateral
                .allocation
                .checked_add(max_bps_running_alloc_diff.try_into().unwrap())
                .ok_or(ErrorCode::NumericalOverflowError)?;
        }

        invariant!(
            sum_allocations(&self.collateral)? == MAX_BASIS_POINTS,
            ErrorCode::AllocationBpsError
        );

        Ok(())
    }

    pub fn add_collateral(&mut self, mint: Pubkey, allocation: u16) -> ProgramResult {
        invariant!(
            !is_collateral_authorized(&self.collateral, mint),
            ErrorCode::CollateralAlreadyAuthorizedError
        );

        // acutal constraint is 10000 collaterals because that would be 1 bps/collateral.
        // however, due to vec implementation, account size limitations prevent us from
        // hitting this upper bound. someting to consider in the future if the design changes.
        invariant!(
            self.collateral.len() <= MAX_COLLATERAL_ELEMENTS,
            ErrorCode::CollateralSizeLimitsExceeded
        );

        let current_allocation: u16 = sum_allocations(&self.collateral)?;
        // if current allocation is non-zero, new alloc cannot === max_bps
        if current_allocation > 0 && allocation == MAX_BASIS_POINTS {
            msg!("Only the first collateral can have max allocation bps");
            return Err(ErrorCode::AllocationBpsError.into());
        }

        let new_allocation: u16 = current_allocation
            .checked_add(allocation)
            .ok_or(ErrorCode::NumericalOverflowError)?;

        let mut running_remainder: u64 = 0;

        // new alloc already over max bps. take difference between max and new alloc,
        // subtract that proportionally from existing allocations
        if new_allocation > MAX_BASIS_POINTS {
            for mut col in self.collateral.iter_mut() {
                let curr_alloc_64: u64 = col.allocation as u64;

                let curr_alloc_mult_new_alloc = curr_alloc_64
                    .checked_mul(allocation as u64)
                    .ok_or(ErrorCode::NumericalOverflowError)?;

                // calculate proportional reduction of current collateral allocation
                // based on new allocation amount
                let updated_alloc: u16 = curr_alloc_64
                    .checked_sub(
                        curr_alloc_mult_new_alloc
                            .checked_div(MAX_BASIS_POINTS as u64)
                            .ok_or(ErrorCode::NumericalDivisionError)?,
                    )
                    .ok_or(ErrorCode::NumericalUnderflowError)?
                    .try_into()
                    .unwrap();

                col.allocation = updated_alloc;

                // at the end, we will adjust last element's allocation due to any loss
                // in precision from dividing by integers.
                running_remainder = running_remainder
                    .checked_add(
                        // capture decimals lost when dividing by MAX_BASIS_POINTS;
                        curr_alloc_mult_new_alloc
                            .checked_rem(MAX_BASIS_POINTS as u64)
                            .ok_or(ErrorCode::NumericalDivisionError)?,
                    )
                    .ok_or(ErrorCode::NumericalOverflowError)?;

                msg!(
                    "mint: {} // running_remainder: {} // updated_alloc: {}",
                    col.mint,
                    running_remainder,
                    updated_alloc
                );
            }
        }

        let adj_allocation = allocation
            .checked_sub(
                running_remainder
                    .checked_div(get_divisor(running_remainder)?)
                    .ok_or(ErrorCode::NumericalDivisionError)?
                    .try_into()
                    .unwrap(),
            )
            .ok_or(ErrorCode::NumericalOverflowError)?;

        msg!(
            "adjusted allocation based on running remainder: {}",
            adj_allocation
        );

        self.collateral.push(Collateral {
            mint,
            allocation: adj_allocation,
        });

        // catch any invalid updated allocations. we always want allocations to sum to MAX_BASIS_POINTS
        invariant!(
            sum_allocations(&self.collateral)? == MAX_BASIS_POINTS,
            ErrorCode::AllocationBpsError
        );

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
