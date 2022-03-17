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
    #[msg("Caller is not authorized to rebalance specified mints")]
    CallerCannotRebalanceCollateral,
    #[msg("Must maintain at least 1 approved collateral mint")]
    MinCollateralError,
    #[msg("Number is too large and is not supported")]
    NumberOfSizeNotSupported,
    #[msg("Unable To Load Oracles")]
    UnableToLoadOracle,
    #[msg("Math Error")]
    MathError,
    #[msg("Casting Failure")]
    CastingFailure,
    #[msg("Oracle Values are invalid")]
    InvalidOracle,
    #[msg("Aggregator is not currently populated with a valid round.")]
    InvalidAggregatorRound,
}


#[macro_export]
macro_rules! math_error {
    () => {{
        || {
            let error_code = ErrorCode::MathError;
            msg!("Error {} thrown at {}:{}", error_code, file!(), line!());
            error_code
        }
    }};
}
