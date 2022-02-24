use anchor_lang::prelude::*;

#[error]
pub enum ErrorCode {
    #[msg("BucketDaoError")]
    BucketDaoError,
    #[msg("fuck")]
    WrongCollateralError,
}