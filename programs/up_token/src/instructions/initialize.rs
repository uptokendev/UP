use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, TokenAccount};       // <- use classic token types
use anchor_spl::token_2022::Token2022;              // <- CPIs still via token_2022
use crate::state::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct InitializeArgs {
    pub authority: Pubkey,
    pub dev_wallet: Pubkey,
    pub fee_config: FeeConfig,
    pub epoch_length: i64,
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = payer,
        space = 8 + 288,
        seeds = [b"config"],
        bump
    )]
    pub config: Account<'info, GlobalConfig>,

    #[account(mut)]
    pub payer: Signer<'info>,

    pub mint: Account<'info, Mint>,

    #[account(mut)]
    pub reflection_vault: Account<'info, TokenAccount>,

    #[account(mut)]
    pub hold_pool_vault: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token2022>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<Initialize>, args: InitializeArgs) -> Result<()> {
    let cfg = &mut ctx.accounts.config;

    cfg.authority   = args.authority;
    cfg.mint        = ctx.accounts.mint.key();
    cfg.dev_wallet  = args.dev_wallet;

    cfg.burn_bps        = args.fee_config.burn_bps;
    cfg.dev_bps         = args.fee_config.dev_bps;
    cfg.reflection_bps  = args.fee_config.reflection_bps;
    cfg.hold_pool_bps   = args.fee_config.hold_pool_bps;

    cfg.epoch_length        = if args.epoch_length > 0 { args.epoch_length } else { 604800 };
    cfg.current_epoch_start = Clock::get()?.unix_timestamp;
    cfg.reflection_acc_per_token = 0;
    cfg.enforce_hook = false;

    cfg.bump = ctx.bumps.config;

    let (va, vbump) = Pubkey::find_program_address(&[b"vault", ctx.accounts.mint.key().as_ref()], ctx.program_id);
    cfg.vault_authority = va;
    cfg.vault_bump      = vbump;

    require!(ctx.accounts.reflection_vault.owner == va, crate::errors::UpError::InvalidVaultAuthority);
    require!(ctx.accounts.hold_pool_vault.owner == va, crate::errors::UpError::InvalidVaultAuthority);

    Ok(())
}
