use anchor_lang::prelude::*;
#[error_code]
pub enum UpError {
    #[msg("Invalid fee configuration")] InvalidFeeConfig,
    #[msg("Epoch not ready")] EpochNotReady,
    #[msg("Already claimed for this epoch")] AlreadyClaimed,
    #[msg("Ineligible for hold pool")] IneligibleForHoldPool,
    #[msg("Math overflow")] MathOverflow,
    #[msg("Zero effective supply")] ZeroEffectiveSupply,
    #[msg("Invalid vault authority")] InvalidVaultAuthority,
    #[msg("Missing expected epoch account in remaining accounts")] MissingEpochAccount,
    #[msg("Transfer blocked by hook policy")] TransferBlocked,
}
