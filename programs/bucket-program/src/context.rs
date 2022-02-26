use {
    anchor_lang::prelude::*,
    crate::state::{
        issue_authority::IssueAuthority,
        withdraw_authority::WithdrawAuthority,
        bucket::{
            Bucket,
            BUCKET_ACCOUNT_SPACE
        },
    },
    anchor_spl::token::{
        Burn,
        Mint,
        Transfer,
        Token,
        TokenAccount,
    },
    crate_token::cpi::accounts::{
        Issue,
        NewCrate,
        Withdraw,
    },
};

/// if singleton (issue|withdraw) authority PDAs become problemtic,
/// add additional seeds using either crate_token or crate_mint.
#[derive(Accounts)]
pub struct CreateBucket<'info> {
    /// Initializing payer is the default authority
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(
        init,
        seeds = [
            b"bucket".as_ref(),
            crate_token.key().to_bytes().as_ref()
        ],
        bump,
        payer = payer,
        space = BUCKET_ACCOUNT_SPACE
    )]
    pub bucket: Account<'info, Bucket>,

    /// entity with authority to mint and issue new reserve tokens
    #[account(
        init,
        seeds = [
            b"issue".as_ref()
        ],
        bump,
        payer = payer
    )]
    pub issue_authority: Account<'info, IssueAuthority>,

    /// entity with authority to withdraw tokens from crate ATAs
    #[account(
        init,
        seeds = [
            b"withdraw".as_ref()
        ],
        bump,
        payer = payer
    )]
    pub withdraw_authority: Account<'info, WithdrawAuthority>,

    /// Mint of the reserve token linked to the [crate_token::CrateToken]
    pub crate_mint: Account<'info, Mint>,

    /// PDA of the [crate_token::CrateToken] protocol. Must adhere to a specific PDA
    /// address derivation, otherwise CPI call will fail. See source here:
    /// https://github.com/CrateProtocol/crate/blob/master/programs/crate_token/src/lib.rs#L258-L267
    /// CHECK: unsafe account type, required for CPI invocation.
    #[account(mut)]
    pub crate_token: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,

    pub crate_token_program: Program<'info, crate_token::program::CrateToken>,
}

#[derive(Accounts)]
pub struct AuthorizeCollateral<'info> {
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [
            b"bucket".as_ref(),
            crate_token.key().to_bytes().as_ref()
        ],
        bump,
        has_one = authority
    )]
    pub bucket: Account<'info, Bucket>,

    /// CHECK: unsafe account type, required for CPI invocation.
    pub crate_token: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct Deposit<'info> {
    pub depositor: Signer<'info>,

    pub common: Common<'info>,

    #[account(
        seeds = [
            b"issue".as_ref(),
        ],
        bump,
    )]
    pub issue_authority: Box<Account<'info, IssueAuthority>>,

    #[account(mut)]
    pub crate_collateral: Box<Account<'info, TokenAccount>>,

    #[account(mut)]
    pub depositor_collateral: Box<Account<'info, TokenAccount>>,

    #[account(mut)]
    pub depositor_reserve: Box<Account<'info, TokenAccount>>,
}

#[derive(Accounts)]
pub struct Redeem<'info> {
    pub withdrawer: Signer<'info>,

    pub common: Common<'info>,

    #[account(
        seeds = [
            b"withdraw".as_ref()
        ],
        bump,
    )]
    pub withdraw_authority: Box<Account<'info, WithdrawAuthority>>,

    #[account(mut)]
    pub withdrawer_reserve: Box<Account<'info, TokenAccount>>,
}

#[derive(Accounts)]
pub struct Common<'info> {
    #[account(
        seeds = [
            b"bucket".as_ref(),
            crate_token.key().to_bytes().as_ref()
        ],
        bump,
    )]
    pub bucket: Account<'info, Bucket>,

    /// CHECK: unsafe account type, required for CPI invocation.
    pub crate_token: UncheckedAccount<'info>,

    #[account(mut)]
    pub crate_mint: Account<'info, Mint>,

    pub crate_token_program: Program<'info, crate_token::program::CrateToken>,

    pub system_program: Program<'info, System>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct RedeemAsset<'info> {
    #[account(mut)]
    pub crate_collateral: Box<Account<'info, TokenAccount>>,

    /// withdrawer collateral ATA
    #[account(mut)]
    pub withdraw_destination: Box<Account<'info, TokenAccount>>,

    /// Author fee collateral ATA
    #[account(mut)]
    pub author_fee_destination: Box<Account<'info, TokenAccount>>,

    /// Protocol fee collateral ATA
    #[account(mut)]
    pub protocol_fee_destination: Box<Account<'info, TokenAccount>>,
}

// ======================================
// CPI CONTEXT TRANSFORMATIONS
// ======================================

impl<'info> CreateBucket<'info> {
    pub fn into_new_crate_context(&self) -> CpiContext<'_, '_, '_, 'info, NewCrate<'info>> {
        let cpi_program = self.crate_token_program.to_account_info();

        let cpi_accounts = NewCrate {
            crate_mint: self.crate_mint.to_account_info(),
            crate_token: self.crate_token.to_account_info(),
            fee_to_setter: self.bucket.to_account_info(),
            fee_setter_authority: self.bucket.to_account_info(),
            author_fee_to: self.bucket.to_account_info(),
            issue_authority: self.issue_authority.to_account_info(),
            withdraw_authority: self.withdraw_authority.to_account_info(),
            payer: self.payer.to_account_info(),
            system_program: self.system_program.to_account_info(),
        };

        CpiContext::new(cpi_program, cpi_accounts)
    }
}

impl<'info> Deposit<'info> {
    pub fn into_transfer_token_context(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
        let cpi_program = self.common.token_program.to_account_info();

        let cpi_accounts = Transfer {
            from: self.depositor_collateral.to_account_info(),
            to: self.crate_collateral.to_account_info(),
            authority: self.depositor.to_account_info(),
        };

        CpiContext::new(cpi_program, cpi_accounts)
    }

    pub fn into_issue_reserve_context(&self) -> CpiContext<'_, '_, '_, 'info, Issue<'info>> {
        let cpi_program = self.common.crate_token_program.to_account_info();

        // currently no author/protocol fees, so re-use depositor_reserve
        let cpi_accounts = Issue {
            crate_token: self.common.crate_token.to_account_info(),
            crate_mint: self.common.crate_mint.to_account_info(),
            issue_authority: self.issue_authority.to_account_info(),
            mint_destination: self.depositor_reserve.to_account_info(),
            author_fee_destination: self.depositor_reserve.to_account_info(),
            protocol_fee_destination: self.depositor_reserve.to_account_info(),
            token_program: self.common.token_program.to_account_info(),
        };

        CpiContext::new(cpi_program, cpi_accounts)
    }
}

impl<'info> Redeem<'info> {

    pub fn into_burn_reserve_token_context(&self) -> CpiContext<'_, '_, '_, 'info, Burn<'info>> {
        let cpi_program = self.common.token_program.to_account_info();

        let cpi_accounts = Burn {
            mint: self.common.crate_mint.to_account_info(),
            to: self.withdrawer_reserve.to_account_info(),
            authority: self.withdrawer.to_account_info(),
        };

        CpiContext::new(cpi_program, cpi_accounts)
    }

    pub fn into_withdraw_collateral_context(
        &self,
        asset: RedeemAsset<'info>,
    ) -> CpiContext<'_, '_, '_, 'info, Withdraw<'info>> {
        let cpi_program = self.common.crate_token_program.to_account_info();

        let cpi_accounts = Withdraw {
            crate_token: self.common.crate_token.to_account_info(),
            crate_underlying: asset.crate_collateral.to_account_info(),
            withdraw_authority: self.withdraw_authority.to_account_info(),
            withdraw_destination: asset.withdraw_destination.to_account_info(),
            author_fee_destination: asset.author_fee_destination.to_account_info(),
            protocol_fee_destination: asset.protocol_fee_destination.to_account_info(),
            token_program: self.common.token_program.to_account_info(),
        };

        CpiContext::new(cpi_program, cpi_accounts)
    }
}