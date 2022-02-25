use {
    anchor_lang::prelude::*,
    crate::error::ErrorCode,
};

/// 🪣
///
/// Lets users print $BUCKET or redeem $BUCKET for its underlying.
#[account]
#[derive(Debug, Default, PartialEq, Eq)]
pub struct Bucket {
    /// Bump.
    pub bump: u8,
    /// Mint of the [crate_token::CrateToken]. This is the reserve that
    /// is issued when an entity deposits collateral.
    pub crate_mint: Pubkey,
    /// The PDA of the [crate_token::CrateToken] protocol.
    pub crate_token: Pubkey,
    /// Account that has authority over what collateral is authorized
    pub authority: Pubkey,
    /// List storing whitelisted collateral mints
    pub whitelist: Vec<Pubkey>,
}

// based on current PDA attributes, max whitelist elements is approx 315.
// beyond this, we risk exceeding the 10MB account size limitation.
const MAX_WHITELIST_ELEMENTS: usize = 315;

impl Bucket {
    pub fn init(
        &mut self,
        bump: u8,
        crate_mint: Pubkey,
        crate_token: Pubkey,
        authority: Pubkey,
    ) {
        self.bump = bump;
        self.crate_mint = crate_mint;
        self.crate_token = crate_token;
        self.authority = authority;
        self.whitelist = Vec::new();
    }

    pub fn authorize_collateral(&mut self, mint: Pubkey) -> ProgramResult {
        if self.whitelist.len() >= MAX_WHITELIST_ELEMENTS {
            return Err(ErrorCode::WhitelistSizeLimitsExceeded.into());
        }

        self.whitelist.push(mint);

        Ok(())
    }
}

// hard-coding whitelist size of ~100
pub const BUCKET_ACCOUNT_SPACE: usize =
    // discriminator
    8 +
    // bump
    1 +
    // crate_mint
    32 +
    // crate_token
    32 +
    // authority
    32 +
    // whitelist
    4 + (32 * 100);