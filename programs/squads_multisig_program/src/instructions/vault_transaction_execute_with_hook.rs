use anchor_lang::prelude::*;
use solana_program::instruction::Instruction;
use solana_program::program::invoke_signed;

use crate::errors::*;
use crate::state::*;
use crate::utils::*;

#[derive(Accounts)]
pub struct VaultTransactionExecuteWithHook<'info> {
    #[account(
        seeds = [SEED_PREFIX, SEED_MULTISIG, multisig.create_key.as_ref()],
        bump = multisig.bump,
    )]
    pub multisig: Box<Account<'info, Multisig>>,

    /// The proposal account associated with the transaction.
    #[account(
        mut,
        seeds = [
            SEED_PREFIX,
            multisig.key().as_ref(),
            SEED_TRANSACTION,
            &transaction.index.to_le_bytes(),
            SEED_PROPOSAL,
        ],
        bump = proposal.bump,
    )]
    pub proposal: Account<'info, Proposal>,

    /// The transaction to execute.
    #[account(
        seeds = [
            SEED_PREFIX,
            multisig.key().as_ref(),
            SEED_TRANSACTION,
            &transaction.index.to_le_bytes(),
        ],
        bump = transaction.bump,
    )]
    pub transaction: Account<'info, VaultTransaction>,

    pub member: Signer<'info>,

    /// CHECK: We dont know the shape of the hook config, just its address derivation
    #[account(
        seeds = [
            b"hook",
            multisig.key().as_ref(),
            multisig.hook.clone().unwrap().instruction_name.as_bytes(),
        ],
        bump,
        seeds::program = hook_program
    )]
    pub hook_config: AccountInfo<'info>,

    /// CHECK: Just check that its a program and that it matches the hook
    #[account(
        address = multisig.hook.clone().unwrap().program_id,
        constraint = hook_program.executable == true,
    )]
    pub hook_program: AccountInfo<'info>,

    /// CHECK: Its just an account used to sign the hook instruction. Theres no
    /// data in it, so we just need to check its seeds
    #[account(
        seeds = [
            SEED_PREFIX,
            multisig.key().as_ref(),
            SEED_HOOK_AUTHORITY
        ],
        bump,
    )]
    pub hook_authority: AccountInfo<'info>,
    // `remaining_accounts` must include the following accounts in the exact order:
    // 1. AddressLookupTable accounts in the order they appear in `message.address_table_lookups`.
    // 2. Accounts in the order they appear in `message.account_keys`.
    // 3. Accounts in the order they appear in `message.address_table_lookups`.
}

impl VaultTransactionExecuteWithHook<'_> {
    fn validate(&self, ctx: &Context<Self>) -> Result<()> {
        let Self {
            multisig,
            proposal,
            transaction,
            member,
            hook_program,
            hook_config,
            hook_authority,
            ..
        } = self;

        // Multisig has a hook
        require!(multisig.hook.is_some(), MultisigError::NoHookEnabled);

        // member
        require!(
            multisig.is_member(member.key()).is_some(),
            MultisigError::NotAMember
        );
        require!(
            multisig.member_has_permission(member.key(), Permission::Execute),
            MultisigError::Unauthorized
        );

        // proposal
        match proposal.status {
            ProposalStatus::Approved { .. } => {
                require!(multisig.time_lock == 0, MultisigError::TimeLockNotReleased);
            }
            ProposalStatus::Active { timestamp: _ } => {
                require!(multisig.time_lock == 0, MultisigError::TimeLockNotReleased);
            }
            _ => return err!(MultisigError::InvalidProposalStatus),
        }
        // Stale vault transaction proposals CAN be executed if they were approved
        // before becoming stale, hence no check for staleness here.
        let account_infos = &[
            multisig.to_account_info(),
            proposal.to_account_info(),
            transaction.to_account_info(),
            hook_config.to_account_info(),
            hook_authority.to_account_info(),
        ];
        let account_metas = vec![
            AccountMeta::new_readonly(multisig.key(), false),
            AccountMeta::new_readonly(proposal.key(), false),
            AccountMeta::new_readonly(transaction.key(), false),
            AccountMeta::new_readonly(hook_config.key(), false),
            AccountMeta::new_readonly(hook_authority.key(), true),
        ];

        let multisig_key = multisig.as_ref().key();
        let hook_authority_signer_seeds: &[&[&[u8]]] = &[&[
            SEED_PREFIX,
            multisig_key.as_ref(),
            SEED_HOOK_AUTHORITY,
            &[ctx.bumps.hook_authority],
        ]];

        let hook_name = multisig.hook.clone().unwrap().instruction_name;
        let hook_instruction_name = format!("global:sqds_hook_{}_use", hook_name);

        let hook_instruction_discriminator: [u8; 8] =
            solana_program::hash::hash(hook_instruction_name.as_bytes()).to_bytes()[..8]
                .try_into()
                .unwrap();

        let hook_instruction = Instruction {
            program_id: hook_program.key(),
            accounts: account_metas,
            data: hook_instruction_discriminator.to_vec(),
        };

        let hook_result = invoke_signed(
            &hook_instruction,
            account_infos,
            hook_authority_signer_seeds,
        );
        require!(hook_result.is_ok(), MultisigError::HookFailed);
        Ok(())
    }

    /// Execute the multisig transaction.
    /// The transaction must be `Approved`.
    #[access_control(ctx.accounts.validate(&ctx))]
    pub fn vault_transaction_execute_with_hook(ctx: Context<Self>) -> Result<()> {
        let multisig = &mut ctx.accounts.multisig;
        let proposal = &mut ctx.accounts.proposal;

        // NOTE: After `take()` is called, the VaultTransaction is reduced to
        // its default empty value, which means it should no longer be referenced or
        // used after this point to avoid faulty behavior.
        // Instead only make use of the returned `transaction` value.
        let transaction = ctx.accounts.transaction.take();

        let multisig_key = multisig.key();
        let transaction_key = ctx.accounts.transaction.key();

        let vault_seeds = &[
            SEED_PREFIX,
            multisig_key.as_ref(),
            SEED_VAULT,
            &transaction.vault_index.to_le_bytes(),
            &[transaction.vault_bump],
        ];

        let transaction_message = transaction.message;
        let num_lookups = transaction_message.address_table_lookups.len();

        let message_account_infos = ctx
            .remaining_accounts
            .get(num_lookups..)
            .ok_or(MultisigError::InvalidNumberOfAccounts)?;
        let address_lookup_table_account_infos = ctx
            .remaining_accounts
            .get(..num_lookups)
            .ok_or(MultisigError::InvalidNumberOfAccounts)?;

        let vault_pubkey = Pubkey::create_program_address(vault_seeds, ctx.program_id).unwrap();

        let (ephemeral_signer_keys, ephemeral_signer_seeds) =
            derive_ephemeral_signers(transaction_key, &transaction.ephemeral_signer_bumps);

        let executable_message = ExecutableTransactionMessage::new_validated(
            transaction_message,
            message_account_infos,
            address_lookup_table_account_infos,
            &vault_pubkey,
            &ephemeral_signer_keys,
        )?;

        let protected_accounts = &[proposal.key()];

        // Execute the transaction message instructions one-by-one.
        // NOTE: `execute_message()` calls `self.to_instructions_and_accounts()`
        // which in turn calls `take()` on
        // `self.message.instructions`, therefore after this point no more
        // references or usages of `self.message` should be made to avoid
        // faulty behavior.
        executable_message.execute_message(
            vault_seeds,
            &ephemeral_signer_seeds,
            protected_accounts,
        )?;

        // Mark the proposal as executed.
        proposal.status = ProposalStatus::Executed {
            timestamp: Clock::get()?.unix_timestamp,
        };

        Ok(())
    }
}
