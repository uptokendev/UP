use anchor_lang::prelude::*; use anchor_spl::token::TokenAccount; use crate::state::{GlobalConfig, Epoch, EPOCH_SPACE};
pub fn maybe_roll_epoch<'info>( program_id:&Pubkey, cfg:&mut Account<'info, GlobalConfig>, hold_pool_vault:&Account<'info, TokenAccount>, payer:&Signer<'info>, epoch_ai:&AccountInfo<'info>, system_program:&Program<'info, System>) -> Result<()> {
    let now=Clock::get()?.unix_timestamp; if now < cfg.current_epoch_start + cfg.epoch_length { return Ok(()); }
    let next_id: u64=(cfg.current_epoch_start as u64)/(cfg.epoch_length as u64) + 1; let seed_id=next_id.to_le_bytes();
    let (expected,bump)=Pubkey::find_program_address(&[b"epoch",&seed_id], program_id); require_keys_eq!(*epoch_ai.key, expected, crate::errors::UpError::MissingEpochAccount);
    if epoch_ai.data_is_empty(){ let rent=Rent::get()?; let lamports=rent.minimum_balance(EPOCH_SPACE); let ix=anchor_lang::solana_program::system_instruction::create_account(&payer.key(), epoch_ai.key, lamports, EPOCH_SPACE as u64, program_id);
        anchor_lang::solana_program::program::invoke_signed(&ix, &[payer.to_account_info(), epoch_ai.clone(), system_program.to_account_info()], &[&[b"epoch",&seed_id,&[bump]]])?; }
    let mut data=epoch_ai.try_borrow_mut_data()?; let mut w:&mut [u8]=&mut data; let e=Epoch{ epoch_id: next_id, epoch_start_ts: now, pool_amount: hold_pool_vault.amount, remaining_pool: hold_pool_vault.amount, total_weight_accumulated: 0, bump };
    e.try_serialize(&mut w)?; cfg.current_epoch_start=now; Ok(()) }
