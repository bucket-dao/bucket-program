use {
    crate::{constant::MAX_BASIS_POINTS, error::ErrorCode, state::bucket::Collateral},
    anchor_lang::prelude::*,
    std::cmp,
};

pub fn sum_allocations(collateral: &Vec<Collateral>) -> std::result::Result<u16, ErrorCode> {
    let mut total_allocation: u16 = 0;

    if collateral.len() > 0 {
        total_allocation = collateral
            .iter()
            .map(|el| el.allocation)
            .reduce(|a, b| a + b)
            .unwrap();
    }

    if total_allocation > MAX_BASIS_POINTS {
        msg!("Allocation sum exceeds max bps");
        return Err(ErrorCode::AllocationBpsError.into());
    }

    Ok(total_allocation)
}

pub fn is_collateral_authorized(collateral: &Vec<Collateral>, mint: Pubkey) -> bool {
    return collateral.iter().filter(|&el| el.mint == mint).count() == 1;
}

pub fn scale_mint_decimals(amount: u64, source_decimals: u8, dest_decimals: u8) -> Option<u64> {
    match dest_decimals.cmp(&source_decimals) {
        cmp::Ordering::Equal => amount.into(),
        cmp::Ordering::Less => amount
            .checked_mul(10u64.checked_pow(source_decimals.checked_sub(dest_decimals)?.into())?),
        cmp::Ordering::Greater => amount
            .checked_div(10u64.checked_pow(dest_decimals.checked_sub(source_decimals)?.into())?),
    }
}

pub fn get_collateral_idx(
    collateral: &Vec<Collateral>,
    target: Pubkey,
) -> Result<usize, ErrorCode> {
    match collateral.iter().position(|&x| x.mint == target) {
        Some(index) => Ok(index),
        // todo: does this throw an err?
        None => return Err(ErrorCode::CollateralDoesNotExistError.into()),
    }
}

pub fn get_divisor(n: u64) -> Result<u64, ErrorCode> {
    let mut divisor: u64 = 1;

    // no need to check n >= 0 because u64 type limits
    if n > 0 && n < 10 {
        divisor = 1
    }
    if n >= 10 && n < 100 {
        divisor = 10
    }
    if n >= 100 && n < 1000 {
        divisor = 100
    }
    if n >= 1000 && n < 10000 {
        divisor = 1000
    }
    if n >= 10000 && n < 100000 {
        divisor = 10000
    }
    if n >= 100000 {
        return Err(ErrorCode::NumberOfSizeNotSupported);
    }

    Ok(divisor)
}
