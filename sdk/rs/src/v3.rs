//! A client for the frozen Squads v3 program (Squads MPL) and its roles program, for v3 -> 4r
//! migrations: PDAs, account readers, instruction encoders and the size of one v3 item. Written
//! from the v3 source (Anchor 0.26), with no v3 crate. The same API as `v3.ts` in `@sqds/multisig-4r`.

use std::collections::BTreeMap;

use solana_address::Address;
use solana_instruction::{AccountMeta, Instruction};
use squads_multisig_4r_program::builders::SYSTEM_PROGRAM_ID;
use squads_multisig_4r_program::error::{CoreError, CoreResult};
use squads_multisig_4r_program::message::AddressLookupTableAccount;
pub use squads_multisig_4r_program::migration::v3::{
    get_v3_authority_pda, get_v3_multisig_pda, v3_vault_index, V3Multisig, LEGACY_V3_PROGRAM_ID,
    MAX_AUTHORITY_INDEX, SEED_SQUAD,
};

use crate::planner::ItemSize;

/// The v3 roles program. Its delegate PDAs can be v3 members; they sign only into v3.
pub const V3_ROLES_PROGRAM_ID: Address =
    Address::from_str_const("SMPLvKJwsyNGD6xf7Ph6VRpDGPa3DXV4uPHcTAnXe6r");

const RENT_SYSVAR_ID: Address =
    Address::from_str_const("SysvarRent111111111111111111111111111111111");

/// Anchor discriminators: `sha256("account:<Name>")[..8]` and `sha256("global:<name>")[..8]`.
pub mod discriminator {
    pub use squads_multisig_4r_program::migration::v3::MS_DISCRIMINATOR as MS;
    pub const MS_TRANSACTION: [u8; 8] = [0xb6, 0x97, 0x68, 0xd8, 0xff, 0x01, 0x13, 0x9d];
    pub const MS_INSTRUCTION: [u8; 8] = [0xee, 0xb9, 0x7e, 0x95, 0xbd, 0x59, 0xff, 0x5c];
    pub const ROLES_MANAGER: [u8; 8] = [0x3a, 0x22, 0x64, 0x7e, 0xda, 0x3b, 0xae, 0x08];
    pub const ROLES_USER: [u8; 8] = [0x9f, 0x75, 0x5f, 0xe3, 0xef, 0x97, 0x3a, 0xec];
    pub const CREATE: [u8; 8] = [0x18, 0x1e, 0xc8, 0x28, 0x05, 0x1c, 0x07, 0x77];
    pub const CREATE_TRANSACTION: [u8; 8] = [0xe3, 0xc1, 0x35, 0xef, 0x37, 0x7e, 0x70, 0x69];
    pub const ADD_INSTRUCTION: [u8; 8] = [0x0b, 0x46, 0x88, 0xa6, 0xca, 0x37, 0xf6, 0x4a];
    pub const ACTIVATE_TRANSACTION: [u8; 8] = [0x38, 0x11, 0x00, 0xa3, 0x87, 0x0b, 0x87, 0x20];
    pub const APPROVE_TRANSACTION: [u8; 8] = [0xe0, 0x27, 0x58, 0xb5, 0x24, 0x3b, 0x9b, 0x7a];
    pub const EXECUTE_INSTRUCTION: [u8; 8] = [0x30, 0x12, 0x28, 0x28, 0x4b, 0x4a, 0x93, 0x6e];
    pub const EXECUTE_TRANSACTION: [u8; 8] = [0xe7, 0xad, 0x31, 0x5b, 0xeb, 0x18, 0x44, 0x13];
    pub const ADD_MEMBER: [u8; 8] = [0x0d, 0x74, 0x7b, 0x82, 0x7e, 0xc6, 0x39, 0x22];
    pub const REMOVE_MEMBER: [u8; 8] = [0xab, 0x39, 0xe7, 0x96, 0xa7, 0x80, 0x12, 0x37];
    pub const CHANGE_THRESHOLD: [u8; 8] = [0x92, 0x97, 0xd5, 0x3f, 0x79, 0x4f, 0x09, 0x1d];
}

fn v3_pda(seeds: &[&[u8]], program_id: &Address) -> (Address, u8) {
    let seeds: Vec<&[u8]> = [&[SEED_SQUAD][..], seeds].concat();
    Address::find_program_address(&seeds, program_id)
}

/// The v3 transaction `transaction_index` of `multisig`.
pub fn get_v3_transaction_pda(multisig: &Address, transaction_index: u32) -> (Address, u8) {
    v3_pda(
        &[
            multisig.as_ref(),
            &transaction_index.to_le_bytes(),
            b"transaction",
        ],
        &LEGACY_V3_PROGRAM_ID,
    )
}

/// The attached instruction `instruction_index` (from 1) of a v3 transaction.
pub fn get_v3_instruction_pda(transaction: &Address, instruction_index: u8) -> (Address, u8) {
    v3_pda(
        &[transaction.as_ref(), &[instruction_index], b"instruction"],
        &LEGACY_V3_PROGRAM_ID,
    )
}

pub fn get_v3_roles_manager_pda(multisig: &Address) -> (Address, u8) {
    v3_pda(&[multisig.as_ref(), b"roles-manager"], &V3_ROLES_PROGRAM_ID)
}

pub fn get_v3_roles_user_pda(multisig: &Address, role_index: u32) -> (Address, u8) {
    v3_pda(
        &[multisig.as_ref(), &role_index.to_le_bytes(), b"user-role"],
        &V3_ROLES_PROGRAM_ID,
    )
}

/// The member key of a roles user: v3 sees it, and only the roles program signs for it.
pub fn get_v3_delegate_pda(user: &Address, origin_key: &Address) -> (Address, u8) {
    v3_pda(
        &[user.as_ref(), origin_key.as_ref(), b"delegate"],
        &V3_ROLES_PROGRAM_ID,
    )
}

/// A borsh reader over Anchor account data, after the discriminator check.
struct Reader<'a> {
    data: &'a [u8],
    offset: usize,
}

impl<'a> Reader<'a> {
    fn anchor(data: &'a [u8], discriminator: &[u8; 8]) -> Option<Self> {
        data.starts_with(discriminator)
            .then_some(Self { data, offset: 8 })
    }

    fn bytes(&mut self, len: usize) -> Option<&'a [u8]> {
        let end = self.offset.checked_add(len)?;
        let bytes = self.data.get(self.offset..end)?;
        self.offset = end;
        Some(bytes)
    }

    fn array<const N: usize>(&mut self) -> Option<[u8; N]> {
        self.bytes(N)?.try_into().ok()
    }

    fn u8(&mut self) -> Option<u8> {
        self.array::<1>().map(|[byte]| byte)
    }

    fn bool(&mut self) -> Option<bool> {
        match self.u8()? {
            0 => Some(false),
            1 => Some(true),
            _ => None,
        }
    }

    fn u16(&mut self) -> Option<u16> {
        self.array().map(u16::from_le_bytes)
    }

    fn u32(&mut self) -> Option<u32> {
        self.array().map(u32::from_le_bytes)
    }

    fn address(&mut self) -> Option<Address> {
        self.array().map(Address::new_from_array)
    }

    fn sized_bytes(&mut self) -> Option<&'a [u8]> {
        let len = usize::try_from(self.u32()?).ok()?;
        self.bytes(len)
    }

    fn vec<T>(&mut self, item: fn(&mut Self) -> Option<T>) -> Option<Vec<T>> {
        let len = self.u32()?;
        (0..len).map(|_| item(self)).collect()
    }

    fn addresses(&mut self) -> Option<Vec<Address>> {
        self.vec(Self::address)
    }
}

/// A v3 multisig (`Ms`).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Ms {
    pub threshold: u16,
    /// The highest authority index in use.
    pub authority_index: u16,
    /// The last v3 transaction index.
    pub transaction_index: u32,
    pub ms_change_index: u32,
    pub bump: u8,
    pub create_key: Address,
    pub allow_external_execute: bool,
    /// The members, sorted by v3.
    pub keys: Vec<Address>,
}

impl Ms {
    /// Decodes after the discriminator check; `None` for other data. Trailing bytes are ignored.
    pub fn decode(data: &[u8]) -> Option<Self> {
        let mut reader = Reader::anchor(data, &discriminator::MS)?;
        Some(Self {
            threshold: reader.u16()?,
            authority_index: reader.u16()?,
            transaction_index: reader.u32()?,
            ms_change_index: reader.u32()?,
            bump: reader.u8()?,
            create_key: reader.address()?,
            allow_external_execute: reader.bool()?,
            keys: reader.addresses()?,
        })
    }

    /// The governance that the successor mirrors.
    pub fn governance(&self) -> V3Multisig {
        V3Multisig {
            threshold: self.threshold,
            keys: self.keys.clone(),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MsTransactionStatus {
    Draft,
    Active,
    ExecuteReady,
    Executed,
    Rejected,
    Cancelled,
}

impl MsTransactionStatus {
    fn from_tag(tag: u8) -> Option<Self> {
        [
            Self::Draft,
            Self::Active,
            Self::ExecuteReady,
            Self::Executed,
            Self::Rejected,
            Self::Cancelled,
        ]
        .get(usize::from(tag))
        .copied()
    }
}

/// A v3 transaction (`MsTransaction`).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MsTransaction {
    pub creator: Address,
    pub ms: Address,
    pub transaction_index: u32,
    pub authority_index: u32,
    pub authority_bump: u8,
    pub status: MsTransactionStatus,
    /// The number of attached instructions.
    pub instruction_index: u8,
    pub bump: u8,
    pub approved: Vec<Address>,
    pub rejected: Vec<Address>,
    pub cancelled: Vec<Address>,
    /// The last instruction that `execute_instruction` ran (0: none).
    pub executed_index: u8,
}

impl MsTransaction {
    /// Decodes after the discriminator check; `None` for other data. Trailing bytes are ignored.
    pub fn decode(data: &[u8]) -> Option<Self> {
        let mut reader = Reader::anchor(data, &discriminator::MS_TRANSACTION)?;
        Some(Self {
            creator: reader.address()?,
            ms: reader.address()?,
            transaction_index: reader.u32()?,
            authority_index: reader.u32()?,
            authority_bump: reader.u8()?,
            status: MsTransactionStatus::from_tag(reader.u8()?)?,
            instruction_index: reader.u8()?,
            bump: reader.u8()?,
            approved: reader.addresses()?,
            rejected: reader.addresses()?,
            cancelled: reader.addresses()?,
            executed_index: reader.u8()?,
        })
    }
}

/// An instruction attached to a v3 transaction (`MsInstruction`).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MsInstruction {
    pub program_id: Address,
    pub keys: Vec<AccountMeta>,
    pub data: Vec<u8>,
    pub instruction_index: u8,
    pub bump: u8,
    pub executed: bool,
}

impl MsInstruction {
    /// Decodes after the discriminator check; `None` for other data. Trailing bytes are ignored.
    pub fn decode(data: &[u8]) -> Option<Self> {
        let mut reader = Reader::anchor(data, &discriminator::MS_INSTRUCTION)?;
        let meta = |reader: &mut Reader| {
            Some(AccountMeta {
                pubkey: reader.address()?,
                is_signer: reader.bool()?,
                is_writable: reader.bool()?,
            })
        };
        Some(Self {
            program_id: reader.address()?,
            keys: reader.vec(meta)?,
            data: reader.sized_bytes()?.to_vec(),
            instruction_index: reader.u8()?,
            bump: reader.u8()?,
            executed: reader.bool()?,
        })
    }

    /// `instruction` as v3 stores it after `add_instruction`, at `instruction_index`.
    pub fn attached(instruction: &Instruction, instruction_index: u8) -> Self {
        Self {
            program_id: instruction.program_id,
            keys: instruction.accounts.clone(),
            data: instruction.data.clone(),
            instruction_index,
            bump: 0,
            executed: false,
        }
    }
}

/// The roles of the v3 roles program.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Role {
    Initiate,
    Vote,
    Execute,
    InitiateAndExecute,
    InitiateAndVote,
    VoteAndExecute,
}

impl Role {
    fn from_tag(tag: u8) -> Option<Self> {
        [
            Self::Initiate,
            Self::Vote,
            Self::Execute,
            Self::InitiateAndExecute,
            Self::InitiateAndVote,
            Self::VoteAndExecute,
        ]
        .get(usize::from(tag))
        .copied()
    }
}

/// The roles manager of a v3 multisig: `role_index` is the last roles user.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RolesManager {
    pub ms: Address,
    pub role_index: u32,
    pub bump: u8,
}

impl RolesManager {
    /// Decodes after the discriminator check; `None` for other data. Trailing bytes are ignored.
    pub fn decode(data: &[u8]) -> Option<Self> {
        let mut reader = Reader::anchor(data, &discriminator::ROLES_MANAGER)?;
        Some(Self {
            ms: reader.address()?,
            role_index: reader.u32()?,
            bump: reader.u8()?,
        })
    }
}

/// A roles user (`User`): its delegate PDA is the v3 member.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RolesUser {
    pub name: String,
    pub role: Role,
    /// The wallet that signs for the delegate.
    pub origin_key: Address,
    pub bump: u8,
    pub ms: Address,
    pub role_index: u32,
}

impl RolesUser {
    /// Decodes after the discriminator check; `None` for other data. Trailing bytes are ignored.
    pub fn decode(data: &[u8]) -> Option<Self> {
        let mut reader = Reader::anchor(data, &discriminator::ROLES_USER)?;
        Some(Self {
            name: String::from_utf8(reader.sized_bytes()?.to_vec()).ok()?,
            role: Role::from_tag(reader.u8()?)?,
            origin_key: reader.address()?,
            bump: reader.u8()?,
            ms: reader.address()?,
            role_index: reader.u32()?,
        })
    }
}

fn v3_instruction(accounts: Vec<AccountMeta>, data: Vec<u8>) -> Instruction {
    Instruction {
        program_id: LEGACY_V3_PROGRAM_ID,
        accounts,
        data,
    }
}

fn u32_len(len: usize) -> [u8; 4] {
    u32::try_from(len).unwrap_or(u32::MAX).to_le_bytes()
}

/// `create`: a v3 multisig (for tests). v3 sorts and dedups `members`.
pub fn create(
    multisig: &Address,
    creator: &Address,
    threshold: u16,
    create_key: &Address,
    members: &[Address],
    meta: &str,
) -> Instruction {
    let keys = members.iter().flat_map(|member| member.to_bytes());
    let data = discriminator::CREATE
        .into_iter()
        .chain(threshold.to_le_bytes())
        .chain(create_key.to_bytes())
        .chain(u32_len(members.len()))
        .chain(keys)
        .chain(u32_len(meta.len()))
        .chain(meta.bytes())
        .collect();
    v3_instruction(
        vec![
            AccountMeta::new(*multisig, false),
            AccountMeta::new(*creator, true),
            AccountMeta::new_readonly(SYSTEM_PROGRAM_ID, false),
        ],
        data,
    )
}

/// `create_transaction`: a v3 transaction that `authority_index` signs (0: the multisig itself).
pub fn create_transaction(
    multisig: &Address,
    transaction: &Address,
    creator: &Address,
    authority_index: u32,
) -> Instruction {
    v3_instruction(
        vec![
            AccountMeta::new(*multisig, false),
            AccountMeta::new(*transaction, false),
            AccountMeta::new(*creator, true),
            AccountMeta::new_readonly(SYSTEM_PROGRAM_ID, false),
        ],
        [
            &discriminator::CREATE_TRANSACTION[..],
            &authority_index.to_le_bytes(),
        ]
        .concat(),
    )
}

/// The bytes of a v3 `IncomingInstruction`: the program, the account metas and the data.
pub fn encode_incoming_instruction(instruction: &Instruction) -> Vec<u8> {
    let keys = instruction.accounts.iter().flat_map(|account| {
        account
            .pubkey
            .to_bytes()
            .into_iter()
            .chain([u8::from(account.is_signer), u8::from(account.is_writable)])
    });
    instruction
        .program_id
        .to_bytes()
        .into_iter()
        .chain(u32_len(instruction.accounts.len()))
        .chain(keys)
        .chain(u32_len(instruction.data.len()))
        .chain(instruction.data.iter().copied())
        .collect()
}

/// `add_instruction`: attach `instruction` to a draft v3 transaction, as its next instruction.
pub fn add_instruction(
    multisig: &Address,
    transaction: &Address,
    instruction_account: &Address,
    creator: &Address,
    instruction: &Instruction,
) -> Instruction {
    v3_instruction(
        vec![
            AccountMeta::new_readonly(*multisig, false),
            AccountMeta::new(*transaction, false),
            AccountMeta::new(*instruction_account, false),
            AccountMeta::new(*creator, true),
            AccountMeta::new_readonly(SYSTEM_PROGRAM_ID, false),
        ],
        [
            discriminator::ADD_INSTRUCTION.to_vec(),
            encode_incoming_instruction(instruction),
        ]
        .concat(),
    )
}

fn vote(multisig: &Address, transaction: &Address, member: &Address, data: [u8; 8]) -> Instruction {
    v3_instruction(
        vec![
            AccountMeta::new_readonly(*multisig, false),
            AccountMeta::new(*transaction, false),
            AccountMeta::new(*member, true),
        ],
        data.to_vec(),
    )
}

/// `activate_transaction`: the creator opens a draft v3 transaction for votes.
pub fn activate_transaction(
    multisig: &Address,
    transaction: &Address,
    member: &Address,
) -> Instruction {
    vote(
        multisig,
        transaction,
        member,
        discriminator::ACTIVATE_TRANSACTION,
    )
}

/// `approve_transaction`: a member approves an active v3 transaction.
pub fn approve_transaction(
    multisig: &Address,
    transaction: &Address,
    member: &Address,
) -> Instruction {
    vote(
        multisig,
        transaction,
        member,
        discriminator::APPROVE_TRANSACTION,
    )
}

/// `execute_instruction`: a member runs the next attached instruction of an approved v3
/// transaction. The remaining accounts are its program and its accounts, never signers.
pub fn execute_instruction(
    multisig: &Address,
    transaction: &Address,
    instruction_account: &Address,
    member: &Address,
    attached: &MsInstruction,
) -> Instruction {
    let remaining = attached.keys.iter().map(|key| match key.is_writable {
        true => AccountMeta::new(key.pubkey, false),
        false => AccountMeta::new_readonly(key.pubkey, false),
    });
    let accounts = [
        AccountMeta::new(*multisig, false),
        AccountMeta::new(*transaction, false),
        AccountMeta::new(*instruction_account, false),
        AccountMeta::new(*member, true),
        AccountMeta::new_readonly(attached.program_id, false),
    ]
    .into_iter()
    .chain(remaining)
    .collect();
    v3_instruction(accounts, discriminator::EXECUTE_INSTRUCTION.to_vec())
}

/// `execute_transaction`: a member runs every attached instruction (with its instruction account)
/// at once. The only way to run authority 0; `account_list` maps each attached account to a
/// remaining one. Fails with more than 256 distinct accounts.
pub fn execute_transaction(
    multisig: &Address,
    transaction: &Address,
    member: &Address,
    attached: &[(Address, MsInstruction)],
) -> CoreResult<Instruction> {
    let sequence: Vec<(Address, bool)> = attached
        .iter()
        .flat_map(|(instruction_account, instruction)| {
            [
                (*instruction_account, false),
                (instruction.program_id, false),
            ]
            .into_iter()
            .chain(
                instruction
                    .keys
                    .iter()
                    .map(|key| (key.pubkey, key.is_writable)),
            )
        })
        .collect();
    let unique = sequence
        .iter()
        .fold(Vec::<Address>::new(), |mut unique, (key, _)| {
            if !unique.contains(key) {
                unique.push(*key);
            }
            unique
        });
    let account_list = sequence
        .iter()
        .map(|(key, _)| {
            let index = unique
                .iter()
                .position(|known| known == key)
                .unwrap_or_default();
            u8::try_from(index).map_err(|_| CoreError::AccountIndexOverflow)
        })
        .collect::<CoreResult<Vec<u8>>>()?;
    let writable = |key: &Address| sequence.iter().any(|(k, w)| k == key && *w);
    let remaining = unique.iter().map(|key| match writable(key) {
        true => AccountMeta::new(*key, false),
        false => AccountMeta::new_readonly(*key, false),
    });
    let accounts = [
        AccountMeta::new(*multisig, false),
        AccountMeta::new(*transaction, false),
        AccountMeta::new(*member, true),
    ]
    .into_iter()
    .chain(remaining)
    .collect();
    let data = [
        &discriminator::EXECUTE_TRANSACTION[..],
        &u32_len(account_list.len()),
        &account_list,
    ]
    .concat();
    Ok(v3_instruction(accounts, data))
}

/// `add_member`, to attach to a v3 transaction of authority 0 (the multisig signs). Use it to
/// replace a roles delegate member with its wallet before a migration.
pub fn add_member(multisig: &Address, new_member: &Address) -> Instruction {
    v3_instruction(
        vec![
            AccountMeta::new(*multisig, true),
            AccountMeta::new_readonly(RENT_SYSVAR_ID, false),
            AccountMeta::new_readonly(SYSTEM_PROGRAM_ID, false),
        ],
        [&discriminator::ADD_MEMBER[..], new_member.as_ref()].concat(),
    )
}

/// `remove_member`, to attach to a v3 transaction of authority 0.
pub fn remove_member(multisig: &Address, old_member: &Address) -> Instruction {
    v3_instruction(
        vec![AccountMeta::new(*multisig, true)],
        [&discriminator::REMOVE_MEMBER[..], old_member.as_ref()].concat(),
    )
}

/// `change_threshold`, to attach to a v3 transaction of authority 0.
pub fn change_threshold(multisig: &Address, threshold: u16) -> Instruction {
    v3_instruction(
        vec![AccountMeta::new(*multisig, true)],
        [
            &discriminator::CHANGE_THRESHOLD[..],
            &threshold.to_le_bytes(),
        ]
        .concat(),
    )
}

/// The member that signs and pays the transactions that [`measure_v3_item`] measures.
const PLACEHOLDER_MEMBER: Address = Address::new_from_array([9; 32]);

fn short_vec_len(len: usize) -> usize {
    match len {
        0..=0x7f => 1,
        0x80..=0x3fff => 2,
        _ => 3,
    }
}

#[derive(Debug, Clone, Copy, Default)]
struct KeyFlags {
    signer: bool,
    writable: bool,
    invoked: bool,
}

/// The wire size and the account count of one v0 transaction with `instructions`, signed by
/// `payer` only. Lookup tables load the accounts that are neither signers nor invoked programs.
fn transaction_size(
    payer: &Address,
    instructions: &[Instruction],
    tables: &[AddressLookupTableAccount],
) -> ItemSize {
    let payer_flags = KeyFlags {
        signer: true,
        writable: true,
        invoked: false,
    };
    let keys = instructions
        .iter()
        .fold(BTreeMap::from([(*payer, payer_flags)]), |mut keys, ix| {
            keys.entry(ix.program_id).or_default().invoked = true;
            ix.accounts.iter().for_each(|account| {
                let flags = keys.entry(account.pubkey).or_default();
                flags.signer |= account.is_signer;
                flags.writable |= account.is_writable;
            });
            keys
        });
    // The table (first one that holds the key) and the writable flag of each loaded key.
    let loaded: Vec<(usize, bool)> = keys
        .iter()
        .filter(|(_, flags)| !flags.signer && !flags.invoked)
        .filter_map(|(key, flags)| {
            let table = tables.iter().position(|t| t.addresses.contains(key))?;
            Some((table, flags.writable))
        })
        .collect();
    let lookups: Vec<(usize, usize)> = (0..tables.len())
        .map(|table| {
            let count = |writable: bool| loaded.iter().filter(|l| **l == (table, writable)).count();
            (count(true), count(false))
        })
        .filter(|(writable, readonly)| writable + readonly > 0)
        .collect();
    let statics = keys.len() - loaded.len();
    let signers = keys.values().filter(|flags| flags.signer).count();
    let sized = |len: usize| short_vec_len(len) + len;
    let instruction_bytes: usize = instructions
        .iter()
        .map(|ix| 1 + sized(ix.accounts.len()) + sized(ix.data.len()))
        .sum();
    let lookup_bytes: usize = lookups
        .iter()
        .map(|(writable, readonly)| 32 + sized(*writable) + sized(*readonly))
        .sum();
    // Version prefix, header, static keys, blockhash, instructions, lookups.
    let message = 1
        + 3
        + short_vec_len(statics)
        + 32 * statics
        + 32
        + short_vec_len(instructions.len())
        + instruction_bytes
        + short_vec_len(lookups.len())
        + lookup_bytes;
    ItemSize {
        message_bytes: short_vec_len(signers) + 64 * signers + message,
        message_accounts: keys.len(),
    }
}

/// A migrate instruction as a v3 instruction: the larger wire size of its add and execute
/// transactions (one member signs and pays), and the execute accounts (only it uses `tables`).
pub fn measure_v3_item(
    source_multisig: &Address,
    instruction: &Instruction,
    tables: &[AddressLookupTableAccount],
) -> ItemSize {
    let transaction = get_v3_transaction_pda(source_multisig, 1).0;
    let instruction_account = get_v3_instruction_pda(&transaction, 1).0;
    let member = &PLACEHOLDER_MEMBER;
    let add = add_instruction(
        source_multisig,
        &transaction,
        &instruction_account,
        member,
        instruction,
    );
    let execute = execute_instruction(
        source_multisig,
        &transaction,
        &instruction_account,
        member,
        &MsInstruction::attached(instruction, 1),
    );
    let add = transaction_size(member, &[add], &[]);
    let execute = transaction_size(member, &[execute], tables);
    ItemSize {
        message_bytes: add.message_bytes.max(execute.message_bytes),
        message_accounts: execute.message_accounts,
    }
}
