use anchor_lang::prelude::*; use crate::state::*; use crate::errors::UpError;
#[derive(Accounts)] pub struct SetFees<'info>{ #[account(mut, has_one = authority)] pub config: Account<'info, GlobalConfig>, pub authority: Signer<'info> }
pub fn handler(ctx: Context<SetFees>, fees: FeeConfig) -> Result<()> {
    let total=fees.burn_bps as u32 + fees.dev_bps as u32 + fees.reflection_bps as u32 + fees.hold_pool_bps as u32; require!(total<=350, UpError::InvalidFeeConfig);
    let c=&mut ctx.accounts.config; c.burn_bps=fees.burn_bps; c.dev_bps=fees.dev_bps; c.reflection_bps=fees.reflection_bps; c.hold_pool_bps=fees.hold_pool_bps; Ok(()) }
