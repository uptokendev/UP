use anchor_lang::prelude::*;
#[event] pub struct TransferHookObserved{ pub from: Pubkey, pub to: Pubkey, pub amount: u64 }
#[event] pub struct ReflectionAccrued{ pub refl_added: u64, pub acc_per_token: u128 }
