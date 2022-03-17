use {
    crate::{
        constant::{MAX_BASIS_POINTS, MAX_COLLATERAL_ELEMENTS},
        error::ErrorCode,
        util::{get_collateral_idx, get_divisor, is_collateral_authorized, sum_allocations},
        math_error
    },
    anchor_lang::prelude::*,
    std::convert::TryInto,
    vipers::invariant,
};

/// 🪣
///
/// Lets users print $BUCKET or redeem $BUCKET for its underlying.
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
    /// use bps for allocation %. requires a u16 (2^16 => 65,536) since max bps is 10000.
    /// as ref, 100 bps => 1%, 1000 => 10%, 10000 => 100%
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
        // keep a running sum of the new allocation total. at the end of this function, we will
        // verify that the allocations sum to the full 10000 bps.
        let mut running_updated_allocation: u16 = 0;

        // since we only loop through list of currently authorized mints, we ignore any additional mints.
        // error will be caught in the new allocation sum check.
        for mut collateral in self.collateral.iter_mut() {
            msg!("updating collateral allocation: {}", collateral.mint);

            // match the current collateral to the collateral in the updated allocations vec
            let updated_collateral_allocation =
                allocations[get_collateral_idx(&allocations, collateral.mint)?].allocation;

            // update the running sum of updated allocation
            running_updated_allocation = running_updated_allocation
                .checked_add(updated_collateral_allocation)
                .ok_or_else(math_error!())?;

            // set the current collateral's updated allocation
            collateral.allocation = updated_collateral_allocation;
        }

        msg!("running_updated_allocation: {}", running_updated_allocation);

        invariant!(
            running_updated_allocation == MAX_BASIS_POINTS,
            ErrorCode::AllocationBpsError
        );

        Ok(())
    }

    pub fn remove_collateral(&mut self, mint: Pubkey) -> ProgramResult {
        // prevent authority from removing all approved collateral mints
        invariant!(self.collateral.len() > 1, ErrorCode::MinCollateralError);

        // remove the collateral element from the current vec based on the mint parameter
        let removed_collateral = self
            .collateral
            .remove(get_collateral_idx(&self.collateral, mint)?);
        msg!(
            "requesting to remove collateral with mint: {}. actually removed collateral: {:?}",
            mint,
            removed_collateral
        );

        let mut running_allocation_sum: u64 = 0;
        for mut collateral in self.collateral.iter_mut() {
            let current_allocation: u64 = collateral.allocation as u64;
            let removed_allocation: u64 = removed_collateral.allocation as u64;

            // we will proportionally redistribute the removed collateral's allocation to the remaining
            // collateral in the pool. to explore how this works, let's consider an example.
            //
            // let's say there are currently 3 collaterals: mintA with 60%, mintB with 30%, and mintC
            // with 10% of the allocation, respectively. say we want to remove mintC from the collateral.
            // as stated above, mintC is currently 10% or 1_000 bps of the total allocation. when we remove
            // mintC, we still want the total allocation to sum to 100% or 10_000 bps. so, we need to
            // redistribute how much of mintC's allocation is distributed to mintA and mintB. we will use
            // the following expression to do this:
            //
            // mintN_i+1_allocation = mintN_i_allocation + ((mintN_i_allocation * mintM_i_allocation) / (max_basis_points - mintM_i_allocation)),
            // where mintM_i_allocation is the allocation of the removed collateral.
            //
            // let's consider what this means in numeric terms from our example above:
            // mintA_i+1_allocation = mintA_i_allocation + ((mintA_i_allocation * mintC_i_allocation) / (max_basis_points - mintC_i_allocation))
            //                      = 6_000 + ((6_000 * 1_000) / (10_000 - 1_000))
            //                      = 6_000 + (6_000_000 / 9_000)
            //                      = 666 (666.67 with decimals)
            //
            // mintB_i+1_allocation = mintB_i_allocation + ((mintB_i_allocation * mintC_i_allocation) / (max_basis_points - mintC_i_allocation))
            //                      = 3_000 + ((3_000 * 1_000) / (10_000 - 1_000))
            //                      = 3_000 + (3_000_000 / 9_000)
            //                      = 333 (333.33 with decimals)
            //
            // together, mintA_i+1_allocation + mintB_i+1_allocation should be equal to the max basis points of 10_000. however,
            // we can see that a loss of decimal precision will result in a slightly inaccurate result. so, we will also keep track
            // of these remainders. discussed further in comments below.
            let change_current_in_allocation = current_allocation
                .checked_mul(removed_allocation)
                .ok_or_else(math_error!())?
                .checked_div(
                    (MAX_BASIS_POINTS as u64)
                        .checked_sub(removed_allocation)
                        .ok_or_else(math_error!())?
                    )
                .ok_or_else(math_error!())?;

            // update the current collateral's allocation
            collateral.allocation = current_allocation
                .checked_add(change_current_in_allocation)
                .ok_or_else(math_error!())?
                .try_into()
                .unwrap();

            msg!(
                "mint {} with allocation {} is changing by {} to {}",
                collateral.mint,
                current_allocation,
                change_current_in_allocation,
                collateral.allocation
            );

            // update the running sum of collateral allocations
            running_allocation_sum = running_allocation_sum
                .checked_add(collateral.allocation.try_into().unwrap())
                .ok_or_else(math_error!())?;
        }

        // check if there is a discrepancy between expected max basis points and the updated allocation's sum.
        // if so, we want to resolve by adding the discrepancy to some collateral's allocation.
        let bps_discrepancy: u64 = (MAX_BASIS_POINTS as u64)
            .checked_sub(running_allocation_sum)
            .ok_or_else(math_error!())?;

        if bps_discrepancy > 0 {
            msg!("adjusting allocation amounts so that sum equals max bps");

            // add remaining allocation discrepancy to first authorized collateral
            let mut collateral = &mut self.collateral[0];
            collateral.allocation = collateral
                .allocation
                .checked_add(bps_discrepancy.try_into().unwrap())
                .ok_or_else(math_error!())?;
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

        // the acutal constraint is 10_000 collaterals because that would mean each collateral
        // would have a 1 bps allocation. however, the current vec implementation means that the
        // solana account size limitation will prevent us from hitting this upper bound. we want
        // to consider this constraint in the future if the design changes.
        invariant!(
            self.collateral.len() <= MAX_COLLATERAL_ELEMENTS,
            ErrorCode::CollateralSizeLimitsExceeded
        );

        let current_collateral_allocation: u16 = sum_allocations(&self.collateral)?;
        // if the current collateral allocation is non-zero, new alloc cannot equal max bps.
        // otherwise, at least 1 other authorized collateral's allocation would be set to zero.
        if current_collateral_allocation > 0 && allocation == MAX_BASIS_POINTS {
            msg!("Only the first collateral can have max allocation bps");
            return Err(ErrorCode::AllocationBpsError.into());
        }

        // due to loss of precision, keep track of division operation remainder. this value will later
        // be used to adjust allocations so that the allocation sum is equal to max basis points.
        let mut running_remainder: u64 = 0;

        // the updated allocation with the newly proposed collateral. if this value is greater than
        // max bps, we will proportionally subtract from existing collateral to make room for the
        // new collateral's allocation.
        let allocation_with_new_mint: u16 = current_collateral_allocation
            .checked_add(allocation)
            .ok_or_else(math_error!())?;
        if allocation_with_new_mint > MAX_BASIS_POINTS {
            for mut collateral in self.collateral.iter_mut() {
                let current_allocation_64: u64 = collateral.allocation as u64;

                let current_and_new_allocation = current_allocation_64
                    .checked_mul(allocation as u64)
                    .ok_or_else(math_error!())?;

                running_remainder = running_remainder
                    .checked_add(
                        // capture decimals lost when dividing by MAX_BASIS_POINTS
                        current_and_new_allocation
                            .checked_rem(MAX_BASIS_POINTS as u64)
                            .ok_or_else(math_error!())?
                    )
                    .ok_or_else(math_error!())?;

                // calculate and set the proportional reduction of current collateral allocation based
                // on new allocation amount.
                collateral.allocation = current_allocation_64
                    .checked_sub(
                        current_and_new_allocation
                            .checked_div(MAX_BASIS_POINTS as u64)
                            .ok_or_else(math_error!())?,
                    )
                    .ok_or_else(math_error!())?
                    .try_into()
                    .unwrap();

                msg!(
                    "collateral mint {} has an updated allocation of {}. running remainder now totals = {}",
                    collateral.mint,
                    collateral.allocation,
                    running_remainder,
                );
            }
        }

        let adjusted_allocation = allocation
            .checked_sub(
                running_remainder
                    .checked_div(get_divisor(running_remainder)?)
                    .ok_or_else(math_error!())?
                    .try_into()
                    .unwrap(),
            )
            .ok_or_else(math_error!())?;

        self.collateral.push(Collateral {
            mint,
            allocation: adjusted_allocation,
        });

        msg!(
            "new collateral's requested allocation = {}. actual allocation = {}.",
            allocation,
            adjusted_allocation,
        );

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
