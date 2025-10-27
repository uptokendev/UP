use anchor_lang::prelude::*;
use anchor_spl::token::TokenAccount;
use anchor_spl::token_2022::Token2022;
use crate::state::*;
use crate::errors::UpError;
use crate::helpers::maybe_roll_epoch;

#[derive(Accounts)]
pub struct StartNextEpoch<'info> {
    #[account(mut)]
    pub config: Account<'info, GlobalConfig>,

    #[account(mut)]
    pub hold_pool_vault: Account<'info, TokenAccount>,

    #[account(mut)]
    pub payer: Signer<'info>,

    pub token_program: Program<'info, Token2022>,
    pub system_program: Program<'info, System>,

    /// CHECK: PDA to (re)initialize; verified in helper by seeds
    #[account(mut)]
    pub epoch: UncheckedAccount<'info>,
}

pub fn handler(ctx: Context<StartNextEpoch>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    require!(now >= ctx.accounts.config.current_epoch_start + ctx.accounts.config.epoch_length, UpError::EpochNotReady);

    maybe_roll_epoch(
        ctx.program_id,
        &mut ctx.accounts.config,
        &ctx.accounts.hold_pool_vault,
        &ctx.accounts.payer,
        &ctx.accounts.epoch.to_account_info(),
        &ctx.accounts.system_program,
    )
}
