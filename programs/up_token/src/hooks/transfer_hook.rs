use anchor_lang::prelude::*;
use anchor_spl::token::TokenAccount;
use crate::events::TransferHookObserved;
use crate::state::GlobalConfig;
use crate::errors::UpError;

#[derive(Accounts)]
pub struct OnTransfer<'info> {
    pub from_token: Account<'info, TokenAccount>,
    pub to_token: Account<'info, TokenAccount>,
    #[account(mut, seeds=[b"config"], bump = config.bump)]
    pub config: Account<'info, GlobalConfig>,
    // remaining_accounts[0] expected to be auth PDA when enforcement is ON
}

pub fn handler(ctx: Context<OnTransfer>, amount: u64) -> Result<()> {
    let cfg=&ctx.accounts.config;
    if cfg.enforce_hook {
        require_keys_eq!(ctx.accounts.from_token.mint, cfg.mint, UpError::TransferBlocked);
        let (expected,_)=Pubkey::find_program_address(&[b"auth"], ctx.program_id);
        let actual = ctx.remaining_accounts.get(0).ok_or(UpError::TransferBlocked)?;
        require_keys_eq!(actual.key(), expected, UpError::TransferBlocked);
    }
    emit!(TransferHookObserved{ from: ctx.accounts.from_token.owner, to: ctx.accounts.to_token.owner, amount });
    Ok(())
}
