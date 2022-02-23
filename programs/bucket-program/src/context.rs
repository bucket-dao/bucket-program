use {
    anchor_lang::prelude::*,
    anchor_spl::token::{Mint, TokenAccount},
    crate::state::bucket::Bucket
};

/// Accounts for [bucket-program::create_bucket].
#[derive(Accounts)]
#[instruction(bump: u8)]
pub struct CreateBucket<'info> {
    /// Information about the [Bucket].
    #[account(
        init,
        seeds = [
            b"Bucket".as_ref(),
            bucket_token_account.key().to_bytes().as_ref()
        ],
        bump,
        payer = payer
    )]
    pub bucket: Account<'info, Bucket>,

    /// [Mint] of the [crate_token::CrateToken].
    pub bucket_mint: Account<'info, Mint>,

    /// The [crate_token::CrateToken] token account to be created.
    /// Reference crate_token because CPI into crate_token program.
    #[account(mut)]
    pub bucket_token_account: Account<'info, TokenAccount>,

    /// This account's pubkey is set to `issue_authority`.
    /// CHECK: This is not dangerous because we don't read or write from this account.
    pub issue_authority: UncheckedAccount<'info>,

    /// This account's pubkey is set to `withdraw_authority`.
    /// CHECK: This is not dangerous because we don't read or write from this account.
    pub withdraw_authority: UncheckedAccount<'info>,

    /// Payer of the bucket initialization. Payer is default admin.
    #[account(mut)]
    pub payer: Signer<'info>,

    /// System program.
    pub system_program: Program<'info, System>,

    /// Crate token program.
    pub crate_token_program: Program<'info, crate_token::program::CrateToken>,
}
