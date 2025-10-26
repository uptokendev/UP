use anchor_lang::prelude::*;

pub const ACC_PRECISION: u128 = 1_000_000_000_000_000_000;
pub const EPOCH_SPACE: usize = 8 + 64;

#[account]
pub struct GlobalConfig {
    pub authority: Pubkey,
    pub mint: Pubkey,
    pub dev_wallet: Pubkey,
    pub burn_bps: u16,
    pub dev_bps: u16,
    pub reflection_bps: u16,
    pub hold_pool_bps: u16,
    pub epoch_length: i64,
    pub current_epoch_start: i64,
    pub reflection_acc_per_token: u128,
    pub vault_authority: Pubkey,
    pub vault_bump: u8,
    pub enforce_hook: bool,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Default)]
pub struct FeeConfig { pub burn_bps: u16, pub dev_bps: u16, pub reflection_bps: u16, pub hold_pool_bps: u16 }

#[account]
pub struct HolderState {
    pub wallet: Pubkey,
    pub last_outgoing_ts: i64,
    pub streak_start_ts: i64,
    pub reflection_debt: u128,
    pub unclaimed_reflection: u64,
    pub bump: u8,
}

#[account]
pub struct Epoch {
    pub epoch_id: u64,
    pub epoch_start_ts: i64,
    pub pool_amount: u64,
    pub remaining_pool: u64,
    pub total_weight_accumulated: u128,
    pub bump: u8,
}
