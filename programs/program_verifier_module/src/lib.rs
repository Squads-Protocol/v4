use anchor_lang::prelude::*;
use squads_multisig_program::{program::SquadsMultisigProgram, state::VaultTransaction};

declare_id!("3z3PNrpRoJrvKH8iTaFstnMAemEmMZht69V2nBSFtGJM");

#[program]
pub mod additionalmodule {

    use super::*;

    pub fn verify(ctx: Context<Verify>) -> Result<()> {
        let system_program_id = Pubkey::try_from("11111111111111111111111111111111").unwrap();
        let transaction = &ctx.accounts.transaction;

        // map through the instructions and find the program id for each
        transaction
            .message
            .instructions
            .iter()
            .for_each(|instruction| {
                let program_id_index = instruction.program_id_index;
                let program_id = transaction.message.account_keys[program_id_index as usize];
                assert!(program_id == system_program_id);
            });

        Ok(())
    }
}

#[derive(Accounts)]
pub struct CreateModule<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,
    pub multisig: Account<'info, squads_multisig_program::state::Multisig>,
    pub system_program: Program<'info, System>,
    pub squads_program: Program<'info, SquadsMultisigProgram>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct Verify<'info> {
    pub signer: Signer<'info>,
    pub transaction: Account<'info, VaultTransaction>,
}

#[account]
pub struct AllowedPrograms {
    pub programs: Vec<Pubkey>,
}
