use anchor_lang::prelude::*; use crate::state::*;
#[derive(Accounts)] pub struct SetHookMode<'info>{ #[account(mut, has_one = authority)] pub config: Account<'info, GlobalConfig>, pub authority: Signer<'info> }
pub fn handler(ctx: Context<SetHookMode>, enforce: bool) -> Result<()> { ctx.accounts.config.enforce_hook=enforce; Ok(()) }
