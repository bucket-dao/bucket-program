use {
    crate::state::addresses::{IssueAuthority, WithdrawAuthority},
    crate::state::bucket::Bucket,
    anchor_lang::prelude::*,
    anchor_spl::token::Mint,
};

/// Accounts for [bucket-program::create_bucket].
#[derive(Accounts)]
pub struct CreateBucket<'info> {
    /// Information about the [Bucket].
    #[account(
        init,
        seeds = [
            b"bucket".as_ref(),
            crate_token.key().to_bytes().as_ref()
        ],
        bump,
        payer = payer,
        space = 1024 // todo: determine space needed for whitelist
    )]
    pub bucket: Account<'info, Bucket>,

    /// [Mint] of the [crate_token::CrateToken].
    pub crate_mint: Account<'info, Mint>,

    #[account(mut)]
    /// CHECK: unsafe account type, required for CPI invocation.
    pub crate_token: UncheckedAccount<'info>,

    /// This account's pubkey is set to `issue_authority`.
    #[account(
        init,
        seeds = [
            b"issue".as_ref()
        ],
        bump,
        payer = payer
    )]
    pub issue_authority: Account<'info, IssueAuthority>,

    /// This account's pubkey is set to `withdraw_authority`.
    #[account(
        init,
        seeds = [
            b"withdraw".as_ref()
        ],
        bump,
        payer = payer
    )]
    pub withdraw_authority: Account<'info, WithdrawAuthority>,

    /// Payer of the bucket initialization. Payer is default admin.
    #[account(mut)]
    pub payer: Signer<'info>,

    /// System program.
    pub system_program: Program<'info, System>,

    /// Crate token program.
    pub crate_token_program: Program<'info, crate_token::program::CrateToken>,
}

/// Accounts for [bucket-program::authorize_collateral].
#[derive(Accounts)]
pub struct AuthorizeCollateral<'info> {
    // pub mint: Account<'info, Mint>,
    /// Information about the [Bucket].
    #[account(
        seeds = [
            b"bucket".as_ref(),
            crate_token.key().to_bytes().as_ref()
        ],
        bump,
        // constraint = bucket.update_authority.key() == admin.key()
        has_one = authority
    )]
    pub bucket: Account<'info, Bucket>,

    /// CHECK: unsafe account type, required for CPI invocation.
    pub crate_token: UncheckedAccount<'info>,

    /// Signer
    pub authority: Signer<'info>,
}
