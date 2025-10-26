use anchor_lang::prelude::*;

pub mod state;
pub mod errors;
pub mod events;
pub mod instructions;
pub mod hooks;
pub mod helpers;

use instructions::*;

declare_id!("Up111111111111111111111111111111111111111");

#[program]
pub mod up_token {
    use super::*;
    pub fn initialize(ctx: Context<initialize::Initialize>, args: initialize::InitializeArgs) -> Result<()> { initialize::handler(ctx, args) }
    pub fn set_fees(ctx: Context<set_fees::SetFees>, fees: state::FeeConfig) -> Result<()> { set_fees::handler(ctx, fees) }
    pub fn set_dev_wallet(ctx: Context<set_dev_wallet::SetDevWallet>, new_dev: Pubkey) -> Result<()> { set_dev_wallet::handler(ctx, new_dev) }
    pub fn set_hook_mode(ctx: Context<set_hook_mode::SetHookMode>, enforce: bool) -> Result<()> { set_hook_mode::handler(ctx, enforce) }
    pub fn start_next_epoch(ctx: Context<start_next_epoch::StartNextEpoch>) -> Result<()> { start_next_epoch::handler(ctx) }
    pub fn claim_reflection(ctx: Context<claim_reflection::ClaimReflection>) -> Result<()> { claim_reflection::handler(ctx) }
    pub fn claim_hold_pool(ctx: Context<claim_hold_pool::ClaimHoldPool>, epoch_id: u64) -> Result<()> { claim_hold_pool::handler(ctx, epoch_id) }
    pub fn program_transfer(ctx: Context<program_transfer::ProgramTransfer>, amount: u64) -> Result<()> { program_transfer::handler(ctx, amount) }
    pub fn on_transfer(ctx: Context<hooks::transfer_hook::OnTransfer>, amount: u64) -> Result<()> { hooks::transfer_hook::handler(ctx, amount) }
}
