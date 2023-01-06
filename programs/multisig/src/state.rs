use anchor_lang::prelude::*;
use anchor_lang::solana_program::borsh::get_instance_packed_len;

use crate::errors::*;
use crate::events::*;
use crate::instructions::{CompiledInstruction, MessageAddressTableLookup, TransactionMessage};

pub const SEED_PREFIX: &[u8] = b"multisig";
pub const SEED_MULTISIG: &[u8] = b"multisig";
pub const SEED_TRANSACTION: &[u8] = b"transaction";
pub const SEED_AUTHORITY: &[u8] = b"authority";

#[account]
pub struct Multisig {
    /// The authority that can change the multisig config.
    /// This is a very important parameter as this authority can change the members and threshold.
    ///
    /// The convention is to set this to a PDA derived from the multisig address and an authority index (typically 0)
    /// using the following seeds: ["multisig", multisig_address, authority_index, "authority"].
    /// In this case, the multisig becomes autonomous, so every config change goes through
    /// the normal process of voting by the members.
    ///
    /// However, this parameter can be set to any key. This allows for the multisig to be controlled
    /// by a higher central authority or even another multisig.
    pub config_authority: Pubkey,
    /// Threshold for signatures.
    pub threshold: u16,
    /// Members of the multisig.
    pub members: Vec<Member>,
    /// Index to seed other authorities under this multisig.
    pub authority_index: u8,
    /// Last transaction index. 0 means no transactions have been created.
    pub transaction_index: u64,
    /// Last stale transaction index. All transactions up until this index are stale.
    /// This index is updated when multisig config (members/threshold) changes.
    pub stale_transaction_index: u64,
    /// Whether to allow non-member keys to execute txs.
    pub allow_external_execute: bool,
    /// Key that is used to seed the multisig PDA.
    /// Used solely as bytes for the seed, doesn't have any other meaning or function.
    pub create_key: Pubkey,
    /// Bump for the multisig PDA seed.
    pub bump: u8,
}

impl Multisig {
    pub fn size(members_length: usize) -> usize {
        8  + // anchor account discriminator
        32 + // config_authority
        2  + // threshold
        4  + // members vector length
        members_length * Member::size()  + // members
        1  + // authority_index
        8  + // transaction_index
        8  + // stale_transaction_index 
        1  + // allow_external_execute
        32 + // create_key
        1 // bump
    }

    /// Captures the fact that the multisig config has changed in the multisig state
    /// and emits a `ConfigUpdatedEvent`.
    pub fn config_updated(
        &mut self,
        multisig_address: Pubkey,
        update: ConfigUpdateType,
        memo: Option<String>,
    ) {
        self.stale_transaction_index = self.transaction_index;

        emit!(MultisigConfigUpdatedEvent {
            multisig: multisig_address,
            update,
            memo
        })
    }

    /// Returns `Some(index)` if `member_pubkey` is a member, with `index` into the `members` vec.
    /// `None` otherwise.
    pub fn is_member(&self, member_pubkey: Pubkey) -> Option<usize> {
        match self.members.binary_search_by_key(&member_pubkey, |m| m.key) {
            Ok(index) => Some(index),
            _ => None,
        }
    }

    pub fn member_has_permission(&self, member_pubkey: Pubkey, permission: Permission) -> bool {
        match self.is_member(member_pubkey) {
            Some(index) => self.members[index].permissions.has(permission),
            _ => false,
        }
    }

    pub fn add_member_if_not_exists(&mut self, new_member: Member) {
        if self.is_member(new_member.key).is_none() {
            self.members.push(new_member);
            self.members.sort_by_key(|m| m.key);
        }
    }
}

#[derive(AnchorDeserialize, AnchorSerialize, Eq, PartialEq, Clone)]
pub struct Member {
    pub key: Pubkey,
    pub permissions: Permissions,
}

impl Member {
    pub fn size() -> usize {
        32 + // key 
        1 // role
    }
}

#[derive(Clone, Copy)]
pub enum Permission {
    Initiate = 1 << 0,
    Vote = 1 << 1,
    Execute = 1 << 2,
}

/// Bitmask for permissions.
#[derive(AnchorSerialize, AnchorDeserialize, Eq, PartialEq, Clone, Copy, Default, Debug)]
pub struct Permissions {
    mask: u8,
}

impl Permissions {
    pub fn from_vec(permissions: &[Permission]) -> Self {
        let mut mask = 0;
        for permission in permissions {
            mask |= *permission as u8;
        }
        Self { mask }
    }

    pub fn has(&self, permission: Permission) -> bool {
        self.mask & (permission as u8) != 0
    }
}

/// Represents data required for tracking the voting status, and execution of a multisig transaction.
#[account]
pub struct MultisigTransaction {
    /// Creator, used to seed pda.
    pub creator: Pubkey,
    /// The multisig this belongs to.
    pub multisig: Pubkey,
    /// Used for seed.
    pub transaction_index: u64,
    /// Index to use for other pdas (?).
    pub authority_index: u8,
    /// The authority bump.
    pub authority_bump: u8,
    /// The status of the transaction.
    pub status: TransactionStatus,
    /// bump for the seed.
    pub bump: u8,
    /// keys that have approved/signed.
    pub approved: Vec<Pubkey>,
    /// keys that have rejected.
    pub rejected: Vec<Pubkey>,
    /// keys that have cancelled (ExecuteReady only).
    pub cancelled: Vec<Pubkey>,
    /// data required for executing the transaction.
    pub message: MultisigTransactionMessage,
}

impl MultisigTransaction {
    pub fn size(members_length: usize, transaction_message: &[u8]) -> Result<usize> {
        let transaction_message: MultisigTransactionMessage =
            TransactionMessage::deserialize(&mut &transaction_message[..])?.try_into()?;
        let message_size = get_instance_packed_len(&transaction_message).unwrap_or_default();

        Ok(
            8 +   // anchor account discriminator
            32 +  // creator
            32 +  // multisig
            8 +   // transaction_index
            1 +   // authority_index
            1 +   // authority_bump
            1 +   // status
            1 +   // tx bump
            (4 + (members_length * 32)) + // approved vec
            (4 + (members_length * 32)) + // rejected vec
            (4 + (members_length * 32)) + // cancelled vec
            message_size, // message
        )
    }

    /// Approve the transaction.
    pub fn approve(&mut self, member: Pubkey) -> Result<()> {
        self.approved.push(member);
        self.approved.sort();
        Ok(())
    }

    /// Reject the transaction.
    pub fn reject(&mut self, member: Pubkey) -> Result<()> {
        self.rejected.push(member);
        self.rejected.sort();
        Ok(())
    }

    /// Cancel the transaction if execute_ready.
    pub fn cancel(&mut self, member: Pubkey) -> Result<()> {
        self.cancelled.push(member);
        self.cancelled.sort();
        Ok(())
    }

    /// Check if the member has already voted.
    pub fn has_voted(&self, member: Pubkey) -> bool {
        let approved = self.approved.binary_search(&member).is_ok();
        let rejected = self.rejected.binary_search(&member).is_ok();
        approved || rejected
    }

    /// Check if the member approved the transaction.
    pub fn has_voted_approve(&self, member: Pubkey) -> Option<usize> {
        self.approved.binary_search(&member).ok()
    }

    /// Check if the member rejected the transaction.
    pub fn has_voted_reject(&self, member: Pubkey) -> Option<usize> {
        self.rejected.binary_search(&member).ok()
    }

    /// Check if a user has signed to cancel
    pub fn has_cancelled(&self, member: Pubkey) -> Option<usize> {
        self.cancelled.binary_search(&member).ok()
    }

    /// Delete the vote of rejection at the `index`.
    pub fn remove_rejection_vote(&mut self, index: usize) -> Result<()> {
        self.rejected.remove(index);
        Ok(())
    }

    /// Delete the vote of approval at the `index`.
    pub fn remove_approval_vote(&mut self, index: usize) -> Result<()> {
        self.approved.remove(index);
        Ok(())
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, Debug)]
#[non_exhaustive]
pub enum TransactionStatus {
    /// Transaction is live and ready.
    Active,
    /// Transaction has been approved and is pending execution.
    ExecuteReady,
    /// Transaction has been executed.
    Executed,
    /// Transaction has been rejected.
    Rejected,
    /// Transaction has been cancelled.
    Cancelled,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct MultisigTransactionMessage {
    /// The number of signer pubkeys in the account_keys vec.
    pub num_signers: u8,
    /// The number of writable signer pubkeys in the account_keys vec.
    pub num_writable_signers: u8,
    /// The number of writable non-signer pubkeys in the account_keys vec.
    pub num_writable_non_signers: u8,
    /// Unique account pubkeys (including program IDs) required for execution of the tx.
    /// The signer pubkeys appear at the beginning of the vec, with writable pubkeys first, and read-only pubkeys following.
    /// The non-signer pubkeys follow with writable pubkeys first and read-only ones following.
    /// Program IDs are also stored at the end of the vec along with other non-signer non-writable pubkeys:
    ///
    /// ```plaintext
    /// [pubkey1, pubkey2, pubkey3, pubkey4, pubkey5, pubkey6, pubkey7, pubkey8]
    ///  |---writable---|  |---readonly---|  |---writable---|  |---readonly---|
    ///  |------------signers-------------|  |----------non-singers-----------|
    /// ```
    pub account_keys: Vec<Pubkey>,
    /// List of instructions making up the tx.
    pub instructions: Vec<MultisigCompiledInstruction>,
    /// List of address table lookups used to load additional accounts
    /// for this transaction.
    pub address_table_lookups: Vec<MultisigMessageAddressTableLookup>,
}

impl MultisigTransactionMessage {
    /// Returns the number of all the account keys (static + dynamic) in the message.
    pub fn num_all_account_keys(&self) -> usize {
        let num_account_keys_from_lookups = self
            .address_table_lookups
            .iter()
            .map(|lookup| lookup.writable_indexes.len() + lookup.readonly_indexes.len())
            .sum::<usize>();

        self.account_keys.len() + num_account_keys_from_lookups
    }

    /// Returns true if the account at the specified index is a part of static `account_keys` and was requested to be writable.
    pub fn is_static_writable_index(&self, key_index: usize) -> bool {
        let num_account_keys = self.account_keys.len();
        let num_signers = usize::from(self.num_signers);
        let num_writable_signers = usize::from(self.num_writable_signers);
        let num_writable_non_signers = usize::from(self.num_writable_non_signers);

        if key_index >= num_account_keys {
            // `index` is not a part of static `account_keys`.
            return false;
        }

        if key_index < num_writable_signers {
            // `index` is within the range of writable signer keys.
            return true;
        }

        if key_index >= num_signers {
            // `index` is within the range of non-signer keys.
            let index_into_non_signers = key_index.saturating_sub(num_signers);
            // Whether `index` is within the range of writable non-signer keys.
            return index_into_non_signers < num_writable_non_signers;
        }

        false
    }

    /// Returns true if the account at the specified index was requested to be a signer.
    pub fn is_signer_index(&self, key_index: usize) -> bool {
        key_index < usize::from(self.num_signers)
    }
}

impl TryFrom<TransactionMessage> for MultisigTransactionMessage {
    type Error = Error;

    fn try_from(message: TransactionMessage) -> Result<Self> {
        let account_keys: Vec<Pubkey> = message.account_keys.into();
        let instructions: Vec<CompiledInstruction> = message.instructions.into();
        let address_table_lookups: Vec<MessageAddressTableLookup> =
            message.address_table_lookups.into();

        require!(
            usize::from(message.num_signers) <= account_keys.len(),
            MultisigError::InvalidTransactionMessage
        );
        require!(
            message.num_writable_signers <= message.num_signers,
            MultisigError::InvalidTransactionMessage
        );
        require!(
            usize::from(message.num_writable_non_signers)
                <= account_keys
                    .len()
                    .saturating_sub(usize::from(message.num_signers)),
            MultisigError::InvalidTransactionMessage
        );

        Ok(Self {
            num_signers: message.num_signers,
            num_writable_signers: message.num_writable_signers,
            num_writable_non_signers: message.num_writable_non_signers,
            account_keys,
            instructions: instructions
                .into_iter()
                .map(MultisigCompiledInstruction::from)
                .collect(),
            address_table_lookups: address_table_lookups
                .into_iter()
                .map(MultisigMessageAddressTableLookup::from)
                .collect(),
        })
    }
}

/// Concise serialization schema for instructions that make up a transaction.
/// Closely mimics the Solana transaction wire format.
#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct MultisigCompiledInstruction {
    pub program_id_index: u8,
    /// Indices into the tx's `account_keys` list indicating which accounts to pass to the instruction.
    pub account_indexes: Vec<u8>,
    /// Instruction data.
    pub data: Vec<u8>,
}

impl From<CompiledInstruction> for MultisigCompiledInstruction {
    fn from(compiled_instruction: CompiledInstruction) -> Self {
        Self {
            program_id_index: compiled_instruction.program_id_index,
            account_indexes: compiled_instruction.account_indexes.into(),
            data: compiled_instruction.data.into(),
        }
    }
}

/// Address table lookups describe an on-chain address lookup table to use
/// for loading more readonly and writable accounts into a transaction.
#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct MultisigMessageAddressTableLookup {
    /// Address lookup table account key.
    pub account_key: Pubkey,
    /// List of indexes used to load writable accounts.
    pub writable_indexes: Vec<u8>,
    /// List of indexes used to load readonly accounts.
    pub readonly_indexes: Vec<u8>,
}

impl From<MessageAddressTableLookup> for MultisigMessageAddressTableLookup {
    fn from(m: MessageAddressTableLookup) -> Self {
        Self {
            account_key: m.account_key,
            writable_indexes: m.writable_indexes.into(),
            readonly_indexes: m.readonly_indexes.into(),
        }
    }
}
