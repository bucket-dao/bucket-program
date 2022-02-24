use {
    crate::context::{Redeem, RedeemAsset},
    crate::error::ErrorCode,
    anchor_lang::prelude::*,
    anchor_lang::solana_program::account_info::next_account_infos,
    num_traits::cast::ToPrimitive,
    vipers::{invariant, unwrap_int},
};

pub fn handle<'info>(
    ctx: Context<'_, '_, '_, 'info, Redeem<'info>>,
    redeem_amount: u64,
) -> ProgramResult {
    let bm = &ctx.accounts.bucket.crate_mint;
    require!(
        bm == &ctx.accounts.withdrawer_source.mint.key(),
        ErrorCode::WrongBurnError
    );

    // Burn the $BUCKET.
    anchor_spl::token::burn(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            anchor_spl::token::Burn {
                mint: ctx.accounts.crate_mint.to_account_info(),
                to: ctx.accounts.withdrawer_source.to_account_info(),
                authority: ctx.accounts.withdrawer.to_account_info(),
            },
        ),
        redeem_amount,
    )?;

    let withdraw_authority_signer_seeds: &[&[&[u8]]] =
        &[&[b"withdraw", &[ctx.accounts.withdraw_authority.bump]]];

    // calculate the fractional slice of each account
    let num_remaining_accounts = ctx.remaining_accounts.len();
    if num_remaining_accounts == 0 {
        return Ok(());
    }
    invariant!(
        num_remaining_accounts % 4 == 0,
        "must have even number of tokens"
    );
    let num_tokens = unwrap_int!(num_remaining_accounts.checked_div(4));
    // TODO: add check to make sure every single token in the crate was redeemed

    let remaining_accounts_iter = &mut ctx.remaining_accounts.iter();

    for _i in 0..num_tokens {
        // none of these accounts need to be validated further, since
        // [crate_token::cpi::withdraw] already handles it.
        let asset: RedeemAsset = Accounts::try_accounts(
            &crate::ID,
            &mut next_account_infos(remaining_accounts_iter, 4)?,
            &[],
        )?;

        let share: u64 = unwrap_int!((asset.crate_underlying.amount as u128)
            .checked_mul(redeem_amount.into())
            .and_then(|num| num.checked_div(ctx.accounts.crate_mint.supply.into()))
            .and_then(|num| num.to_u64()));

        crate_token::cpi::withdraw(
            CpiContext::new_with_signer(
                ctx.accounts.crate_token_program.to_account_info(),
                crate_token::cpi::accounts::Withdraw {
                    crate_token: ctx.accounts.crate_token.to_account_info(),
                    crate_underlying: asset.crate_underlying.to_account_info(),
                    withdraw_authority: ctx.accounts.withdraw_authority.to_account_info(),
                    withdraw_destination: asset.withdraw_destination.to_account_info(),
                    author_fee_destination: asset.author_fee_destination.to_account_info(),
                    protocol_fee_destination: asset.protocol_fee_destination.to_account_info(),
                    token_program: ctx.accounts.token_program.to_account_info(),
                },
                withdraw_authority_signer_seeds,
            ),
            share,
        )?;
    }

    Ok(())
}
