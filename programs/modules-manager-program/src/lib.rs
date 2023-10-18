use anchor_lang::prelude::*;
use squads_multisig::squads_multisig_program::program::SquadsMultisigProgram;
use squads_multisig::state::Proposal;
use squads_multisig::state::{ConfigTransaction, Multisig};
use squads_multisig::{cpi::MultisigConfig, state::Permissions};

declare_id!("8fuNtycEZ5BEGv98x1GRxwoV5MU3ZJXW2Ff3tco33b26");

#[program]
pub mod poc3 {

    use squads_multisig::{
        cpi::{ConfigTransactionCreate, VaultTransactionExecute},
        squads_multisig_program::MultisigAddMemberArgs,
        state::{ConfigAction, Member, Permission},
    };
    use squads_multisig_program::ConfigTransactionCreateArgs;

    use super::*;

    pub fn create_modules_manager(ctx: Context<CreateModulesManager>) -> Result<()> {
        let multisig = &mut ctx.accounts.multisig;

        let member = Member {
            key: ctx.accounts.modules_manager.key(),
            permissions: Permissions::from_vec(&[Permission::Execute]),
        };

        let add_member_cpi_accounts = MultisigConfig {
            multisig: multisig.to_account_info(),
            config_authority: ctx.accounts.signer.to_account_info(),
            rent_payer: Some(ctx.accounts.signer.to_account_info()),
            system_program: Some(ctx.accounts.system_program.to_account_info()),
        };

        let add_member_cpi_context = CpiContext::new(
            ctx.accounts.squads_program.to_account_info(),
            add_member_cpi_accounts,
        );

        let multisig_add_member_args = MultisigAddMemberArgs {
            new_member: member,
            memo: Some("Adding the new member".to_string()),
        };

        squads_multisig_program::cpi::multisig_add_member(
            add_member_cpi_context,
            multisig_add_member_args,
        )?;

        Ok(())
    }

    pub fn create_modules_manager_with_config_transaction(
        ctx: Context<CreateModulesManagerWithConfigTransaction>,
    ) -> Result<()> {
        let multisig = &mut ctx.accounts.multisig;

        let new_member = Member {
            key: ctx.accounts.modules_manager.key(),
            permissions: Permissions::from_vec(&[Permission::Execute]),
        };

        let create_config_transaction_cpi_accounts = ConfigTransactionCreate {
            creator: ctx.accounts.signer.to_account_info(),
            multisig: multisig.to_account_info(),
            transaction: ctx.accounts.config_transaction.to_account_info(),
            rent_payer: ctx.accounts.signer.to_account_info(),
            system_program: ctx.accounts.system_program.to_account_info(),
        };

        let create_config_transaction_cpi_context = CpiContext::new(
            ctx.accounts.squads_program.to_account_info(),
            create_config_transaction_cpi_accounts,
        );

        let config_action = ConfigAction::AddMember { new_member };

        let config_transaction_create_args = ConfigTransactionCreateArgs {
            actions: vec![config_action],
            memo: Some("Creating the config transaction".to_string()),
        };

        squads_multisig_program::cpi::config_transaction_create(
            create_config_transaction_cpi_context,
            config_transaction_create_args,
        )?;

        Ok(())
    }

    pub fn add_module(ctx: Context<AddModule>, module: Module) -> Result<()> {
        let modules_manager = &mut ctx.accounts.modules_manager;
        require!(
            ctx.accounts
                .multisig
                .is_member(ctx.accounts.signer.key())
                .is_some(),
            squads_multisig::squads_multisig_program::errors::MultisigError::NotAMember
        );
        modules_manager.modules.push(module);
        Ok(())
    }

    pub fn execute_vault_transaction(ctx: Context<ExecuteVaultTransaction>) -> Result<()> {
        let module_manager = &ctx.accounts.modules_manager;
        for module in &module_manager.modules {
            // Check if the module's program_id exists in the remaining accounts
            let module_account = ctx
                .remaining_accounts
                .iter()
                .find(|account| account.key() == module.program);

            if module_account.is_none() {
                return Err(ErrorCode::MissingModuleAccount.into());
            }

            // Prepare for the CPI call to the module
            let cpi_program = module.program;
            let cpi_accounts = vec![AccountMeta::new_readonly(
                ctx.accounts.vault_transaction.key(),
                false,
            )];
            let cpi_instruction_data = &module.discriminator;

            // Make the CPI call

            let accounts = [ctx.accounts.vault_transaction.to_account_info()];

            // add remaining accounts to accounts array as array

            anchor_lang::solana_program::program::invoke(
                &anchor_lang::solana_program::instruction::Instruction {
                    program_id: cpi_program,
                    accounts: cpi_accounts.to_account_metas(None), // Assumes accounts are not signers
                    data: cpi_instruction_data.clone(),
                },
                accounts.as_slice(),
            )?;
        }

        let execute_cpi_accounts = VaultTransactionExecute {
            member: ctx.accounts.modules_manager.to_account_info(),
            multisig: ctx.accounts.multisig.to_account_info(),
            proposal: ctx.accounts.vault_transaction.to_account_info(),
            transaction: ctx.accounts.vault_transaction.to_account_info(),
        };

        let multisig = ctx.accounts.multisig.key();
        let my_state_seeds = &[
            b"modules_manager".as_ref(),
            multisig.as_ref(),
            &[*ctx.bumps.get("modules_manager").unwrap()],
        ];
        let pda_signer = &[&my_state_seeds[..]];
        let execute_cpi_context = CpiContext::new(
            ctx.accounts.squads_program.to_account_info(),
            execute_cpi_accounts,
        )
        .with_signer(pda_signer);

        squads_multisig_program::cpi::vault_transaction_execute(execute_cpi_context)?;

        Ok(())
    }
}

#[derive(Accounts)]
pub struct CreateModulesManager<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(mut)]
    pub multisig: Account<'info, Multisig>,

    #[account(init, space = 300, payer = signer, seeds = [b"modules_manager".as_ref(), multisig.key().as_ref()], bump)]
    pub modules_manager: Account<'info, ModulesManager>,

    pub squads_program: Program<'info, SquadsMultisigProgram>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CreateModulesManagerWithConfigTransaction<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(mut)]
    pub multisig: Account<'info, Multisig>,

    #[account(init, space = 300, payer = signer, seeds = [b"modules_manager".as_ref(), multisig.key().as_ref()], bump)]
    pub modules_manager: Account<'info, ModulesManager>,

    pub config_transaction: Account<'info, ConfigTransaction>,

    pub squads_program: Program<'info, SquadsMultisigProgram>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct AddModule<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(mut)]
    pub modules_manager: Account<'info, ModulesManager>,

    pub multisig: Account<'info, Multisig>,
}

#[derive(Accounts)]
pub struct ExecuteVaultTransaction<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(mut)]
    pub modules_manager: Account<'info, ModulesManager>,

    #[account(mut)]
    pub vault_transaction: Account<'info, squads_multisig_program::state::VaultTransaction>,

    #[account(mut)]
    pub proposal: Account<'info, Proposal>,

    pub squads_program: Program<'info, SquadsMultisigProgram>,

    pub multisig: Account<'info, Multisig>,

    pub system_program: Program<'info, System>,
}

#[account]
pub struct ModulesManager {
    pub modules: Vec<Module>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct Module {
    pub name: String,
    pub program: Pubkey,
    pub discriminator: Vec<u8>,
}

#[error_code]
pub enum ErrorCode {
    #[msg("The module manager is inactive.")]
    ModuleManagerInactive,
    #[msg("A required module account is missing.")]
    MissingModuleAccount,
}
