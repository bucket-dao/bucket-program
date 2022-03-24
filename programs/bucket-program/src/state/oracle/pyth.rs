// Thank you Drift Protocol: https://github.com/drift-labs/protocol-v1/blob/master/programs/clearing_house/src/state/market.rs

use super::OraclePriceData;

use {
    crate::{
        error::ErrorCode,
        math::casting::{cast, cast_to_i128, cast_to_i64, cast_to_u128},
        math_error,
    },
    anchor_lang::prelude::*
};

use anchor_lang::prelude::AccountInfo;
use bytemuck::{cast_slice_mut, from_bytes_mut, try_cast_slice_mut, Pod, Zeroable};
use std::cell::RefMut;

use anchor_lang::solana_program::msg;

#[derive(Default, Copy, Clone)]
#[repr(C)]
pub struct AccKey {
    pub val: [u8; 32],
}

#[derive(Copy, Clone)]
#[repr(C)]
#[allow(dead_code)]
pub enum PriceStatus {
    Unknown,
    Trading,
    Halted,
    Auction,
}

impl Default for PriceStatus {
    fn default() -> Self {
        PriceStatus::Trading
    }
}

#[derive(Copy, Clone)]
#[repr(C)]
pub enum CorpAction {
    NoCorpAct,
}

impl Default for CorpAction {
    fn default() -> Self {
        CorpAction::NoCorpAct
    }
}

#[derive(Default, Copy, Clone)]
#[repr(C)]
pub struct PriceInfo {
    pub price: i64,
    pub conf: u64,
    pub status: PriceStatus,
    pub corp_act: CorpAction,
    pub pub_slot: u64,
}
#[derive(Default, Copy, Clone)]
#[repr(C)]
pub struct PriceComp {
    publisher: AccKey,
    agg: PriceInfo,
    latest: PriceInfo,
}

#[derive(Copy, Clone)]
#[repr(C)]
#[allow(dead_code, clippy::upper_case_acronyms)]
pub enum PriceType {
    Unknown,
    Price,
    TWAP,
    Volatility,
}

impl Default for PriceType {
    fn default() -> Self {
        PriceType::Price
    }
}

#[derive(Default, Copy, Clone)]
#[repr(C)]
pub struct Price {
    pub magic: u32,       // Pyth magic number.
    pub ver: u32,         // Program version.
    pub atype: u32,       // Account type.
    pub size: u32,        // Price account size.
    pub ptype: PriceType, // Price or calculation type.
    pub expo: i32,        // Price exponent.
    pub num: u32,         // Number of component prices.
    pub unused: u32,
    pub curr_slot: u64,        // Currently accumulating price slot.
    pub valid_slot: u64,       // Valid slot-time of agg. price.
    pub twap: i64,             // Time-weighted average price.
    pub avol: u64,             // Annualized price volatility.
    pub drv0: i64,             // Space for future derived values.
    pub drv1: i64,             // Space for future derived values.
    pub drv2: i64,             // Space for future derived values.
    pub drv3: i64,             // Space for future derived values.
    pub drv4: i64,             // Space for future derived values.
    pub drv5: i64,             // Space for future derived values.
    pub prod: AccKey,          // Product account key.
    pub next: AccKey,          // Next Price account in linked list.
    pub agg_pub: AccKey,       // Quoter who computed last aggregate price.
    pub agg: PriceInfo,        // Aggregate price info.
    pub comp: [PriceComp; 32], // Price components one per quoter.
}

impl Price {
    #[inline]
    pub fn load<'a>(price_feed: &'a AccountInfo) -> Result<RefMut<'a, Price>, ProgramError> {
        let account_data: RefMut<'a, [u8]> =
            RefMut::map(price_feed.try_borrow_mut_data().unwrap(), |data| *data);

        let state: RefMut<'a, Self> = RefMut::map(account_data, |data| {
            from_bytes_mut(cast_slice_mut::<u8, u8>(try_cast_slice_mut(data).unwrap()))
        });
        Ok(state)
    }
}

#[cfg(target_endian = "little")]
unsafe impl Zeroable for Price {}

#[cfg(target_endian = "little")]
unsafe impl Pod for Price {}

pub fn get_price(
    price_oracle: &AccountInfo,
    clock_slot: u64,
    target_precision: u32
) -> Result<OraclePriceData, ErrorCode> {
    msg!("Using Pyth");
    
    let price_data = Price::load(&price_oracle).unwrap();

    let oracle_price = cast_to_i128(price_data.agg.price)?;
    let oracle_conf = cast_to_u128(price_data.agg.conf)?;

    let oracle_precision = 10_u128.pow(price_data.expo.unsigned_abs());
    let target_precision_scaled = 10_u128.pow(target_precision);

    let mut oracle_scale_mult = 1;
    let mut oracle_scale_div = 1;

    if oracle_precision > target_precision_scaled {
        oracle_scale_div = oracle_precision
            .checked_div(target_precision_scaled)
            .ok_or_else(math_error!())?;
    } else {
        oracle_scale_mult = target_precision_scaled
            .checked_div(oracle_precision)
            .ok_or_else(math_error!())?;
    }

    let oracle_price_scaled = (oracle_price)
        .checked_mul(cast(oracle_scale_mult)?)
        .ok_or_else(math_error!())?
        .checked_div(cast(oracle_scale_div)?)
        .ok_or_else(math_error!())?;

    let oracle_conf_scaled = (oracle_conf)
        .checked_mul(oracle_scale_mult)
        .ok_or_else(math_error!())?
        .checked_div(oracle_scale_div)
        .ok_or_else(math_error!())?;

    let oracle_delay: i64 = cast_to_i64(clock_slot)?
        .checked_sub(cast(price_data.valid_slot)?)
        .ok_or_else(math_error!())?;

    Ok(OraclePriceData {
        price: oracle_price_scaled,
        confidence: oracle_conf_scaled,
        delay: oracle_delay,
        has_sufficient_number_of_data_points: true,
    })
}

pub fn get_twap(price_oracle: &AccountInfo, target_precision: u32) -> Result<i128, ErrorCode> {
    let price_data = Price::load(&price_oracle).unwrap();

    let oracle_twap = cast_to_i128(price_data.twap)?;

    let oracle_precision = 10_u128.pow(price_data.expo.unsigned_abs());
    let target_precision_scaled = 10_u128.pow(target_precision);

    let mut oracle_scale_mult = 1;
    let mut oracle_scale_div = 1;

    if oracle_precision > target_precision_scaled {
        oracle_scale_div = oracle_precision
            .checked_div(target_precision_scaled)
            .ok_or_else(math_error!())?;
    } else {
        oracle_scale_mult = target_precision_scaled
            .checked_div(oracle_precision)
            .ok_or_else(math_error!())?;
    }

    let oracle_twap_scaled = (oracle_twap)
        .checked_mul(cast(oracle_scale_mult)?)
        .ok_or_else(math_error!())?
        .checked_div(cast(oracle_scale_div)?)
        .ok_or_else(math_error!())?;

    Ok(oracle_twap_scaled)
}