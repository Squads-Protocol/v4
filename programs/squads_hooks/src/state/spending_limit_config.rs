use anchor_lang::prelude::*;
use squads_multisig_program::Period;


#[account]
pub struct SpendingLimitConfig {
    pub multisig: Pubkey,
    pub mint: Pubkey,
    pub members: Vec<Pubkey>,
    pub amount: u64,
    pub period: Period,
    pub destinations: Vec<Pubkey>,
    pub remaining_amount: u64,
    pub last_reset: i64,
}

impl SpendingLimitConfig {
    pub fn size(members_length: usize, destinations_length: usize) -> usize {
        8  + // anchor discriminator
        32 + // multisig
        32 + // mint
        4  + // members vector length
        members_length * 32 + // members
        8  + // amount
        1  + // period
        8  + // last_reset
        4  + // destinations vector length
        destinations_length * 32 // destinations
    }
}
