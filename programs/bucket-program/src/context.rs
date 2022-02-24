use {
    crate::state::addresses::{IssueAuthority, WithdrawAuthority},
    crate::state::bucket::Bucket,
    anchor_lang::prelude::*,
    anchor_spl::token::{Mint, Token, TokenAccount},
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
        mut,
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

/// Accounts for [bucket-program::deposit].
#[derive(Accounts)]
pub struct Deposit<'info> {
    /// Information about the [Bucket].
    #[account(
            seeds = [
                b"bucket".as_ref(),
                crate_token.key().to_bytes().as_ref()
            ],
            bump,
        )]
    pub bucket: Box<Account<'info, Bucket>>,

    /// System program.
    pub system_program: Program<'info, System>,

    /// Token program.
    pub token_program: Program<'info, Token>,

    // #[account(mut)]
    /// CHECK: unsafe account type, required for CPI invocation.
    pub crate_token: UncheckedAccount<'info>,

    #[account(mut)]
    /// [Mint] of the [crate_token::CrateToken].
    pub crate_mint: Box<Account<'info, Mint>>,

    /// [TokenAccount] holding the [Collateral] tokens of the [crate_token::CrateToken].
    /// unique reserver per collateral mint
    #[account(mut)]
    pub collateral_reserve: Box<Account<'info, TokenAccount>>,

    /// Crate token program.
    pub crate_token_program: Program<'info, crate_token::program::CrateToken>,

    /// User that deposits the whitelisted mint token
    pub depositor: Signer<'info>,

    /// Source of the deposited [Collateral] tokens
    #[account(mut)]
    pub depositor_source: Box<Account<'info, TokenAccount>>,

    /// Destination account that receives the issued token
    #[account(mut)]
    pub mint_destination: Box<Account<'info, TokenAccount>>,

    /// This account's pubkey is set to `issue_authority`.
    #[account(
        seeds = [
            b"issue".as_ref()
        ],
        bump,
    )]
    pub issue_authority: Box<Account<'info, IssueAuthority>>,
}

/// Accounts for [bucket-program::withdraw].
#[derive(Accounts)]
pub struct Withdraw<'info> {
    /// Information about the [Bucket].
    #[account(
            seeds = [
                b"bucket".as_ref(),
                crate_token.key().to_bytes().as_ref()
            ],
            bump,
        )]
    pub bucket: Account<'info, Bucket>,

    /// System program.
    pub system_program: Program<'info, System>,

    /// Token program.
    pub token_program: Program<'info, Token>,

    #[account(mut)]
    /// CHECK: unsafe account type, required for CPI invocation.
    pub crate_token: UncheckedAccount<'info>,

    /// [Mint] of the [crate_token::CrateToken].
    pub crate_mint: Account<'info, Mint>,

    /// [TokenAccount] holding the [Collateral] tokens of the [crate_token::CrateToken].
    /// unique reserver per collateral mint
    #[account(mut)]
    pub collateral_reserve: Account<'info, TokenAccount>,

    /// Crate token program.
    pub crate_token_program: Program<'info, crate_token::program::CrateToken>,

    /// User that deposits the whitelisted mint token
    pub withdrawer: Signer<'info>,

    /// Source of the deposited [Collateral] tokens
    #[account(mut)]
    pub withdrawer_source: Account<'info, TokenAccount>,

    /// Destination account that receives the collateral token
    #[account(mut)]
    pub withdraw_destination: Account<'info, TokenAccount>,

    /// This account's pubkey is set to `issue_authority`.
    #[account(
        seeds = [
            b"withdraw".as_ref()
        ],
        bump,
    )]
    pub withdraw_authority: Account<'info, WithdrawAuthority>,
}

#[derive(Accounts)]
pub struct Common<'info> {
    /// Information about the [Bucket].
    #[account(
        seeds = [
            b"bucket".as_ref(),
            crate_token.key().to_bytes().as_ref()
        ],
        bump,
    )]
    pub bucket: Account<'info, Bucket>,

    /// System program.
    pub system_program: Program<'info, System>,

    /// Token program.
    pub token_program: Program<'info, Token>,

    #[account(mut)]
    /// CHECK: unsafe account type, required for CPI invocation.
    pub crate_token: UncheckedAccount<'info>,

    /// [Mint] of the [crate_token::CrateToken].
    pub crate_mint: Account<'info, Mint>,

    /// [TokenAccount] holding the [Collateral] tokens of the [crate_token::CrateToken].
    /// unique reserver per collateral mint
    #[account(mut)]
    pub collateral_reserve: Account<'info, TokenAccount>,

    /// Crate token program.
    pub crate_token_program: Program<'info, crate_token::program::CrateToken>,
}
