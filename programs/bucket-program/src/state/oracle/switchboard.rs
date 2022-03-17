use {
    crate::{
        error::ErrorCode,
        math::casting::{cast_to_i64, cast_to_u128},
        math_error,
    },
    anchor_lang::prelude::*,
    switchboard_v2::AggregatorAccountData
};

pub fn get_switchboard_price(
    switchboard_feed_info: &AccountInfo,
    clock_slot: u64,
    target_precision: u32,
) -> Result<(i128, i128, u128, i64), ErrorCode> {
    let feed_result = AggregatorAccountData::new(switchboard_feed_info).unwrap();

    let switchboard_decimal = AggregatorAccountData::new(switchboard_feed_info).unwrap().get_result().unwrap();

    let oracle_price: i128 = switchboard_decimal.mantissa.checked_div(10_i128.checked_pow(switchboard_decimal.scale).unwrap()).unwrap();

    let std_dev = feed_result.latest_confirmed_round.std_deviation;
    let oracle_conf: u128 = cast_to_u128(std_dev.mantissa).unwrap().checked_div(10_u128.checked_pow(std_dev.scale).unwrap()).unwrap();

    let oracle_price_scaled: i128 = oracle_price
        .checked_mul(10i128.pow(target_precision))
        .unwrap();

    let oracle_clock_slot: u64 = feed_result.latest_confirmed_round.round_open_slot.into();

    let oracle_delay: i64 = cast_to_i64(clock_slot)?
        .checked_sub(cast_to_i64(oracle_clock_slot)?)
        .ok_or_else(math_error!())?;

    Ok((
        oracle_price_scaled,
        oracle_price_scaled, //TODO: Implement TWAP with the AggregatorHistory
        oracle_conf,
        oracle_delay,
    ))
}

