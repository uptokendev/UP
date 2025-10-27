use anchor_lang::prelude::*;
<<<<<<< HEAD
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
=======
use anchor_spl::token::{Token, TokenAccount};
use crate::state::*;
use crate::errors::UpError;

#[derive(Accounts)]
pub struct StartNextEpoch<'info> {
    #[account(mut)] pub config: Account<'info, GlobalConfig>,
    #[account(init, payer = payer, space = EPOCH_SPACE, seeds=[b"epoch", &(((config.current_epoch_start as u64)/(config.epoch_length as u64) + 1).to_le_bytes())], bump)] pub epoch: Account<'info, Epoch>,
    #[account(mut)] pub hold_pool_vault: Account<'info, TokenAccount>,
    #[account(mut)] pub payer: Signer<'info>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<StartNextEpoch>) -> Result<()> {
    let now=Clock::get()?.unix_timestamp; let cfg=&mut ctx.accounts.config;
    require!(now>=cfg.current_epoch_start+cfg.epoch_length, UpError::EpochNotReady);
    let epoch_id=(cfg.current_epoch_start as u64)/(cfg.epoch_length as u64)+1;
    let pool_amount=ctx.accounts.hold_pool_vault.amount;
    let e=&mut ctx.accounts.epoch;
    e.epoch_id=epoch_id; e.epoch_start_ts=now; e.pool_amount=pool_amount; e.remaining_pool=pool_amount; e.total_weight_accumulated=0; e.bump=*ctx.bumps.get("epoch").unwrap();
    cfg.current_epoch_start=now; Ok(())
>>>>>>> 1b3568e9557a0d186e14cc8b4511fe3aaf270877
}
