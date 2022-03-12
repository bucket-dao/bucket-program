// https://github.com/zetamarkets/fuze/blob/master/vault/programs/vault/src/pyth_client.rs
use {
    crate::{
        error::ErrorCode,
        math::casting::{cast, cast_to_i128, cast_to_i64, cast_to_u128},
        math_error,
    },
    anchor_lang::prelude::*,
    bytemuck::{cast_slice_mut, from_bytes_mut, try_cast_slice_mut, Pod, Zeroable},
    std::cell::RefMut,
    std::convert::TryInto,
};

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

// what is this??
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
#[allow(dead_code)]
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

// https://github.com/pyth-network/pyth-client-rs/blob/210087a7b536931be701161144822ce027a186d9/src/lib.rs#L184
/// An exponentially-weighted moving average.
#[derive(Copy, Clone)]
#[repr(C)]
pub struct Ema {
    /// The current value of the EMA
    pub val: i64,
    /// numerator state for next update
    pub numer: i64,
    /// denominator state for next update
    pub denom: i64,
}

/// Price accounts represent a continuously-updating price feed for a product.
#[derive(Copy, Clone)]
#[repr(C)]
pub struct Price {
    pub magic: u32, // Pyth magic number.
    pub ver: u32,   // Program version.
    /// Account type.
    pub atype: u32,
    /// Price account size.
    pub size: u32,
    /// Price or calculation type
    pub ptype: PriceType,
    /// Price exponent.
    pub expo: i32,
    /// Number of component prices.
    pub num: u32,
    /// Currently accumulating price slot.
    pub unused: u32,
    /// Valid slot-time of agg. price.
    pub curr_slot: u64,
    /// valid slot-time of agg. price
    pub valid_slot: u64,
    /// time-weighted average price
    pub twap: i64,
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

#[cfg(target_endian = "little")]
unsafe impl Zeroable for Price {}

#[cfg(target_endian = "little")]
unsafe impl Pod for Price {}

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

// pub const MARK_PRICE_PRECISION: u128 = 10_000_000_000; //expo = -10
// https://github.com/drift-labs/protocol-v1/blob/082168ea63608ce21f4e0afa869431c94d2a6e11/programs/clearing_house/src/math/amm.rs#L222

pub fn get_pyth_price(
    price_oracle: &AccountInfo,
    clock_slot: u64,
    target_precision: u32,
) -> Result<(i128, i128, u128, i64), ErrorCode> {
    let price_account = Price::load(&price_oracle).unwrap();

    let oracle_price = cast_to_i128(price_account.agg.price)?;
    let oracle_conf = cast_to_u128(price_account.agg.conf)?;
    let oracle_twap: i128 = cast_to_i128(price_account.twap)?.try_into().unwrap();

    let orace_price_scaled: i128 = oracle_price
        .checked_mul(10i128.pow(target_precision))
        .unwrap()
        .checked_div(10i128.pow((-price_account.expo).try_into().unwrap()))
        .unwrap()
        .try_into()
        .unwrap();

    let oracle_twap_scaled: i128 = (oracle_twap)
        .checked_mul(10i128.pow(target_precision))
        .unwrap()
        .checked_div(10i128.pow((-price_account.expo).try_into().unwrap()))
        .unwrap()
        .try_into()
        .unwrap();

    let oracle_delay: i64 = cast_to_i64(clock_slot)?
        .checked_sub(cast(price_account.valid_slot)?)
        .ok_or_else(math_error!())?;

    Ok((
        orace_price_scaled,
        oracle_twap_scaled,
        oracle_conf,
        oracle_delay,
    ))
}
