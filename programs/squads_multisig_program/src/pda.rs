//! PDA derivations. Each function takes an optional program ID and defaults to [`crate::ID`].
//! On SBF, `Address::find_program_address` uses the runtime syscall.

use solana_address::Address;

use crate::state::{
    SEED_BATCH_TRANSACTION, SEED_EPHEMERAL_SIGNER, SEED_MULTISIG, SEED_PREFIX, SEED_PROGRAM_CONFIG,
    SEED_PROPOSAL, SEED_SPENDING_LIMIT, SEED_TRANSACTION, SEED_TRANSACTION_BUFFER, SEED_VAULT,
};

fn find(seeds: &[&[u8]], program_id: Option<&Address>) -> (Address, u8) {
    Address::find_program_address(seeds, program_id.unwrap_or(&crate::ID))
}

pub fn get_program_config_pda(program_id: Option<&Address>) -> (Address, u8) {
    find(&[SEED_PREFIX, SEED_PROGRAM_CONFIG], program_id)
}

pub fn get_multisig_pda(create_key: &Address, program_id: Option<&Address>) -> (Address, u8) {
    find(
        &[SEED_PREFIX, SEED_MULTISIG, create_key.as_ref()],
        program_id,
    )
}

pub fn get_vault_pda(multisig: &Address, index: u8, program_id: Option<&Address>) -> (Address, u8) {
    find(
        &[SEED_PREFIX, multisig.as_ref(), SEED_VAULT, &[index]],
        program_id,
    )
}

pub fn get_transaction_pda(
    multisig: &Address,
    transaction_index: u64,
    program_id: Option<&Address>,
) -> (Address, u8) {
    find(
        &[
            SEED_PREFIX,
            multisig.as_ref(),
            SEED_TRANSACTION,
            &transaction_index.to_le_bytes(),
        ],
        program_id,
    )
}

pub fn get_proposal_pda(
    multisig: &Address,
    transaction_index: u64,
    program_id: Option<&Address>,
) -> (Address, u8) {
    find(
        &[
            SEED_PREFIX,
            multisig.as_ref(),
            SEED_TRANSACTION,
            &transaction_index.to_le_bytes(),
            SEED_PROPOSAL,
        ],
        program_id,
    )
}

pub fn get_batch_transaction_pda(
    multisig: &Address,
    batch_index: u64,
    transaction_index: u32,
    program_id: Option<&Address>,
) -> (Address, u8) {
    find(
        &[
            SEED_PREFIX,
            multisig.as_ref(),
            SEED_TRANSACTION,
            &batch_index.to_le_bytes(),
            SEED_BATCH_TRANSACTION,
            &transaction_index.to_le_bytes(),
        ],
        program_id,
    )
}

pub fn get_spending_limit_pda(
    multisig: &Address,
    create_key: &Address,
    program_id: Option<&Address>,
) -> (Address, u8) {
    find(
        &[
            SEED_PREFIX,
            multisig.as_ref(),
            SEED_SPENDING_LIMIT,
            create_key.as_ref(),
        ],
        program_id,
    )
}

pub fn get_ephemeral_signer_pda(
    transaction: &Address,
    ephemeral_signer_index: u8,
    program_id: Option<&Address>,
) -> (Address, u8) {
    find(
        &[
            SEED_PREFIX,
            transaction.as_ref(),
            SEED_EPHEMERAL_SIGNER,
            &[ephemeral_signer_index],
        ],
        program_id,
    )
}

pub fn get_transaction_buffer_pda(
    multisig: &Address,
    creator: &Address,
    buffer_index: u8,
    program_id: Option<&Address>,
) -> (Address, u8) {
    find(
        &[
            SEED_PREFIX,
            multisig.as_ref(),
            SEED_TRANSACTION_BUFFER,
            creator.as_ref(),
            &[buffer_index],
        ],
        program_id,
    )
}
