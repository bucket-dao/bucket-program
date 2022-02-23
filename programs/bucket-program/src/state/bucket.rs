use anchor_lang::prelude::*;

/// 🪣
///
/// Lets users print $BUCKET or redeem $BUCKET for its underlying.
#[account]
#[derive(Debug, Default, PartialEq, Eq)]
pub struct Bucket {
    /// Bump.
    pub bump: u8,
    /// Mint of the [crate_token::CrateToken].
    pub crate_mint: Pubkey,
    /// The [crate_token::CrateToken].
    pub crate_token: Pubkey,
    /// Account that has authority over what collateral is allowed.
    pub authority: Pubkey,
    /// List storing whitelisted collateral mints
    pub whitelist: Vec<Pubkey>,
}

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

    // todo: add space constraints
    pub fn authorize_collateral(&mut self, mint: Pubkey) {
        self.whitelist.push(mint);
    }
}
