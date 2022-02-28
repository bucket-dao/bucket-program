use anchor_lang::prelude::*;

#[error]
pub enum ErrorCode {
    #[msg("Must deposit an approved collateral mint")]
    WrongCollateralError,
    #[msg("Must burn reserve token")]
    WrongBurnError,
    #[msg("Whitelist size limits exceeded")]
    WhitelistSizeLimitsExceeded,
    #[msg("Numerical Underflow Error")]
    NumericalUnderflowError,
    #[msg("Numerical Overflow Error")]
    NumericalOverflowError,
}
