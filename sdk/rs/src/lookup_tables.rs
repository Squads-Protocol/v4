//! Address lookup table instructions (bincode u32 tags: create 0, extend 2, deactivate 3, close 4),
//! built here so that the SDK needs no lookup-table crate. The same rules as `lookupTables.ts`.

use solana_address::Address;
use solana_instruction::{AccountMeta, Instruction};
use squads_multisig_4r_program::builders::SYSTEM_PROGRAM_ID;
use squads_multisig_4r_program::message::AddressLookupTableAccount;
use squads_multisig_4r_program::migration::{
    ASSOCIATED_TOKEN_PROGRAM_ID, BPF_LOADER_UPGRADEABLE_ID, STAKE_PROGRAM_ID,
    TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID, VOTE_PROGRAM_ID,
};

pub const ADDRESS_LOOKUP_TABLE_PROGRAM_ID: Address =
    Address::from_str_const("AddressLookupTab1e1111111111111111111111111");

/// The most addresses in one lookup table.
pub const MAX_LOOKUP_TABLE_ADDRESSES: usize = 256;
/// Addresses for each extend transaction: it fits in one transaction with the create instruction.
pub const LOOKUP_TABLE_ADDRESSES_PER_EXTEND: usize = 20;

/// The table that `authority` creates with `recent_slot` (a recent slot of the cluster).
pub fn find_lookup_table_address(authority: &Address, recent_slot: u64) -> (Address, u8) {
    Address::find_program_address(
        &[authority.as_ref(), &recent_slot.to_le_bytes()],
        &ADDRESS_LOOKUP_TABLE_PROGRAM_ID,
    )
}

fn table_instruction(accounts: Vec<AccountMeta>, data: Vec<u8>) -> Instruction {
    Instruction {
        program_id: ADDRESS_LOOKUP_TABLE_PROGRAM_ID,
        accounts,
        data,
    }
}

fn tag(value: u32) -> Vec<u8> {
    value.to_le_bytes().to_vec()
}

/// Returns the table address and its `CreateLookupTable` instruction. The authority does not sign.
pub fn create_lookup_table(
    authority: &Address,
    payer: &Address,
    recent_slot: u64,
) -> (Address, Instruction) {
    let (table, bump) = find_lookup_table_address(authority, recent_slot);
    let data = [tag(0), recent_slot.to_le_bytes().to_vec(), vec![bump]].concat();
    let accounts = vec![
        AccountMeta::new(table, false),
        AccountMeta::new_readonly(*authority, false),
        AccountMeta::new(*payer, true),
        AccountMeta::new_readonly(SYSTEM_PROGRAM_ID, false),
    ];
    (table, table_instruction(accounts, data))
}

pub fn extend_lookup_table(
    table: &Address,
    authority: &Address,
    payer: &Address,
    addresses: &[Address],
) -> Instruction {
    let data = [
        tag(2),
        (addresses.len() as u64).to_le_bytes().to_vec(),
        addresses
            .iter()
            .flat_map(|address| address.to_bytes())
            .collect(),
    ]
    .concat();
    let accounts = vec![
        AccountMeta::new(*table, false),
        AccountMeta::new_readonly(*authority, true),
        AccountMeta::new(*payer, true),
        AccountMeta::new_readonly(SYSTEM_PROGRAM_ID, false),
    ];
    table_instruction(accounts, data)
}

/// Deactivates a table. Close it about 513 slots later to get the rent back.
pub fn deactivate_lookup_table(table: &Address, authority: &Address) -> Instruction {
    let accounts = vec![
        AccountMeta::new(*table, false),
        AccountMeta::new_readonly(*authority, true),
    ];
    table_instruction(accounts, tag(3))
}

pub fn close_lookup_table(
    table: &Address,
    authority: &Address,
    recipient: &Address,
) -> Instruction {
    let accounts = vec![
        AccountMeta::new(*table, false),
        AccountMeta::new_readonly(*authority, true),
        AccountMeta::new(*recipient, false),
    ];
    table_instruction(accounts, tag(4))
}

/// Programs stay static accounts: a table holds only the accounts that the instructions read or write.
const PROGRAMS: [Address; 7] = [
    squads_multisig_4r_program::ID,
    TOKEN_PROGRAM_ID,
    TOKEN_2022_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
    STAKE_PROGRAM_ID,
    VOTE_PROGRAM_ID,
    BPF_LOADER_UPGRADEABLE_ID,
];

/// The non-signer, non-program accounts of `instructions`, once each, in order of first use.
pub fn lookup_table_addresses(instructions: &[Instruction]) -> Vec<Address> {
    let programs: Vec<Address> = PROGRAMS
        .into_iter()
        .chain([SYSTEM_PROGRAM_ID])
        .chain(instructions.iter().map(|ix| ix.program_id))
        .collect();
    instructions
        .iter()
        .flat_map(|ix| &ix.accounts)
        .filter(|meta| !meta.is_signer && !programs.contains(&meta.pubkey))
        .map(|meta| meta.pubkey)
        .fold(Vec::new(), |mut found, address| {
            if !found.contains(&address) {
                found.push(address);
            }
            found
        })
}

/// The tables for `addresses` and the transactions that create and extend them.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LookupTablesSetup {
    pub tables: Vec<AddressLookupTableAccount>,
    pub transactions: Vec<Vec<Instruction>>,
}

/// Creates tables for `addresses` (up to 256 each) and extends them. Wait one slot after the last
/// transaction before you use the tables.
pub fn create_lookup_tables(
    addresses: &[Address],
    authority: &Address,
    payer: &Address,
    recent_slot: u64,
) -> LookupTablesSetup {
    let (tables, transactions): (Vec<_>, Vec<_>) = addresses
        .chunks(MAX_LOOKUP_TABLE_ADDRESSES)
        .enumerate()
        .map(|(i, group)| {
            // Each table needs its own seed: the authority and a distinct recent slot.
            let (table, create) =
                create_lookup_table(authority, payer, recent_slot.saturating_sub(i as u64));
            let transactions: Vec<Vec<Instruction>> = group
                .chunks(LOOKUP_TABLE_ADDRESSES_PER_EXTEND)
                .enumerate()
                .map(|(j, chunk)| {
                    let extend = extend_lookup_table(&table, authority, payer, chunk);
                    match j {
                        0 => vec![create.clone(), extend],
                        _ => vec![extend],
                    }
                })
                .collect();
            let account = AddressLookupTableAccount {
                key: table,
                addresses: group.to_vec(),
            };
            (account, transactions)
        })
        .unzip();
    LookupTablesSetup {
        tables,
        transactions: transactions.into_iter().flatten().collect(),
    }
}

/// Reads the addresses of a lookup table account (56-byte header, then 32 bytes each).
pub fn parse_lookup_table(key: Address, data: &[u8]) -> Option<AddressLookupTableAccount> {
    const HEADER: usize = 56;
    (u32::from_le_bytes(data.get(..4)?.try_into().ok()?) == 1).then_some(())?;
    let addresses = data
        .get(HEADER..)?
        .as_chunks::<32>()
        .0
        .iter()
        .map(|bytes| Address::new_from_array(*bytes))
        .collect();
    Some(AddressLookupTableAccount { key, addresses })
}
