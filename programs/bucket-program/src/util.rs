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
        return Err(ErrorCode::AllocationBpsExceeded.into());
    }

    Ok(total_allocation)
}

pub fn is_collateral_authorized(
    collateral: &Vec<Collateral>,
    mint: Pubkey,
) -> bool {
    return collateral.iter().filter(|&el| el.mint == mint).count() == 1;
}

pub fn scale_mint_decimals(
    amount: u64,
    source_decimals: u8,
    dest_decimals: u8,
) -> Option<u64> {
    match dest_decimals.cmp(&source_decimals) {
        cmp::Ordering::Equal => amount.into(),
        cmp::Ordering::Less => amount.checked_mul(
            10u64.checked_pow(source_decimals.checked_sub(dest_decimals)?.into())?,
        ),
        cmp::Ordering::Greater => amount.checked_div(
            10u64.checked_pow(dest_decimals.checked_sub(source_decimals)?.into())?,
        ),
    }
}
