use anchor_lang::prelude::*;

#[error]
pub enum ErrorCode {
    #[msg("Must burn reserve token")]
    WrongBurnError,
    #[msg("Allocation bps error")]
    AllocationBpsError,
    #[msg("Must deposit an approved collateral mint")]
    WrongCollateralError,
    #[msg("Cannot re-authorized a collateral mint authorized")]
    CollateralAlreadyAuthorizedError,
    #[msg("Cannot de-authorized a collateral mint that does not exist")]
    CollateralDoesNotExistError,
    #[msg("Collateral size limits exceeded")]
    CollateralSizeLimitsExceeded,
    #[msg("Must maintain at least 1 approved collateral mint")]
    MinCollateralError,
    #[msg("Numerical Underflow Error")]
    NumericalUnderflowError,
    #[msg("Numerical Overflow Error")]
    NumericalOverflowError,
    #[msg("Numerical Division Error")]
    NumericalDivisionError,
    #[msg("Number is too large and is not supported")]
    NumberOfSizeNotSupported,
}
