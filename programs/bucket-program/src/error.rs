use anchor_lang::prelude::*;

#[error]
pub enum ErrorCode {
    #[msg("Must burn reserve token")]
    WrongBurnError,
    #[msg("Max allocation bps exceeded")]
    AllocationBpsExceeded,
    #[msg("Must deposit an approved collateral mint")]
    WrongCollateralError,
    #[msg("Cannot re-authorized a collateral mint authorized")]
    CollateralAlreadyAuthorizedError,
    #[msg("Collateral size limits exceeded")]
    CollateralSizeLimitsExceeded,
    #[msg("Numerical Underflow Error")]
    NumericalUnderflowError,
    #[msg("Numerical Overflow Error")]
    NumericalOverflowError,
    #[msg("Numerical Division Error")]
    NumericalDivisionError,
}
