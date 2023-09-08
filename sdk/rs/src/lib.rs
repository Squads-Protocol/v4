pub use multisig::errors;
pub use multisig::ID;
pub use multisig::program::Multisig;


pub mod state {
    pub use multisig::state::{
       Batch, ConfigAction, ConfigTransaction, Member, Multisig, MultisigCompiledInstruction, MultisigMessageAddressTableLookup, Period,Permission,Permissions,Proposal,ProposalStatus, 
    };
}

pub mod cpi {
    use anchor_lang::prelude::{CpiContext, Result, Pubkey};
    use multisig::Member;


    pub use multisig::cpi::accounts::{
        BatchAddTransaction, BatchCreate, BatchExecuteTransaction,ConfigTransactionCreate,ConfigTransactionExecute,MultisigAddSpendingLimit,MultisigConfig,MultisigCreate,MultisigRemoveSpendingLimit,ProposalActivate,ProposalCreate,ProposalVote,SpendingLimitUse,VaultTransactionCreate,VaultTransactionExecute
   
    };

    pub fn create_multisig<'info>(
        ctx: CpiContext<'_, '_, '_, 'info, MultisigCreate<'info>>,
        members: Vec<Member>,
        threshold: u16,
        config_authority: Option<Pubkey>,
        time_lock: u32,
        memo: Option<String>,
    ) -> Result<()> {
       
        multisig::cpi::multisig_create(ctx, multisig::MultisigCreateArgs { members, threshold, config_authority, time_lock, memo })
    }

}

pub mod client {
    use anchor_lang::prelude::{Pubkey};
    
    use anchor_lang::{
        solana_program::{instruction::Instruction},
        InstructionData, ToAccountMetas
    };
   
    
    pub use multisig::accounts::ConfigTransactionCreate as ConfigTransactionCreateAccounts;
    pub use multisig::instruction::ConfigTransactionCreate as ConfigTransactionCreateData;
    pub use multisig::instructions::ConfigTransactionCreateArgs;
    
    pub use multisig::multisig::config_transaction_create;
    pub use multisig::state::Multisig;
    
    
    pub fn create_config_transaction(
    accounts: ConfigTransactionCreateAccounts,
    data: ConfigTransactionCreateData,
        program_id: Option<Pubkey>
    ) -> Instruction {
       Instruction {
        accounts: accounts.to_account_metas(Some(false)),
        data: data.data(),
        program_id: multisig::ID,
       }    
    }

    #[cfg(test)]
    mod test {
        use super::*;
       
        #[test]
        fn test_create_config_transaction() {
        
        let data = ConfigTransactionCreateData {
            args: ConfigTransactionCreateArgs { actions: vec![super::super::state::ConfigAction::ChangeThreshold { new_threshold: 2 }], memo: None }
        };

        let accounts = ConfigTransactionCreateAccounts {
            multisig: Pubkey::new_unique(),
            creator: Pubkey::new_unique(),
            system_program: Pubkey::new_unique(),
            transaction: Pubkey::new_unique(),
        };

        create_config_transaction(accounts, data, Some(multisig::ID));
        }
    }
}
