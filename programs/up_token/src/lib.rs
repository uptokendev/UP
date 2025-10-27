use anchor_lang::prelude::*;

pub mod state;
pub mod errors;
pub mod events;
pub mod instructions;
pub mod helpers;

// Re-export accounts/args at crate root so Anchor macros can see them as types.
pub use instructions::*;

declare_id!("HHP6PWv5APf8fS1cTGcZyYcbKfGL4KFYVoLM1Xzoc5Uw");

#[program]
pub mod up_token {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>, args: InitializeArgs) -> Result<()> {
        initialize::handler(ctx, args)
    }

    pub fn set_fees(ctx: Context<SetFees>, fees: state::FeeConfig) -> Result<()> {
        set_fees::handler(ctx, fees)
    }

    pub fn set_dev_wallet(ctx: Context<SetDevWallet>, new_dev: Pubkey) -> Result<()> {
        set_dev_wallet::handler(ctx, new_dev)
    }

    pub fn set_hook_mode(ctx: Context<SetHookMode>, enforce: bool) -> Result<()> {
        set_hook_mode::handler(ctx, enforce)
    }

    pub fn start_next_epoch(ctx: Context<StartNextEpoch>) -> Result<()> {
        start_next_epoch::handler(ctx)
    }

    pub fn claim_reflection(ctx: Context<ClaimReflection>) -> Result<()> {
        claim_reflection::handler(ctx)
    }

    pub fn claim_hold_pool(ctx: Context<ClaimHoldPool>, epoch_id: u64) -> Result<()> {
        claim_hold_pool::handler(ctx, epoch_id)
    }

    pub fn program_transfer(ctx: Context<ProgramTransfer>, amount: u64) -> Result<()> {
        program_transfer::handler(ctx, amount)
    }

    // Transfer Hook entrypoint
    pub fn on_transfer(ctx: Context<OnTransfer>, amount: u64) -> Result<()> {
        on_transfer::handler(ctx, amount)
    }
}
