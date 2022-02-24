use {crate::context::Deposit, crate::error::ErrorCode, anchor_lang::prelude::*};

pub fn handle(ctx: Context<Deposit>, deposit_amount: u64) -> ProgramResult {
    let wl = &ctx.accounts.bucket.whitelist;

    require!(
        wl.contains(&ctx.accounts.depositor_source.mint.key()),
        ErrorCode::WrongCollateralError
    );
    
    // transfer tokens to the bucket
    anchor_spl::token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            anchor_spl::token::Transfer {
                from: ctx.accounts.depositor_source.to_account_info(),
                to: ctx.accounts.collateral_reserve.to_account_info(),
                authority: ctx.accounts.depositor.to_account_info(),
            },
        ),
        deposit_amount,
    )?;

    // let issue_authority_signer_seeds: &[&[&[u8]]] =
    //     &[&[b"issue".as_ref(), &[ctx.accounts.issue_authority.bump]]];

    msg!("biÖ {}", ctx.accounts.issue_authority.bump);
    let seeds = &[b"issue".as_ref(), &[ctx.accounts.issue_authority.bump]];
    // issue new crate tokens
    crate_token::cpi::issue(
        CpiContext::new(
            ctx.accounts.crate_token_program.to_account_info(),
            crate_token::cpi::accounts::Issue {
                crate_token: ctx.accounts.crate_token.to_account_info(),
                crate_mint: ctx.accounts.crate_mint.to_account_info(),
                issue_authority: ctx.accounts.issue_authority.to_account_info(),
                mint_destination: ctx.accounts.mint_destination.to_account_info(),

                // there are no author/protocol fees, so we pass in garbage here
                author_fee_destination: ctx.accounts.mint_destination.to_account_info(),
                protocol_fee_destination: ctx.accounts.mint_destination.to_account_info(),

                token_program: ctx.accounts.token_program.to_account_info(),
            },
        ).with_signer(&[seeds]),
        // 1-1 conversion for now, devs pls do something
        deposit_amount,
    )?;
    Ok(())
}
