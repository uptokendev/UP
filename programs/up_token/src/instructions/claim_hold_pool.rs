use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, TokenAccount};
use anchor_spl::token_2022::{self, Token2022, TransferChecked};
use crate::state::*;
use crate::errors::UpError;

#[account]
pub struct ClaimMarker {
    pub epoch_id: u64,
    pub wallet: Pubkey,
    pub bump: u8,
}

#[derive(Accounts)]
#[instruction(epoch_id: u64)]
pub struct ClaimHoldPool<'info> {
    #[account(mut)]
    pub config: Account<'info, GlobalConfig>,

    #[account(mut)]
    pub epoch: Account<'info, Epoch>,

    #[account(
        init,
        payer = signer,
        space = 8 + 8 + 32 + 1,
        seeds = [b"claimed", signer.key().as_ref(), &epoch_id.to_le_bytes()],
        bump
    )]
    pub marker: Account<'info, ClaimMarker>,

    #[account(
        mut,
        seeds = [b"holder", signer.key().as_ref()],
        bump = holder_state.bump
    )]
    pub holder_state: Account<'info, HolderState>,

    pub mint: Account<'info, Mint>,

    #[account(mut)]
    pub holder_token: Account<'info, TokenAccount>,

    #[account(mut)]
    pub hold_pool_vault: Account<'info, TokenAccount>,

    #[account(
        seeds = [b"vault", config.mint.as_ref()],
        bump = config.vault_bump
    )]
    /// CHECK: PDA only used as signing authority
    pub vault_authority: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token2022>,
    #[account(mut)]
    pub signer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

fn streak_multiplier(now: i64, start: i64) -> u64 {
    let days = ((now - start) / 86_400).max(0) as i64;
    if days >= 90 { 200 } else if days >= 30 { 150 } else if days >= 7 { 120 } else { 0 }
}

pub fn handler(ctx: Context<ClaimHoldPool>, _epoch_id: u64) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let e = &mut ctx.accounts.epoch;
    let h = &ctx.accounts.holder_state;

    require!(h.last_outgoing_ts < e.epoch_start_ts, UpError::IneligibleForHoldPool);
    require!(h.streak_start_ts <= e.epoch_start_ts - 7 * 86_400, UpError::IneligibleForHoldPool);
    require!(ctx.accounts.holder_token.amount > 0, UpError::IneligibleForHoldPool);

    let mult = streak_multiplier(now, h.streak_start_ts);
    require!(mult > 0, UpError::IneligibleForHoldPool);

    let weight = (ctx.accounts.holder_token.amount as u128) * (mult as u128);
    let remaining = e.remaining_pool as u128;
    let denom = e.total_weight_accumulated
        .checked_add(weight)
        .ok_or(UpError::MathOverflow)?;
    let payout_u128 = remaining
        .checked_mul(weight).ok_or(UpError::MathOverflow)?
        / denom;
    let payout: u64 = payout_u128 as u64;

    if payout > 0 {
        let decimals = ctx.accounts.mint.decimals;

        let seeds: &[&[u8]] = &[
            b"vault",
            ctx.accounts.config.mint.as_ref(),
            &[ctx.accounts.config.vault_bump],
        ];

        let cpi = TransferChecked {
            from: ctx.accounts.hold_pool_vault.to_account_info(),
            mint: ctx.accounts.mint.to_account_info(),
            to:   ctx.accounts.holder_token.to_account_info(),
            authority: ctx.accounts.vault_authority.to_account_info(),
        };

        token_2022::transfer_checked(
            CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi)
                .with_signer(&[seeds]),
            payout,
            decimals,
        )?;
    }

    e.remaining_pool = e.remaining_pool.saturating_sub(payout);
    e.total_weight_accumulated = denom;
    Ok(())
}
