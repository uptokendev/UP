use anchor_lang::prelude::*;
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
}
