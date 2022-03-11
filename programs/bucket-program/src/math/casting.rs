use {crate::error::ErrorCode, std::convert::TryInto};

pub fn cast<T: TryInto<U>, U>(t: T) -> Result<U, ErrorCode> {
    t.try_into().map_err(|_| ErrorCode::CastingFailure)
}

pub fn cast_to_i128<T: TryInto<i128>>(t: T) -> Result<i128, ErrorCode> {
    cast(t)
}

pub fn cast_to_u128<T: TryInto<u128>>(t: T) -> Result<u128, ErrorCode> {
    cast(t)
}

pub fn cast_to_i64<T: TryInto<i64>>(t: T) -> Result<i64, ErrorCode> {
    cast(t)
}
