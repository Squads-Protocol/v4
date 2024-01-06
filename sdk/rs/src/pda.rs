use squads_multisig_program::{
    SEED_EPHEMERAL_SIGNER, SEED_MULTISIG, SEED_PREFIX, SEED_PROGRAM_CONFIG, SEED_PROPOSAL,
    SEED_SPENDING_LIMIT, SEED_TRANSACTION, SEED_VAULT,
};

use crate::solana_program::pubkey::Pubkey;

pub fn get_program_config_pda(program_id: Option<&Pubkey>) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[SEED_PREFIX, SEED_PROGRAM_CONFIG],
        program_id.unwrap_or(&squads_multisig_program::ID),
    )
}

pub fn get_multisig_pda(create_key: &Pubkey, program_id: Option<&Pubkey>) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[SEED_PREFIX, SEED_MULTISIG, create_key.to_bytes().as_ref()],
        program_id.unwrap_or(&squads_multisig_program::ID),
    )
}

pub fn get_vault_pda(
    multisig_pda: &Pubkey,
    index: u8,
    program_id: Option<&Pubkey>,
) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[
            SEED_PREFIX,
            multisig_pda.to_bytes().as_ref(),
            SEED_VAULT,
            &[index],
        ],
        program_id.unwrap_or(&squads_multisig_program::ID),
    )
}

pub fn get_transaction_pda(
    multisig_pda: &Pubkey,
    transaction_index: u64,
    program_id: Option<&Pubkey>,
) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[
            SEED_PREFIX,
            multisig_pda.to_bytes().as_ref(),
            SEED_TRANSACTION,
            transaction_index.to_le_bytes().as_ref(),
        ],
        program_id.unwrap_or(&squads_multisig_program::ID),
    )
}

pub fn get_proposal_pda(
    multisig_pda: &Pubkey,
    transaction_index: u64,
    program_id: Option<&Pubkey>,
) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[
            SEED_PREFIX,
            multisig_pda.to_bytes().as_ref(),
            SEED_TRANSACTION,
            &transaction_index.to_le_bytes(),
            SEED_PROPOSAL,
        ],
        program_id.unwrap_or(&squads_multisig_program::ID),
    )
}

pub fn get_spending_limit_pda(
    multisig_pda: &Pubkey,
    create_key: &Pubkey,
    program_id: Option<&Pubkey>,
) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[
            SEED_PREFIX,
            multisig_pda.to_bytes().as_ref(),
            SEED_SPENDING_LIMIT,
            create_key.to_bytes().as_ref(),
        ],
        program_id.unwrap_or(&squads_multisig_program::ID),
    )
}

pub fn get_ephemeral_signer_pda(
    transaction_pda: &Pubkey,
    ephemeral_signer_index: u8,
    program_id: Option<&Pubkey>,
) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[
            SEED_PREFIX,
            &transaction_pda.to_bytes(),
            SEED_EPHEMERAL_SIGNER,
            &ephemeral_signer_index.to_le_bytes(),
        ],
        program_id.unwrap_or(&squads_multisig_program::ID),
    )
}
