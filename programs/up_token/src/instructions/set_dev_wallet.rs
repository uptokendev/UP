use anchor_lang::prelude::*; use crate::state::*;
#[derive(Accounts)] pub struct SetDevWallet<'info>{ #[account(mut, has_one = authority)] pub config: Account<'info, GlobalConfig>, pub authority: Signer<'info> }
pub fn handler(ctx: Context<SetDevWallet>, new_dev: Pubkey) -> Result<()> { ctx.accounts.config.dev_wallet=new_dev; Ok(()) }
