pub mod pyth;
use {
    crate::{
        constant::{MAX_ORACLE_CONF, SLOTS_BEFORE_STALE},
        error::ErrorCode,
        state::oracle::pyth::get_pyth_price,
    },
    anchor_lang::prelude::*,
};

#[derive(Default, Clone, Copy, Debug)]
pub struct OraclePriceData {
    pub price: i128,
    pub twap: i128,
    pub confidence: u128,
    pub delay: i64,
}

// inspired by https://github.com/drift-labs/protocol-v1/blob/f8c80cfe041bb3780928364ab17641e23dcd42bd/programs/clearing_house/src/state/state.rs#L51

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy)]
pub enum OracleSource {
    Pyth,
    Switchboard,
}

impl Default for OracleSource {
    fn default() -> Self {
        OracleSource::Pyth
    }
}

pub fn get_oracle_price(
    price_oracle: &AccountInfo,
    clock_slot: u64,
    precision: u32,
) -> Result<OraclePriceData, ErrorCode> {
    let default_oracle_source = OracleSource::Pyth;

    let (price, twap, confidence, delay) = match default_oracle_source {
        OracleSource::Pyth => get_pyth_price(price_oracle, clock_slot, precision)?,
        OracleSource::Switchboard => (0, 0, 0, 0),
    };

    let result = OraclePriceData {
        price,
        twap,
        confidence,
        delay,
    };
    require!(
        is_oracle_valid(&result).unwrap() == true,
        ErrorCode::InvalidOracle
    );

    Ok(result)
}

pub fn is_oracle_valid(oracle_price_data: &OraclePriceData) -> Result<bool, ErrorCode> {
    let OraclePriceData {
        price: oracle_price,
        twap: oracle_twap,
        confidence: oracle_conf,
        delay: oracle_delay,
    } = *oracle_price_data;

    let is_oracle_price_nonpositive = (oracle_twap <= 0) || (oracle_price <= 0);

    let is_conf_too_large = oracle_conf.gt(&MAX_ORACLE_CONF);

    let is_stale = oracle_delay.gt(&SLOTS_BEFORE_STALE);

    Ok(!(is_stale || is_conf_too_large || is_oracle_price_nonpositive))
}
