use anchor_lang::prelude::*;

#[error]
pub enum ErrorCode {
    #[msg("Must deposit an approved collateral mint")]
    WrongCollateralError,
    #[msg("Cannot re-authorized a collateral mint authorized")]
    CollateralAlreadyAuthorizedError,
    #[msg("Must burn reserve token")]
    WrongBurnError,
    #[msg("Collateral size limits exceeded")]
    CollateralSizeLimitsExceeded,
    #[msg("Max allocation bps exceeded")]
    AllocationBpsExceeded,
    #[msg("Numerical overflow error!")]
    NumericalOverflowError,
    #[msg("Numerical underflow error!")]
    NumericalUnderflowError,
    #[msg("Numerical division error!")]
    NumericalDivisionError,
}
