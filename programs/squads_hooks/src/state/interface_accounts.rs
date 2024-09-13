use std::ops::Deref;

use anchor_lang::prelude::*;
use squads_multisig_program::{Multisig, Proposal, VaultTransaction};

// Define both program IDs
pub const MULTISIG_PROD_ID: Pubkey = Pubkey::new_from_array([
    6, 129, 196, 206, 71, 226, 35, 104, 184, 177, 85, 94, 200, 135, 175, 9, 46, 252, 126, 251, 182,
    108, 163, 245, 47, 191, 104, 212, 172, 156, 183, 168,
]);

pub const MULTISIG_TEST_ID: Pubkey = Pubkey::new_from_array([
    237, 101, 90, 99, 90, 225, 153, 19, 150, 14, 112, 117, 39, 184, 124, 3, 6, 215, 40, 129, 144,
    226, 241, 237, 44, 118, 135, 253, 189, 190, 158, 104,
]);

// Include both IDs in the static array
static IDS: [Pubkey; 2] = [MULTISIG_PROD_ID, MULTISIG_TEST_ID];


#[derive(Clone)]
pub struct MultisigAccount(Multisig);

impl anchor_lang::AccountDeserialize for MultisigAccount {
    fn try_deserialize_unchecked(buf: &mut &[u8]) -> Result<Self> {
        Multisig::try_deserialize(buf).map(MultisigAccount)
    }
}

impl anchor_lang::AccountSerialize for MultisigAccount {
    fn try_serialize<W: std::io::Write>(&self, writer: &mut W) -> Result<()> {
        self.0.try_serialize(writer)
    }
}

impl anchor_lang::Owners for MultisigAccount {
    fn owners() -> &'static [Pubkey] {
        &IDS
    }
}

impl Deref for MultisigAccount {
    type Target = Multisig;

    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

impl MultisigAccount {
    pub fn new(multisig: Multisig) -> Self {
        MultisigAccount(multisig)
    }
}


#[derive(Clone)]
pub struct VaultTransactionAccount(VaultTransaction);

impl anchor_lang::AccountDeserialize for VaultTransactionAccount {
    fn try_deserialize_unchecked(buf: &mut &[u8]) -> Result<Self> {
        VaultTransaction::try_deserialize(buf).map(VaultTransactionAccount)
    }
}

impl anchor_lang::AccountSerialize for VaultTransactionAccount {
    fn try_serialize<W: std::io::Write>(&self, writer: &mut W) -> Result<()> {
        self.0.try_serialize(writer)
    }
}

impl anchor_lang::Owners for VaultTransactionAccount {
    fn owners() -> &'static [Pubkey] {
        &IDS  // Using the same IDS as MultisigAccount
    }
}

impl Deref for VaultTransactionAccount {
    type Target = VaultTransaction;
    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

impl VaultTransactionAccount {
    pub fn new(vault_transaction: VaultTransaction) -> Self {
        VaultTransactionAccount(vault_transaction)
    }
}


#[derive(Clone)]
pub struct ProposalAccount(Proposal);

impl anchor_lang::AccountDeserialize for ProposalAccount {
    fn try_deserialize_unchecked(buf: &mut &[u8]) -> Result<Self> {
        Proposal::try_deserialize(buf).map(ProposalAccount)
    }
}

impl anchor_lang::AccountSerialize for ProposalAccount {
    fn try_serialize<W: std::io::Write>(&self, writer: &mut W) -> Result<()> {
        self.0.try_serialize(writer)
    }
}

impl anchor_lang::Owners for ProposalAccount {
    fn owners() -> &'static [Pubkey] {
        &IDS  // Using the same IDS as MultisigAccount
    }
}

impl Deref for ProposalAccount {
    type Target = Proposal;
    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

impl ProposalAccount {
    pub fn new(proposal: Proposal) -> Self {
        ProposalAccount(proposal)
    }
}