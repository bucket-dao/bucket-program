use {
    crate::{
        constant::{BUCKET_SEED, ISSUE_SEED, WITHDRAW_SEED},
        state::{
            bucket::{Bucket, BUCKET_ACCOUNT_SPACE},
            issue_authority::IssueAuthority,
            withdraw_authority::WithdrawAuthority,
        },
    },
    anchor_lang::prelude::*,
    anchor_spl::token::{Burn, Mint, Token, TokenAccount, Transfer},
    crate_token::cpi::accounts::{Issue, NewCrate, Withdraw},
    stable_swap_anchor::{Swap, SwapOutput, SwapToken, SwapUserContext},
};

/// ============================================================
/// RESTRICTED INSTRUCTIONS
/// 
/// these are instructions that can only be called by some
/// pre-defined entity. most can are restricted to the bucket's
/// authority. however, there will be some exceptions, e.g.
/// rebalance can only be called by the rebalance_authority.
/// ============================================================

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
            BUCKET_SEED.as_bytes(),
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
            ISSUE_SEED.as_bytes(),
        ],
        bump,
        payer = payer
    )]
    pub issue_authority: Account<'info, IssueAuthority>,

    /// entity with authority to withdraw tokens from crate ATAs
    #[account(
        init,
        seeds = [
            WITHDRAW_SEED.as_bytes(),
        ],
        bump,
        payer = payer
    )]
    pub withdraw_authority: Account<'info, WithdrawAuthority>,

    /// Account that has authority to invoke rebalance instruction
    /// CHECK: unsafe account type, we don't read from or write to.
    pub rebalance_authority: AccountInfo<'info>,

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
pub struct UpdateRebalanceAuthority<'info> {
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [
            BUCKET_SEED.as_bytes(),
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
pub struct AuthorizedUpdate<'info> {
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [
            BUCKET_SEED.as_bytes(),
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
pub struct Rebalance<'info> {
    #[account(
        mut,
        constraint = payer.key() == bucket.rebalance_authority.key()
    )]
    pub payer: Signer<'info>,

    #[account(
        mut,
        seeds = [
            BUCKET_SEED.as_bytes(),
            crate_token.key().to_bytes().as_ref()
        ],
        bump,
    )]
    pub bucket: Account<'info, Bucket>,

    /// CHECK: unused. used in PDA derivation.
    pub crate_token: UncheckedAccount<'info>,

    #[account(
        seeds = [
            WITHDRAW_SEED.as_bytes(),
        ],
        bump,
    )]
    pub withdraw_authority: Box<Account<'info, WithdrawAuthority>>,

    /// =============== CPI ACCOUNTS BELOW ===============
    /// saber stable swap program
    /// CHECK: verified via CPI call for saber swap.
    pub swap: UncheckedAccount<'info>,

    /// The authority of the swap.
    /// CHECK: verified via CPI call for saber swap.
    pub swap_authority: UncheckedAccount<'info>,

    /// The authority of the user.
    /// CHECK: verified via CPI call for saber swap.
    #[account(mut)]
    pub user_authority: UncheckedAccount<'info>,

    /// The token account for the pool's reserves of this token.
    #[account(mut)]
    pub input_a_reserve: Account<'info, TokenAccount>,

    /// The token account for the pool's reserves of this token.
    #[account(mut)]
    pub output_b_reserve: Account<'info, TokenAccount>,

    /// The token account for the fees associated with the token.
    /// CHECK: verified via CPI call for saber swap.
    #[account(mut)]
    pub output_b_fees: UncheckedAccount<'info>,

    /// The pool mint of the swap.
    /// CHECK: verified via CPI call for saber swap.
    #[account(mut)]
    pub pool_mint: UncheckedAccount<'info>,

    /// =============== PROGRAM ACCOUNTS ===============
    /// The crate_token program.
    pub crate_token_program: Program<'info, crate_token::program::CrateToken>,

    /// CHECK: verified via CPI call for saber swap.
    pub saber_program: UncheckedAccount<'info>,

    /// The spl_token program.
    pub token_program: Program<'info, Token>,
}

/// ============================================================
/// UNRESTRICTED INSTRUCTIONS
/// 
/// these are instructions that can only be called by anyone,
/// unlike the restricted instructions above. the calling entity
/// must sign and will also pay for any related fees. thus, these
/// instructions presuppose some sort of value, otherwise users
/// would not be encouraged to pay fees.
/// ============================================================

#[derive(Accounts)]
pub struct Deposit<'info> {
    pub depositor: Signer<'info>,

    pub common: Common<'info>,

    #[account(
        seeds = [
            ISSUE_SEED.as_bytes(),
        ],
        bump,
    )]
    pub issue_authority: Box<Account<'info, IssueAuthority>>,

    #[account(
        mut,
        constraint = crate_collateral.mint == collateral_mint.key(),
        constraint = crate_collateral.owner == common.crate_token.key()
    )]
    pub crate_collateral: Box<Account<'info, TokenAccount>>,

    pub collateral_mint: Account<'info, Mint>,

    #[account(
        mut,
        constraint = depositor_collateral.mint == collateral_mint.key(),
        constraint = depositor_collateral.owner == depositor.key()
    )]
    pub depositor_collateral: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        constraint = depositor_collateral.owner == depositor.key(),
        constraint = depositor_reserve.mint == common.crate_mint.key(),
    )]
    pub depositor_reserve: Box<Account<'info, TokenAccount>>,

    /// CHECK: required for CPI into pyth
    pub oracle: AccountInfo<'info>,
}

#[derive(Accounts)]
pub struct Redeem<'info> {
    pub withdrawer: Signer<'info>,

    pub common: Common<'info>,

    #[account(
        seeds = [
            WITHDRAW_SEED.as_bytes(),
        ],
        bump,
    )]
    pub withdraw_authority: Box<Account<'info, WithdrawAuthority>>,

    #[account(
        mut,
        constraint = withdrawer_reserve.owner == withdrawer.key(),
        constraint = withdrawer_reserve.mint == common.crate_mint.key(),
    )]
    pub withdrawer_reserve: Box<Account<'info, TokenAccount>>,

    /// CHECK: required for CPI into pyth
    pub oracle: AccountInfo<'info>,
}

#[derive(Accounts)]
pub struct Common<'info> {
    #[account(
        seeds = [
            BUCKET_SEED.as_bytes(),
            crate_token.key().to_bytes().as_ref()
        ],
        bump,
    )]
    pub bucket: Account<'info, Bucket>,

    /// CHECK: unsafe account type, required for CPI invocation.
    pub crate_token: UncheckedAccount<'info>,

    #[account(
        mut,
        constraint = crate_mint.freeze_authority.unwrap() == crate_token.key(),
        constraint = crate_mint.mint_authority.unwrap() == crate_token.key(),
    )]
    pub crate_mint: Account<'info, Mint>,

    pub crate_token_program: Program<'info, crate_token::program::CrateToken>,

    pub system_program: Program<'info, System>,

    pub token_program: Program<'info, Token>,
}

// =====================================================
// META CONTEXT; TRANSFORMATIONS DONE JIT IN INSTRUCTION
// =====================================================

#[derive(Accounts)]
pub struct RedeemAsset<'info> {
    /// Mint of the collateral to redeem
    pub collateral_mint: Account<'info, Mint>,

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

#[derive(Accounts)]
pub struct RebalanceAsset<'info> {
    #[account(mut)]
    pub crate_source_ata: Box<Account<'info, TokenAccount>>,

    #[account(mut)]
    pub bucket_source_ata: Box<Account<'info, TokenAccount>>,

    #[account(mut)]
    pub crate_dest_ata: Box<Account<'info, TokenAccount>>,

    #[account(mut)]
    pub bucket_dest_ata: Box<Account<'info, TokenAccount>>,
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
            /// source ATA
            from: self.depositor_collateral.to_account_info(),
            /// destination ATA
            to: self.crate_collateral.to_account_info(),
            /// entity authorizing transfer. owner of source ATA
            authority: self.depositor.to_account_info(),
        };

        CpiContext::new(cpi_program, cpi_accounts)
    }

    pub fn into_issue_reserve_context(&self) -> CpiContext<'_, '_, '_, 'info, Issue<'info>> {
        let cpi_program = self.common.crate_token_program.to_account_info();

        // currently no author/protocol fees, so re-use depositor_reserve
        let cpi_accounts = Issue {
            /// crate protocol PDA
            crate_token: self.common.crate_token.to_account_info(),
            /// crate reserve mint account
            crate_mint: self.common.crate_mint.to_account_info(),
            /// entity with authority to issue new crate_mint
            issue_authority: self.issue_authority.to_account_info(),
            /// ATA to which authority should request token issuance
            mint_destination: self.depositor_reserve.to_account_info(),
            /// author fee ATA, if any
            author_fee_destination: self.depositor_reserve.to_account_info(),
            /// protocol fee ATA, if any
            protocol_fee_destination: self.depositor_reserve.to_account_info(),
            /// solana token program
            token_program: self.common.token_program.to_account_info(),
        };

        CpiContext::new(cpi_program, cpi_accounts)
    }
}

impl<'info> Redeem<'info> {
    pub fn into_burn_reserve_token_context(&self) -> CpiContext<'_, '_, '_, 'info, Burn<'info>> {
        let cpi_program = self.common.token_program.to_account_info();

        let cpi_accounts = Burn {
            /// crate reserve mint account
            mint: self.common.crate_mint.to_account_info(),
            /// entity ATA containing reserve mint
            to: self.withdrawer_reserve.to_account_info(),
            /// entity redeeming underlying collateral must sign the tx to burn tokens of the reserve mint
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
            /// crate protocol PDA
            crate_token: self.common.crate_token.to_account_info(),
            /// crate collateral ATA
            crate_underlying: asset.crate_collateral.to_account_info(),
            /// entity with authority to withdraw collateral from a crate ATA
            withdraw_authority: self.withdraw_authority.to_account_info(),
            /// withdrawal requester ATA
            withdraw_destination: asset.withdraw_destination.to_account_info(),
            /// author fee ATA, if any
            author_fee_destination: asset.author_fee_destination.to_account_info(),
            /// protocol fee ATA, if any
            protocol_fee_destination: asset.protocol_fee_destination.to_account_info(),
            /// solana token program
            token_program: self.common.token_program.to_account_info(),
        };

        CpiContext::new(cpi_program, cpi_accounts)
    }
}

impl<'info> Rebalance<'info> {
    // withdraw from a crate ATA to a bucket ATA
    pub fn into_withdraw_collateral_context(
        &self,
        asset: &RebalanceAsset<'info>,
    ) -> CpiContext<'_, '_, '_, 'info, Withdraw<'info>> {
        let cpi_program = self.crate_token_program.to_account_info();

        let cpi_accounts = Withdraw {
            /// crate protocol PDA
            crate_token: self.crate_token.to_account_info(),
            /// crate collateral ATA
            crate_underlying: asset.crate_source_ata.to_account_info(),
            /// entity with authority to withdraw collateral from a crate ATA
            withdraw_authority: self.withdraw_authority.to_account_info(),
            /// bucket collateral ATA
            withdraw_destination: asset.bucket_source_ata.to_account_info(),
            /// n/a in this ixn
            author_fee_destination: asset.bucket_source_ata.to_account_info(),
            /// n/a in this ixn
            protocol_fee_destination: asset.bucket_source_ata.to_account_info(),
            token_program: self.token_program.to_account_info(),
        };

        CpiContext::new(cpi_program, cpi_accounts)
    }

    // swap from bucket ATA for token A to bucket ATA for token B. bucket will sign the transaction.
    pub fn into_saber_swap_context(
        &self,
        asset: &RebalanceAsset<'info>,
    ) -> CpiContext<'_, '_, '_, 'info, Swap<'info>> {
        let cpi_program = self.saber_program.to_account_info();

        let cpi_accounts = Swap {
            user: SwapUserContext {
                /// The spl_token program.
                token_program: self.token_program.to_account_info(),
                /// The authority of the swap.
                swap_authority: self.swap_authority.to_account_info(),
                /// The authority of the user.
                user_authority: self.bucket.to_account_info(),
                /// The swap --> is this the pool?
                swap: self.swap.to_account_info(),
            },
            input: SwapToken {
                /// The token account associated with the swap requester's source ATA
                user: asset.bucket_source_ata.to_account_info(),
                /// The token account for the pool’s reserves of this token.
                reserve: self.input_a_reserve.to_account_info(),
            },
            output: SwapOutput {
                // The token accounts of the user and the token.
                user_token: SwapToken {
                    /// The token account associated with the swap requester's source ATA
                    user: asset.bucket_dest_ata.to_account_info(),
                    /// The token account for the pool’s reserves of this token.
                    reserve: self.output_b_reserve.to_account_info(),
                },
                // The token account for the fees associated with the token.
                fees: self.output_b_fees.to_account_info(),
            },
        };

        CpiContext::new(cpi_program, cpi_accounts)
    }

    pub fn into_transfer_token_context(
        &self,
        asset: &RebalanceAsset<'info>,
    ) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
        let cpi_program = self.token_program.to_account_info();

        let cpi_accounts = Transfer {
            /// source ATA => bucket ATA
            from: asset.bucket_dest_ata.to_account_info(),
            /// destination ATA => crate ATA
            to: asset.crate_dest_ata.to_account_info(),
            /// entity authorizing transfer. owner of source ATA.
            authority: self.bucket.to_account_info(),
        };

        CpiContext::new(cpi_program, cpi_accounts)
    }
}
