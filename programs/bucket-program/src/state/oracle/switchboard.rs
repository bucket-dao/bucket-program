// Thank you Drift Protocol: https://github.com/drift-labs/protocol-v1/blob/master/programs/clearing_house/src/state/market.rs

use super::OraclePriceData;

use {
    crate::{
        error::ErrorCode,
        math::casting::{cast, cast_to_i64},
        math_error,
    },
    anchor_lang::prelude::*,
    std::cmp::max,
    switchboard_v2::decimal::SwitchboardDecimal,
    switchboard_v2::AggregatorAccountData,
};

pub fn get_price(
    switchboard_feed_info: &AccountInfo,
    clock_slot: u64,
    target_precision: u32,
) -> Result<OraclePriceData, ErrorCode> {
    let aggregator_data =
        AggregatorAccountData::new(switchboard_feed_info).or(Err(ErrorCode::UnableToLoadOracle))?;

    let price = convert_switchboard_decimal(
        &aggregator_data.latest_confirmed_round.result,
        target_precision,
    )?;

    let conf = convert_switchboard_decimal(
        &aggregator_data.latest_confirmed_round.std_deviation,
        target_precision,
    )?;

    // std deviation should always be positive, if we get a negative make it u128::MAX so it's flagged as bad value
    let conf = if conf < 0 {
        u128::MAX
    } else {
        let price_10bps = price
            .unsigned_abs()
            .checked_div(1000)
            .ok_or_else(math_error!())?;
        max(conf.unsigned_abs(), price_10bps)
    };

    let delay: i64 = cast_to_i64(clock_slot)?
        .checked_sub(cast(
            aggregator_data.latest_confirmed_round.round_open_slot,
        )?)
        .ok_or_else(math_error!())?;

    let has_sufficient_number_of_data_points =
        aggregator_data.latest_confirmed_round.num_success
            >= aggregator_data.min_oracle_results;

    Ok(OraclePriceData {
        price: price,
        confidence: conf,
        delay: delay,
        has_sufficient_number_of_data_points: has_sufficient_number_of_data_points,
    })
}

/// Given a decimal number represented as a mantissa (the digits) plus an
/// original_precision (10.pow(some number of decimals)), scale the
/// mantissa/digits to make sense with a new_precision.
fn convert_switchboard_decimal(
    switchboard_decimal: &SwitchboardDecimal,
    target_precision: u32,
) -> Result<i128, ErrorCode> {
    let switchboard_precision_scaled = 10_u128.pow(switchboard_decimal.scale);
    let target_precision_scaled = 10_u128.pow(target_precision);

    if switchboard_precision_scaled > target_precision_scaled {
        switchboard_decimal
            .mantissa
            .checked_div((switchboard_precision_scaled / target_precision_scaled) as i128)
            .ok_or_else(math_error!())
    } else {
        switchboard_decimal
            .mantissa
            .checked_mul((target_precision_scaled / switchboard_precision_scaled) as i128)
            .ok_or_else(math_error!())
    }
}
