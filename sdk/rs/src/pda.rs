//! PDA derivations. Seeds mirror `programs/squads_multisig_program/src/state/seeds.rs`.
//! Each function takes an optional program ID and defaults to the mainnet program.

use solana_address::Address;

use crate::ID;

const SEED_PREFIX: &[u8] = b"multisig";
const SEED_PROGRAM_CONFIG: &[u8] = b"program_config";
const SEED_MULTISIG: &[u8] = b"multisig";
const SEED_PROPOSAL: &[u8] = b"proposal";
const SEED_TRANSACTION: &[u8] = b"transaction";
const SEED_BATCH_TRANSACTION: &[u8] = b"batch_transaction";
const SEED_VAULT: &[u8] = b"vault";
const SEED_EPHEMERAL_SIGNER: &[u8] = b"ephemeral_signer";
const SEED_SPENDING_LIMIT: &[u8] = b"spending_limit";
const SEED_TRANSACTION_BUFFER: &[u8] = b"transaction_buffer";

fn find(seeds: &[&[u8]], program_id: Option<&Address>) -> (Address, u8) {
    Address::find_program_address(seeds, program_id.unwrap_or(&ID))
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
