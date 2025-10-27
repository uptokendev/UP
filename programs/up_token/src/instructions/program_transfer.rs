<<<<<<< HEAD
use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, TokenAccount};
use anchor_spl::token_2022::{self, Token2022, TransferChecked, BurnChecked};
use crate::state::*;
use crate::errors::UpError;
use crate::events::*;

fn settle_reflection_for_holder(holder: &mut HolderState, acc: u128, bal: u64) -> Result<()> {
    let cur = (bal as u128).checked_mul(acc).ok_or(UpError::MathOverflow)?;
    if cur >= holder.reflection_debt {
        let delta = cur - holder.reflection_debt;
        holder.unclaimed_reflection = holder
            .unclaimed_reflection
            .saturating_add((delta / ACC_PRECISION) as u64);
    }
    holder.reflection_debt = cur;
    Ok(())
}

#[derive(Accounts)]
pub struct ProgramTransfer<'info> {
    #[account(mut)]
    pub config: Account<'info, GlobalConfig>,

    #[account(mut)]
    pub mint: Account<'info, Mint>,

    #[account(mut)]
    pub from_token: Account<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer = signer,
        space = 8 + 200,
        seeds = [b"holder", signer.key().as_ref()],
        bump
    )]
    pub from_holder_state: Account<'info, HolderState>,

    #[account(mut)]
    pub to_token: Account<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer = signer,
        space = 8 + 200,
        seeds = [b"holder", to_token.owner.as_ref()],
        bump
    )]
    pub to_holder_state: Account<'info, HolderState>,

    #[account(mut)]
    pub dev_token: Account<'info, TokenAccount>,
    #[account(mut)]
    pub reflection_vault: Account<'info, TokenAccount>,
    #[account(mut)]
    pub hold_pool_vault: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token2022>,
    #[account(mut)]
    pub signer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<ProgramTransfer>, amount: u64) -> Result<()> {
    let cfg = &mut ctx.accounts.config;
    let dec = ctx.accounts.mint.decimals;

    let burn = amount.saturating_mul(cfg.burn_bps as u64) / 10_000;
    let dev  = amount.saturating_mul(cfg.dev_bps  as u64) / 10_000;
    let refl = amount.saturating_mul(cfg.reflection_bps as u64) / 10_000;
    let pool = amount.saturating_mul(cfg.hold_pool_bps  as u64) / 10_000;
    let total_fee = burn + dev + refl + pool;

    require!(
        (cfg.burn_bps as u32 + cfg.dev_bps as u32 + cfg.reflection_bps as u32 + cfg.hold_pool_bps as u32) <= 350,
        UpError::InvalidFeeConfig
    );
    require!(amount > total_fee, UpError::MathOverflow);

    let net = amount - total_fee;

    let from_pre = ctx.accounts.from_token.amount;
    let to_pre   = ctx.accounts.to_token.amount;
    settle_reflection_for_holder(&mut ctx.accounts.from_holder_state, cfg.reflection_acc_per_token, from_pre)?;
    settle_reflection_for_holder(&mut ctx.accounts.to_holder_state,   cfg.reflection_acc_per_token, to_pre)?;

    if burn > 0 {
        let cpi = BurnChecked {
            mint: ctx.accounts.mint.to_account_info(),
            from: ctx.accounts.from_token.to_account_info(),
            authority: ctx.accounts.signer.to_account_info(),
        };
        token_2022::burn_checked(
            CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi),
            burn,
            dec,
        )?;
    }

    if dev > 0 {
        let cpi = TransferChecked {
            from: ctx.accounts.from_token.to_account_info(),
            mint: ctx.accounts.mint.to_account_info(),
            to:   ctx.accounts.dev_token.to_account_info(),
            authority: ctx.accounts.signer.to_account_info(),
        };
        token_2022::transfer_checked(
            CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi),
            dev,
            dec,
        )?;
    }

    if refl > 0 {
        let cpi = TransferChecked {
            from: ctx.accounts.from_token.to_account_info(),
            mint: ctx.accounts.mint.to_account_info(),
            to:   ctx.accounts.reflection_vault.to_account_info(),
            authority: ctx.accounts.signer.to_account_info(),
        };
        token_2022::transfer_checked(
            CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi),
            refl,
            dec,
        )?;
    }

    if pool > 0 {
        let cpi = TransferChecked {
            from: ctx.accounts.from_token.to_account_info(),
            mint: ctx.accounts.mint.to_account_info(),
            to:   ctx.accounts.hold_pool_vault.to_account_info(),
            authority: ctx.accounts.signer.to_account_info(),
        };
        token_2022::transfer_checked(
            CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi),
            pool,
            dec,
        )?;
    }

    {
        let cpi = TransferChecked {
            from: ctx.accounts.from_token.to_account_info(),
            mint: ctx.accounts.mint.to_account_info(),
            to:   ctx.accounts.to_token.to_account_info(),
            authority: ctx.accounts.signer.to_account_info(),
        };
        token_2022::transfer_checked(
            CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi),
            net,
            dec,
        )?;
    }

    let total_supply = ctx.accounts.mint.supply;
    let excluded = ctx.accounts.reflection_vault.amount.saturating_add(ctx.accounts.hold_pool_vault.amount);
    let effective = total_supply.saturating_sub(excluded);
    require!(effective > 0, UpError::ZeroEffectiveSupply);

    if refl > 0 {
        let add = (refl as u128) * ACC_PRECISION / (effective as u128);
        cfg.reflection_acc_per_token = cfg.reflection_acc_per_token.checked_add(add).ok_or(UpError::MathOverflow)?;
        emit!(ReflectionAccrued { refl_added: refl, acc_per_token: cfg.reflection_acc_per_token });
    }

    let now = Clock::get()?.unix_timestamp;
    ctx.accounts.from_holder_state.last_outgoing_ts = now;
    ctx.accounts.from_holder_state.streak_start_ts  = now;

    if ctx.accounts.to_holder_state.wallet == Pubkey::default() {
        ctx.accounts.to_holder_state.wallet = ctx.accounts.to_token.owner;
    }

    Ok(())
}
=======
use anchor_lang::prelude::*; use anchor_spl::token::{self, Token, TokenAccount, Transfer, Burn, Mint}; use crate::state::*; use crate::errors::UpError; use crate::events::*; use crate::helpers::maybe_roll_epoch;
fn settle_reflection_for(acc:u128, bal:u64, debt:&mut u128, unclaimed:&mut u64)->Result<()> { let cur=(bal as u128).checked_mul(acc).ok_or(UpError::MathOverflow)?; if cur>=*debt{ let delta=cur-*debt; *unclaimed=unclaimed.saturating_add((delta/ACC_PRECISION) as u64); } *debt=cur; Ok(()) }
#[derive(Accounts)] pub struct ProgramTransfer<'info>{ #[account(mut)] pub config: Account<'info, GlobalConfig>, #[account(mut)] pub mint: Account<'info, Mint>, #[account(mut)] pub from_token: Account<'info, TokenAccount>, #[account(init_if_needed, payer = signer, space = 8 + 200, seeds=[b"holder", signer.key().as_ref()], bump)] pub from_holder_state: Account<'info, HolderState>, #[account(mut)] pub to_token: Account<'info, TokenAccount>, #[account(init_if_needed, payer = signer, space = 8 + 200, seeds=[b"holder", to_token.owner.as_ref()], bump)] pub to_holder_state: Account<'info, HolderState>, #[account(mut)] pub dev_token: Account<'info, TokenAccount>, #[account(mut)] pub reflection_vault: Account<'info, TokenAccount>, #[account(mut)] pub hold_pool_vault: Account<'info, TokenAccount>, pub token_program: Program<'info, Token>, #[account(mut)] pub signer: Signer<'info>, pub system_program: Program<'info, System> }
pub fn handler(ctx: Context<ProgramTransfer>, amount:u64)->Result<()> {
    if let Some(epoch_ai)=ctx.remaining_accounts.get(0){ let _=maybe_roll_epoch(ctx.program_id,&mut ctx.accounts.config,&ctx.accounts.hold_pool_vault,&ctx.accounts.signer,epoch_ai,&ctx.accounts.system_program); }
    let cfg=&mut ctx.accounts.config; let burn=amount.saturating_mul(cfg.burn_bps as u64)/10_000; let dev=amount.saturating_mul(cfg.dev_bps as u64)/10_000; let refl=amount.saturating_mul(cfg.reflection_bps as u64)/10_000; let pool=amount.saturating_mul(cfg.hold_pool_bps as u64)/10_000; let total_fee=burn+dev+refl+pool;
    require!(cfg.burn_bps as u32 + cfg.dev_bps as u32 + cfg.reflection_bps as u32 + cfg.hold_pool_bps as u32 <= 350, UpError::InvalidFeeConfig); require!(amount>total_fee, UpError::MathOverflow);
    let net=amount-total_fee; let from_pre=ctx.accounts.from_token.amount; let to_pre=ctx.accounts.to_token.amount;
    settle_reflection_for(cfg.reflection_acc_per_token, from_pre, &mut ctx.accounts.from_holder_state.reflection_debt, &mut ctx.accounts.from_holder_state.unclaimed_reflection)?;
    settle_reflection_for(cfg.reflection_acc_per_token, to_pre, &mut ctx.accounts.to_holder_state.reflection_debt, &mut ctx.accounts.to_holder_state.unclaimed_reflection)?;
    if burn>0{ let cpi=Burn{ mint: ctx.accounts.mint.to_account_info(), from: ctx.accounts.from_token.to_account_info(), authority: ctx.accounts.signer.to_account_info() }; token::burn(CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi), burn)?; }
    if dev>0{ let cpi=Transfer{ from: ctx.accounts.from_token.to_account_info(), to: ctx.accounts.dev_token.to_account_info(), authority: ctx.accounts.signer.to_account_info() }; token::transfer(CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi), dev)?; }
    if refl>0{ let cpi=Transfer{ from: ctx.accounts.from_token.to_account_info(), to: ctx.accounts.reflection_vault.to_account_info(), authority: ctx.accounts.signer.to_account_info() }; token::transfer(CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi), refl)?; }
    if pool>0{ let cpi=Transfer{ from: ctx.accounts.from_token.to_account_info(), to: ctx.accounts.hold_pool_vault.to_account_info(), authority: ctx.accounts.signer.to_account_info() }; token::transfer(CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi), pool)?; }
    { let cpi=Transfer{ from: ctx.accounts.from_token.to_account_info(), to: ctx.accounts.to_token.to_account_info(), authority: ctx.accounts.signer.to_account_info() }; token::transfer(CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi), net)?; }
    let total_supply=ctx.accounts.mint.supply; let excluded=ctx.accounts.reflection_vault.amount.saturating_add(ctx.accounts.hold_pool_vault.amount); let effective=total_supply.saturating_sub(excluded); require!(effective>0, UpError::ZeroEffectiveSupply);
    if refl>0{ let add=(refl as u128)*ACC_PRECISION/(effective as u128); cfg.reflection_acc_per_token=cfg.reflection_acc_per_token.checked_add(add).ok_or(UpError::MathOverflow)?; emit!(ReflectionAccrued{refl_added:refl,acc_per_token:cfg.reflection_acc_per_token}); }
    let now=Clock::get()?.unix_timestamp; ctx.accounts.from_holder_state.last_outgoing_ts=now; ctx.accounts.from_holder_state.streak_start_ts=now;
    if ctx.accounts.to_holder_state.wallet==Pubkey::default(){ ctx.accounts.to_holder_state.wallet=ctx.accounts.to_token.owner; } Ok(()) }
>>>>>>> 1b3568e9557a0d186e14cc8b4511fe3aaf270877
