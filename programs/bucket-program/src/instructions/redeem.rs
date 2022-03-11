use {
    crate::{
        constant::WITHDRAW_SEED,
        context::{Redeem, RedeemAsset},
        error::ErrorCode,
    },
    anchor_lang::{prelude::*, solana_program::account_info::next_account_infos},
    anchor_spl::token::burn,
    crate_token::cpi::withdraw,
    num_traits::cast::ToPrimitive,
    vipers::{invariant, unwrap_int},
};

pub fn handle<'info>(
    ctx: Context<'_, '_, '_, 'info, Redeem<'info>>,
    redeem_amount: u64,
) -> ProgramResult {
    require!(
        ctx.accounts.common.bucket.crate_mint.key() == ctx.accounts.withdrawer_reserve.mint.key(),
        ErrorCode::WrongBurnError
    );

    burn(
        ctx.accounts.into_burn_reserve_token_context(),
        redeem_amount,
    )?;

    // remaining accounts are ATAs to assist in the collateral fanout distribution
    let num_remaining_accounts = ctx.remaining_accounts.len();

    invariant!(
        num_remaining_accounts % 5 == 0,
        "must have even number of tokens"
    );

    // prematurely return if there is no collateral to distribute
    if num_remaining_accounts == 0 {
        return Ok(());
    }
    let remaining_accounts_iter = &mut ctx.remaining_accounts.iter();
    let withdraw_authority_signer_seeds: &[&[&[u8]]] = &[&[
        WITHDRAW_SEED.as_bytes(),
        &[ctx.accounts.withdraw_authority.bump],
    ]];

    let num_tokens = unwrap_int!(num_remaining_accounts.checked_div(5));
    for _i in 0..num_tokens {
        // none of these accounts need to be validated further, since
        // [crate_token::cpi::withdraw] already handles it.
        let asset: RedeemAsset = Accounts::try_accounts(
            &crate::ID,
            &mut next_account_infos(remaining_accounts_iter, 5)?,
            &[],
        )?;

        // compute an equal share of each collateral based on each's supply. over time,
        // this piece of logic will become increasingly complex to account for select
        // token fanouts and varying prices of the collateral.
        let share: u64 = unwrap_int!((asset.crate_collateral.amount as i128)
            .checked_mul(redeem_amount as i128)
            .and_then(|num| num.checked_div(ctx.accounts.common.crate_mint.supply.into()))
            .and_then(|num| num.to_u64()));

        withdraw(
            ctx.accounts
                .into_withdraw_collateral_context(asset)
                .with_signer(withdraw_authority_signer_seeds),
            share,
        )?;
    }

    Ok(())
}
