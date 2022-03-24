pub mod pyth;
pub mod switchboard;

use crate::constant::{MAX_ORACLE_CONF, SLOTS_BEFORE_STALE};
use {crate::error::ErrorCode, anchor_lang::prelude::AccountInfo, anchor_lang::prelude::*};

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy)]
pub enum OracleSource {
    Pyth,
    Switchboard,
}

impl Default for OracleSource {
    // UpOnly
    fn default() -> Self {
        OracleSource::Pyth
    }
}
trait Backup {
    fn backup() -> OracleSource;
}

impl Backup for OracleSource {
    fn backup() -> Self {
        match OracleSource::default() {
            OracleSource::Pyth => OracleSource::Switchboard,
            OracleSource::Switchboard => OracleSource::Pyth
        }
    }
}

#[derive(Default, Clone, Copy, Debug)]
pub struct OraclePriceData {
    pub price: i128,
    pub confidence: u128,
    pub delay: i64,
    pub has_sufficient_number_of_data_points: bool,
}

pub fn get_oracle_price(
    pyth_oracle: &AccountInfo,
    switchboard_oracle: &AccountInfo,
    clock_slot: u64,
    target_precision: u32,
) -> Result<OraclePriceData, ErrorCode> {
    let result = match OracleSource::default() {
        OracleSource::Pyth => pyth::get_price(pyth_oracle, clock_slot, target_precision),
        OracleSource::Switchboard => {
            switchboard::get_price(switchboard_oracle, clock_slot, target_precision)
        }
    }
    .unwrap(); // TODO: Fix naked unwrap

    let twap = get_oracle_twap(pyth_oracle, switchboard_oracle, target_precision).unwrap(); // TODO: Fix naked unwrap

    let is_default_oracle_valid = is_oracle_valid(&result, twap).unwrap(); // TODO: Fix naked unwrap

    if is_default_oracle_valid == true {
        Ok(result)
    }
    else {
        let backup_result = match OracleSource::backup() {
            OracleSource::Pyth => pyth::get_price(pyth_oracle, clock_slot, target_precision),
            OracleSource::Switchboard => {
                switchboard::get_price(switchboard_oracle, clock_slot, target_precision)
            }
        }
        .unwrap(); // TODO: Fix naked unwrap

        let backup_twap = get_oracle_twap(pyth_oracle, switchboard_oracle, target_precision).unwrap(); // TODO: Fix naked unwrap

        let is_backup_oracle_valid = is_oracle_valid(&backup_result, backup_twap).unwrap(); // TODO: Fix naked unwrap

        require!(
            is_backup_oracle_valid == true, // TODO: Fix naked unwrap
            ErrorCode::InvalidOracle
        );

        Ok(backup_result)
    }
}

pub fn get_oracle_twap(
    pyth_oracle: &AccountInfo,
    _switchboard_oracle: &AccountInfo, // Prefixed with _ to show it's unused
    target_precision: u32,
) -> Result<Option<i128>, ErrorCode> {
    let default_oracle = OracleSource::default();

    match default_oracle {
        OracleSource::Pyth => Ok(Some(pyth::get_twap(pyth_oracle, target_precision)?)),
        OracleSource::Switchboard => Ok(None), // TODO: Implement
    }
}

pub fn is_oracle_valid(
    oracle_price_data: &OraclePriceData,
    twap: Option<i128>,
) -> Result<bool, ErrorCode> {
    let OraclePriceData {
        price,
        confidence,
        delay,
        has_sufficient_number_of_data_points,
    } = *oracle_price_data;

    let is_oracle_price_nonpositive =
        (price <= 750000) && ((twap.is_some() && twap.unwrap() <= 0) || twap.is_none());

    let is_conf_too_large = confidence.gt(&MAX_ORACLE_CONF);

    let is_stale = delay.gt(&SLOTS_BEFORE_STALE);

    Ok(
        !(is_stale || is_conf_too_large || is_oracle_price_nonpositive)
            && has_sufficient_number_of_data_points,
    )
}
