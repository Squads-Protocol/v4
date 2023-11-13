use anchor_lang::prelude::*;

use squads_multisig_program::cpi::accounts::ConfigTransactionCreate;
use squads_multisig_program::cpi::accounts::MultisigConfig;
use squads_multisig_program::cpi::accounts::VaultTransactionExecute;
use squads_multisig_program::program::SquadsMultisigProgram;
use squads_multisig_program::state::Permissions;
use squads_multisig_program::state::{ConfigAction, Member, Permission};
use squads_multisig_program::state::{ConfigTransaction, Multisig};
use squads_multisig_program::state::{Proposal, VaultTransaction};

declare_id!("CWkz6sLyq6Kpj2TfNZadKBXREDcf9QTcC4auLYn7vCrZ");

#[program]
pub mod squads_modules_program {
    use anchor_lang::solana_program::config;
    use squads_multisig_program::{
        cpi::accounts::ConfigTransactionExecute, cpi::accounts::MultisigConfig,
        ConfigTransactionCreateArgs, MultisigAddMemberArgs, MultisigRemoveMemberArgs,
        MultisigSetConfigAuthorityArgs,
    };

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

        msg!("Hi");

        let add_member_cpi_context = CpiContext::new(
            ctx.accounts.squads_program.to_account_info(),
            add_member_cpi_accounts,
        );

        let add_member_args = MultisigAddMemberArgs {
            new_member: member,
            memo: Some("adding member".to_string()),
        };

        squads_multisig_program::cpi::multisig_add_member(add_member_cpi_context, add_member_args)?;

        ctx.accounts.multisig.members.iter().for_each(|member| {
            if Permissions::has(&member.permissions, Permission::Execute) {
                let member_permissions_without_execute =
                    member.permissions.mask & !(Permission::Execute as u8);

                let remove_member_cpi_context = CpiContext::new(
                    ctx.accounts.squads_program.to_account_info(),
                    MultisigConfig {
                        config_authority: ctx.accounts.signer.to_account_info(),
                        multisig: ctx.accounts.multisig.to_account_info(),
                        rent_payer: Some(ctx.accounts.signer.to_account_info()),
                        system_program: Some(ctx.accounts.system_program.to_account_info()),
                    },
                );
                let remove_member_args = MultisigRemoveMemberArgs {
                    old_member: member.key,
                    memo: Some("removing member".to_string()),
                };

                squads_multisig_program::cpi::multisig_remove_member(
                    remove_member_cpi_context,
                    remove_member_args,
                );

                let add_member_cpi_context = CpiContext::new(
                    ctx.accounts.squads_program.to_account_info(),
                    MultisigConfig {
                        config_authority: ctx.accounts.signer.to_account_info(),
                        multisig: ctx.accounts.multisig.to_account_info(),
                        rent_payer: Some(ctx.accounts.signer.to_account_info()),
                        system_program: Some(ctx.accounts.system_program.to_account_info()),
                    },
                );

                let add_member_args = MultisigAddMemberArgs {
                    new_member: Member {
                        key: member.key,
                        permissions: Permissions {
                            mask: member_permissions_without_execute,
                        },
                    },
                    memo: Some("adding member".to_string()),
                };

                squads_multisig_program::cpi::multisig_add_member(
                    add_member_cpi_context,
                    add_member_args,
                );
            }
        });

        // change config authority to the modules manager
        let cpi_context = CpiContext::new(
            ctx.accounts.squads_program.to_account_info(),
            MultisigConfig {
                config_authority: ctx.accounts.signer.to_account_info(),
                multisig: ctx.accounts.multisig.to_account_info(),
                rent_payer: Some(ctx.accounts.signer.to_account_info()),
                system_program: Some(ctx.accounts.system_program.to_account_info()),
            },
        );

        let set_config_authority_args = MultisigSetConfigAuthorityArgs {
            config_authority: ctx.accounts.modules_manager.key(),
            memo: Some("setting config authority".to_string()),
        };
        squads_multisig_program::cpi::multisig_set_config_authority(
            cpi_context,
            set_config_authority_args,
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

        let config_transaction_args = ConfigTransactionCreateArgs {
            actions: vec![config_action],
            memo: Some("Creating the config transaction".to_string()),
        };

        squads_multisig_program::cpi::config_transaction_create(
            create_config_transaction_cpi_context,
            config_transaction_args,
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
            squads_multisig_program::errors::MultisigError::NotAMember
        );
        modules_manager.modules.push(module);
        Ok(())
    }

    pub fn execute_vault_transaction<'info>(
        ctx: Context<'_, '_, '_, 'info, ExecuteVaultTransaction<'info>>,
    ) -> Result<()> {
        /*
        let module_manager = &ctx.accounts.modules_manager;
        for module in &module_manager.modules {

            let module_account = ctx
                .remaining_accounts
                .iter()
                .find(|account| account.key() == module.program);

            if module_account.is_none() {
                return Err(ErrorCode::MissingModuleAccount.into());
            }


            let cpi_program = module.program;
            let cpi_accounts = vec![AccountMeta::new_readonly(
                ctx.accounts.vault_transaction.key(),
                false,
            )];
            let cpi_instruction_data = &module.discriminator;



            let accounts = [ctx.accounts.vault_transaction.to_account_info()];



            anchor_lang::solana_program::program::invoke(
                &anchor_lang::solana_program::instruction::Instruction {
                    program_id: cpi_program,
                    accounts: cpi_accounts.to_account_metas(None),
                    data: cpi_instruction_data.clone(),
                },
                accounts.as_slice(),
            )?;
        }
        */
        let multisig_key = ctx.accounts.multisig.key();
        let my_state_seeds = &[
            b"modules_manager".as_ref(),
            multisig_key.as_ref(),
            &[*ctx.bumps.get("modules_manager").unwrap()],
        ];
        let pda_signer = &[&my_state_seeds[..]];

        let execute_cpi_accounts = VaultTransactionExecute {
            member: ctx.accounts.modules_manager.to_account_info(),
            multisig: ctx.accounts.multisig.to_account_info(),
            proposal: ctx.accounts.proposal.to_account_info(),
            transaction: ctx.accounts.vault_transaction.to_account_info(),
        };

        let execute_cpi_context = CpiContext::new(
            ctx.accounts.squads_program.to_account_info(),
            execute_cpi_accounts,
        )
        .with_remaining_accounts(ctx.remaining_accounts.to_vec())
        .with_signer(pda_signer);

        squads_multisig_program::cpi::vault_transaction_execute(execute_cpi_context)?;

        Ok(())
    }

    pub fn execute_module_vault_transaction<'info>(
        ctx: Context<'_, '_, '_, 'info, ExecuteModuleVaultTransaction<'info>>,
    ) -> Result<()> {
        let module_manager = &ctx.accounts.modules_manager;
        for module in &module_manager.modules {
            msg!("{:?}", module.program.to_string());
            // Check if the module's program_id exists in the remaining accounts
            let module_program = ctx
                .remaining_accounts
                .iter()
                .find(|program| program.key() == module.program);

            if module_program.is_none() {
                return Err(ErrorCode::MissingModuleAccount.into());
            }

            let cpi_accounts = vec![
                AccountMeta::new(ctx.accounts.signer.key(), true),
                AccountMeta::new_readonly(ctx.accounts.vault_transaction.key(), false),
            ];
            let cpi_instruction_data = &module.discriminator;

            msg!("{:?}", cpi_instruction_data);

            let accounts = [
                ctx.accounts.signer.to_account_info(),
                ctx.accounts.vault_transaction.to_account_info(),
                module_program.unwrap().to_account_info(),
            ];

            anchor_lang::solana_program::program::invoke(
                &anchor_lang::solana_program::instruction::Instruction {
                    program_id: module.program,
                    accounts: cpi_accounts.to_account_metas(Some(true)), // there are signers
                    data: cpi_instruction_data.clone(),
                },
                accounts.as_slice(),
            )?;
        }

        let mut members_to_readd = Vec::new();
        let signer_key = ctx.accounts.signer.key();
        let module_manager_key = ctx.accounts.modules_manager.key();

        for member in &ctx.accounts.multisig.members {
            if member.key != signer_key
                && member.key != module_manager_key
                && Permissions::has(&member.permissions, Permission::Vote)
            {
                members_to_readd.push((member.key, member.permissions));
            }
        }

        let multisig_key = ctx.accounts.multisig.key();
        let my_state_seeds = &[
            b"modules_manager".as_ref(),
            multisig_key.as_ref(),
            &[*ctx.bumps.get("modules_manager").unwrap()],
        ];
        let pda_signer = &[&my_state_seeds[..]];

        for (pubkey, _) in &members_to_readd {
            let remove_member_args = MultisigRemoveMemberArgs {
                old_member: *pubkey,
                memo: None,
            };

            let remove_member_cpi_context = CpiContext::new(
                ctx.accounts.squads_program.to_account_info(),
                MultisigConfig {
                    config_authority: ctx.accounts.modules_manager.to_account_info(),
                    multisig: ctx.accounts.multisig.to_account_info(),
                    rent_payer: Some(ctx.accounts.signer.to_account_info()),
                    system_program: Some(ctx.accounts.system_program.to_account_info()),
                },
            )
            .with_signer(pda_signer);

            squads_multisig_program::cpi::multisig_remove_member(
                remove_member_cpi_context,
                remove_member_args,
            )?;
        }

        let execute_cpi_accounts = VaultTransactionExecute {
            member: ctx.accounts.modules_manager.to_account_info(),
            multisig: ctx.accounts.multisig.to_account_info(),
            proposal: ctx.accounts.proposal.to_account_info(),
            transaction: ctx.accounts.vault_transaction.to_account_info(),
        };

        let number_of_execute_accounts = ctx.accounts.vault_transaction.message.account_keys.len();

        let execute_remaining_accounts =
            ctx.remaining_accounts[0..number_of_execute_accounts].to_vec();

        let execute_cpi_context = CpiContext::new(
            ctx.accounts.squads_program.to_account_info(),
            execute_cpi_accounts,
        )
        .with_remaining_accounts(execute_remaining_accounts)
        .with_signer(pda_signer);

        squads_multisig_program::cpi::vault_transaction_execute(execute_cpi_context)?;

        for (pubkey, permissions) in members_to_readd {
            let member = Member {
                key: pubkey,
                permissions,
            };

            let add_member_cpi_context = CpiContext::new(
                ctx.accounts.squads_program.to_account_info(),
                MultisigConfig {
                    config_authority: ctx.accounts.modules_manager.to_account_info(),
                    multisig: ctx.accounts.multisig.to_account_info(),
                    rent_payer: Some(ctx.accounts.signer.to_account_info()),
                    system_program: Some(ctx.accounts.system_program.to_account_info()),
                },
            )
            .with_signer(pda_signer);

            let add_member_args = MultisigAddMemberArgs {
                new_member: member,
                memo: None,
            };

            squads_multisig_program::cpi::multisig_add_member(
                add_member_cpi_context,
                add_member_args,
            )?;
        }

        Ok(())
    }

    pub fn execute_config_transaction<'info>(
        ctx: Context<'_, '_, '_, 'info, ExecuteConfigTransaction<'info>>,
    ) -> Result<()> {
        let module_manager = &ctx.accounts.modules_manager;

        let config_transaction = &ctx.accounts.config_transaction;

        let multisig_key = ctx.accounts.multisig.key();
        let my_state_seeds = &[
            b"modules_manager".as_ref(),
            multisig_key.as_ref(),
            &[*ctx.bumps.get("modules_manager").unwrap()],
        ];
        let pda_signer = &[&my_state_seeds[..]];

        let config_transaction_execute_cpi_context = CpiContext::new(
            ctx.accounts.squads_program.to_account_info(),
            ConfigTransactionExecute {
                member: ctx.accounts.modules_manager.to_account_info(),
                multisig: ctx.accounts.multisig.to_account_info(),
                proposal: ctx.accounts.proposal.to_account_info(),
                transaction: ctx.accounts.config_transaction.to_account_info(),
                rent_payer: Some(ctx.accounts.signer.to_account_info()),
                system_program: Some(ctx.accounts.system_program.to_account_info()),
            },
        )
        .with_signer(pda_signer);

        squads_multisig_program::cpi::config_transaction_execute(
            config_transaction_execute_cpi_context,
        )?;

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

    #[account(mut, seeds = ["modules_manager".as_ref(), multisig.key().as_ref()], bump)]
    pub modules_manager: Account<'info, ModulesManager>,

    #[account(mut)]
    pub vault_transaction: Account<'info, VaultTransaction>,

    #[account(mut)]
    pub proposal: Account<'info, Proposal>,

    pub squads_program: Program<'info, SquadsMultisigProgram>,

    pub multisig: Account<'info, Multisig>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ExecuteModuleVaultTransaction<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(mut, seeds = ["modules_manager".as_ref(), multisig.key().as_ref()], bump)]
    pub modules_manager: Account<'info, ModulesManager>,

    #[account(mut)]
    pub vault_transaction: Account<'info, VaultTransaction>,

    #[account(mut)]
    pub proposal: Account<'info, Proposal>,

    pub squads_program: Program<'info, SquadsMultisigProgram>,

    #[account(mut)]
    pub multisig: Account<'info, Multisig>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ExecuteConfigTransaction<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(mut, seeds = ["modules_manager".as_ref(), multisig.key().as_ref()], bump)]
    pub modules_manager: Account<'info, ModulesManager>,

    #[account(mut)]
    pub config_transaction: Account<'info, ConfigTransaction>,

    #[account(mut)]
    pub proposal: Account<'info, Proposal>,

    pub squads_program: Program<'info, SquadsMultisigProgram>,

    #[account(mut)]
    pub multisig: Account<'info, Multisig>,

    pub system_program: Program<'info, System>,
}

#[account]
pub struct ModulesManager {
    pub modules: Vec<Module>,
    pub config_authorities: Vec<Pubkey>,
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
