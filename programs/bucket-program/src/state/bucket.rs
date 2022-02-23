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
    pub update_authority: Pubkey,
}

impl Bucket {
    pub fn init(
        &mut self,
        bump: u8,
        crate_mint: Pubkey,
        crate_token: Pubkey,
        update_authority: Pubkey,
    ) {
        self.bump = bump;
        self.crate_mint = crate_mint;
        self.crate_token = crate_token;
        self.update_authority = update_authority;
    }
}
