use anchor_lang::prelude::*;

#[error]
pub enum ErrorCode {
    #[msg("BucketDaoError")]
    BucketDaoError,
    #[msg("Tried to deposit wrong collateral")]
    WrongCollateralError,
    #[msg("Tried to burn wrong token")]
    WrongBurnError,
}
