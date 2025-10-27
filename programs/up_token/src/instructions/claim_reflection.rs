<<<<<<< HEAD
use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, TokenAccount};
use anchor_spl::token_2022::{self, Token2022, TransferChecked};
use crate::state::*;

#[derive(Accounts)]
pub struct ClaimReflection<'info> {
    #[account(mut)]
    pub config: Account<'info, GlobalConfig>,

    #[account(
        mut,
        seeds = [b"holder", signer.key().as_ref()],
        bump = holder_state.bump
    )]
    pub holder_state: Account<'info, HolderState>,

    pub mint: Account<'info, Mint>,

    #[account(mut)]
    pub reflection_vault: Account<'info, TokenAccount>,

    #[account(mut)]
    pub holder_token: Account<'info, TokenAccount>,

    #[account(
        seeds = [b"vault", config.mint.as_ref()],
        bump = config.vault_bump
    )]
    /// CHECK: PDA only used as signing authority
    pub vault_authority: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token2022>,
    #[account(mut)]
    pub signer: Signer<'info>,
}

pub fn handler(ctx: Context<ClaimReflection>) -> Result<()> {
    let amount = ctx.accounts.holder_state.unclaimed_reflection;
    if amount == 0 {
        return Ok(());
    }

    let decimals = ctx.accounts.mint.decimals;

    let seeds: &[&[u8]] = &[
        b"vault",
        ctx.accounts.config.mint.as_ref(),
        &[ctx.accounts.config.vault_bump],
    ];

    let cpi_accounts = TransferChecked {
        from: ctx.accounts.reflection_vault.to_account_info(),
        mint: ctx.accounts.mint.to_account_info(),
        to:   ctx.accounts.holder_token.to_account_info(),
        authority: ctx.accounts.vault_authority.to_account_info(),
    };

    token_2022::transfer_checked(
        CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_accounts)
            .with_signer(&[seeds]),
        amount,
        decimals,
    )?;

    ctx.accounts.holder_state.unclaimed_reflection = 0;
    Ok(())
}
=======
use anchor_lang::prelude::*; use anchor_spl::token::{self, Token, TokenAccount, Transfer}; use crate::state::*;
#[derive(Accounts)] pub struct ClaimReflection<'info>{ #[account(mut)] pub config: Account<'info, GlobalConfig>, #[account(mut, seeds=[b"holder", signer.key().as_ref()], bump=holder_state.bump)] pub holder_state: Account<'info, HolderState>, #[account(mut)] pub reflection_vault: Account<'info, TokenAccount>, #[account(mut)] pub holder_token: Account<'info, TokenAccount>, pub token_program: Program<'info, Token>, #[account(mut)] pub signer: Signer<'info> }
pub fn handler(ctx: Context<ClaimReflection>) -> Result<()> { let amount=ctx.accounts.holder_state.unclaimed_reflection; if amount==0{return Ok(());} let cpi=Transfer{ from: ctx.accounts.reflection_vault.to_account_info(), to: ctx.accounts.holder_token.to_account_info(), authority: ctx.accounts.signer.to_account_info() }; token::transfer(CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi), amount)?; Ok(()) }
>>>>>>> 1b3568e9557a0d186e14cc8b4511fe3aaf270877
