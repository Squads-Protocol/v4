//! The v3 -> 4r planner: refuses roles delegate members, plans one v3 transaction (the successor
//! creation first, then one migrate instruction per item), and builds its proposal and executes.
//! The same rules as `v3Migration.ts` in `@sqds/multisig-4r`.

use std::fmt;

use solana_address::Address;
use solana_instruction::Instruction;
use squads_multisig_4r_program::message::AddressLookupTableAccount;

use crate::planner::{
    MemberSigningReport, MigrationGroup, MigrationItem, V3MigrationSource, V4VaultInventory,
};
use crate::v3::{
    get_v3_delegate_pda, get_v3_roles_user_pda, Role, RolesManager, RolesUser, V3_ROLES_PROGRAM_ID,
};

/// A v3 member that is a roles delegate: only the roles program signs for it.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct V3DelegateMember {
    pub delegate: Address,
    /// The roles `User` account.
    pub user: Address,
    /// The wallet that signs for the delegate in v3; the member that replaces it.
    pub origin_key: Address,
    pub role: Role,
    pub name: String,
}

/// The v3 multisig has roles delegate members. They can never sign 4r instructions.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct V3DelegateMembersError {
    pub source_multisig: Address,
    pub delegates: Vec<V3DelegateMember>,
}

impl fmt::Display for V3DelegateMembersError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let header = [
            format!(
                "v3 multisig {} has {} roles delegate member(s). A delegate signs only through",
                self.source_multisig,
                self.delegates.len()
            ),
            "the v3 roles program, so it can never sign in 4r, and the successor would copy it as a member.".into(),
            "Before you migrate, change the v3 members in a v3 transaction of authority 0: for each delegate,".into(),
            "add_member(wallet) and remove_member(delegate); then check the threshold, which counts each member once.".into(),
            "Delegate -> wallet:".into(),
        ];
        let lines = self.delegates.iter().map(|member| {
            format!(
                "  - {} -> {} (role {:?}, user \"{}\")",
                member.delegate, member.origin_key, member.role, member.name
            )
        });
        let message: Vec<String> = header.into_iter().chain(lines).collect();
        f.write_str(&message.join("\n"))
    }
}

impl std::error::Error for V3DelegateMembersError {}

/// The roles users (1 to `role_index`) of `source_multisig`, from its roles manager account
/// (`owner`, `data`). Empty when it is not a roles manager of this multisig.
pub fn v3_roles_users(source_multisig: &Address, owner: &Address, data: &[u8]) -> Vec<Address> {
    RolesManager::decode(data)
        .filter(|manager| *owner == V3_ROLES_PROGRAM_ID && manager.ms == *source_multisig)
        .map(|manager| {
            (1..=manager.role_index)
                .map(|index| get_v3_roles_user_pda(source_multisig, index).0)
                .collect()
        })
        .unwrap_or_default()
}

/// The roles delegates among `keys`. `users`: each roles user that exists, with its owner and data.
/// Users cannot be removed or change their wallet, so all users find every delegate.
pub fn v3_delegate_members<'a>(
    source_multisig: &Address,
    keys: &[Address],
    users: impl IntoIterator<Item = (Address, &'a Address, &'a [u8])>,
) -> Vec<V3DelegateMember> {
    users
        .into_iter()
        .filter(|(_, owner, _)| **owner == V3_ROLES_PROGRAM_ID)
        .filter_map(|(user, _, data)| RolesUser::decode(data).map(|decoded| (user, decoded)))
        .filter(|(_, decoded)| decoded.ms == *source_multisig)
        .filter_map(|(user, decoded)| {
            let delegate = get_v3_delegate_pda(&user, &decoded.origin_key).0;
            keys.contains(&delegate).then_some(V3DelegateMember {
                delegate,
                user,
                origin_key: decoded.origin_key,
                role: decoded.role,
                name: decoded.name,
            })
        })
        .collect()
}

/// A migration plan for one v3 authority.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct V3MigrationPlan {
    pub source: V3MigrationSource,
    /// The v3 authority that signs and pays.
    pub source_vault: Address,
    pub successor: Address,
    /// The successor vault `authority_index - 1`.
    pub vault_index: u8,
    pub vault: Address,
    pub events: bool,
    /// `multisig_create_from_v3`, when the successor does not exist yet. It runs first.
    pub create_successor: Option<Instruction>,
    /// The 4r creation fee in lamports, also the `max_creation_fee` of `create_successor`.
    pub creation_fee: Option<u64>,
    /// `None` until the successor exists. `Some(false)`: every migrate instruction fails.
    pub governance_matches: Option<bool>,
    pub inventory: V4VaultInventory,
    pub groups: Vec<MigrationGroup>,
    pub items: Vec<MigrationItem>,
    /// The lookup tables of the execute transactions (the attached instructions cannot use them).
    pub address_lookup_tables: Vec<AddressLookupTableAccount>,
    pub member_report: MemberSigningReport,
    pub warnings: Vec<String>,
}

#[cfg(feature = "fetch")]
pub use fetch::*;

#[cfg(feature = "fetch")]
mod fetch {
    use std::collections::HashSet;

    use solana_account::Account;
    use solana_address::Address;
    use solana_instruction::Instruction;
    use solana_rpc_client::nonblocking::rpc_client::RpcClient;
    use squads_multisig_4r_program::builders::{self, MultisigCreateFromV3};
    use squads_multisig_4r_program::instructions::MultisigCreateFromV3Args;
    use squads_multisig_4r_program::message::AddressLookupTableAccount;
    use squads_multisig_4r_program::migration::get_successor_pda;
    use squads_multisig_4r_program::migration::v3::check_same_governance_v3;
    use squads_multisig_4r_program::pda::{get_program_config_pda, get_vault_pda};
    use squads_multisig_4r_program::state::ProgramConfig;

    use super::*;
    use crate::error::{ClientError, ClientResult};
    use crate::planner::{
        chunk_migration_groups, count_new_token_accounts, fetch_vault_inventory,
        invalid_authority_index, inventory_groups, member_report_warnings, member_signing_report,
        v3_authority_addresses, vault_addresses, ChunkInput, InventoryScans, MigrationLimits,
        MigrationOptions, ReportedMember, ATA_RENT_ESTIMATE,
    };
    use crate::rpc::{fetch, fetch_multisig};
    use crate::v3::{
        activate_transaction, add_instruction, approve_transaction, create_transaction,
        execute_instruction, get_v3_authority_pda, get_v3_instruction_pda,
        get_v3_roles_manager_pda, get_v3_transaction_pda, v3_vault_index, Ms, MsInstruction,
        MsTransaction, LEGACY_V3_PROGRAM_ID,
    };

    async fn fetch_optional(rpc: &RpcClient, address: &Address) -> ClientResult<Option<Account>> {
        Ok(rpc
            .get_account_with_commitment(address, rpc.commitment())
            .await?
            .value)
    }

    async fn fetch_accounts(
        rpc: &RpcClient,
        addresses: &[Address],
    ) -> ClientResult<Vec<Option<Account>>> {
        let mut accounts = Vec::with_capacity(addresses.len());
        for chunk in addresses.chunks(100) {
            accounts.extend(rpc.get_multiple_accounts(chunk).await?);
        }
        Ok(accounts)
    }

    fn owned_by_v3(account: Option<Account>) -> Option<Account> {
        account.filter(|account| account.owner == LEGACY_V3_PROGRAM_ID)
    }

    /// The v3 multisig at `address`, after the owner and discriminator checks.
    pub async fn fetch_v3_multisig(rpc: &RpcClient, address: &Address) -> ClientResult<Ms> {
        owned_by_v3(fetch_optional(rpc, address).await?)
            .and_then(|account| Ms::decode(&account.data))
            .ok_or_else(|| ClientError::Plan(format!("{address} is not a v3 multisig")))
    }

    /// The v3 transaction `transaction_index` of `source_multisig`.
    pub async fn fetch_v3_transaction(
        rpc: &RpcClient,
        source_multisig: &Address,
        transaction_index: u32,
    ) -> ClientResult<MsTransaction> {
        let transaction = get_v3_transaction_pda(source_multisig, transaction_index).0;
        owned_by_v3(fetch_optional(rpc, &transaction).await?)
            .and_then(|account| MsTransaction::decode(&account.data))
            .ok_or_else(|| ClientError::Plan(format!("{transaction} is not a v3 transaction")))
    }

    /// The roles delegates among `keys`, from every roles user of `source_multisig`.
    pub async fn find_v3_delegate_members(
        rpc: &RpcClient,
        source_multisig: &Address,
        keys: &[Address],
    ) -> ClientResult<Vec<V3DelegateMember>> {
        let manager = get_v3_roles_manager_pda(source_multisig).0;
        let users = fetch_optional(rpc, &manager)
            .await?
            .map(|account| v3_roles_users(source_multisig, &account.owner, &account.data))
            .unwrap_or_default();
        let accounts = fetch_accounts(rpc, &users).await?;
        let present: Vec<(Address, Account)> = users
            .into_iter()
            .zip(accounts)
            .filter_map(|(user, account)| account.map(|account| (user, account)))
            .collect();
        Ok(v3_delegate_members(
            source_multisig,
            keys,
            present
                .iter()
                .map(|(user, account)| (*user, &account.owner, account.data.as_slice())),
        ))
    }

    /// The inputs of [`plan_v3_migration`].
    #[derive(Debug, Clone, Copy)]
    pub struct V3PlanInput<'a> {
        pub source_multisig: Address,
        /// The v3 authority (1 to 256); 1 is the v3 default vault.
        pub authority_index: u32,
        /// The 4r program; default the mainnet ID.
        pub program_id: Option<&'a Address>,
        pub events: bool,
        pub options: MigrationOptions,
        pub address_lookup_tables: &'a [AddressLookupTableAccount],
        /// Default: [`MigrationLimits::V3`].
        pub limits: Option<MigrationLimits>,
        pub scans: InventoryScans,
        pub extra_mints: &'a [Address],
    }

    /// Plans the move of one v3 authority to its successor vault. Reads the chain and sends
    /// nothing. Fails with [`ClientError::V3DelegateMembers`] when a v3 member is a roles delegate.
    pub async fn plan_v3_migration(
        rpc: &RpcClient,
        input: V3PlanInput<'_>,
    ) -> ClientResult<V3MigrationPlan> {
        let V3PlanInput {
            source_multisig,
            authority_index,
            ..
        } = input;
        let vault_index = v3_vault_index(authority_index)
            .map_err(|_| invalid_authority_index(authority_index))?;
        let program_id = *input.program_id.unwrap_or(&squads_multisig_4r_program::ID);
        let r4 = Some(&program_id);
        let source = fetch_v3_multisig(rpc, &source_multisig).await?;
        let delegates = find_v3_delegate_members(rpc, &source_multisig, &source.keys).await?;
        if !delegates.is_empty() {
            return Err(V3DelegateMembersError {
                source_multisig,
                delegates,
            }
            .into());
        }

        let successor = get_successor_pda(&source_multisig, r4).0;
        let source_vault = get_v3_authority_pda(&source_multisig, authority_index).0;
        let vault = get_vault_pda(&successor, vault_index, r4).0;
        let governance_matches = match fetch_optional(rpc, &successor).await? {
            Some(_) => {
                let successor_state = fetch_multisig(rpc, &successor, r4).await?;
                Some(check_same_governance_v3(&source.governance(), &successor_state).is_ok())
            }
            None => None,
        };
        let (create_successor, creation_fee) = match governance_matches {
            Some(_) => (None, None),
            None => {
                let program_config = get_program_config_pda(r4).0;
                let config: ProgramConfig = fetch(rpc, &program_config, r4).await?;
                let create = MultisigCreateFromV3::new(
                    source_multisig,
                    authority_index,
                    config.treasury,
                    r4,
                )
                .instruction(
                    MultisigCreateFromV3Args {
                        authority_index,
                        // The members approve the fee that the plan sees; a higher fee fails.
                        max_creation_fee: config.multisig_creation_fee,
                        memo: None,
                    },
                    r4,
                )?;
                let create = match input.events {
                    true => builders::with_events(create),
                    false => create,
                };
                (Some(create), Some(config.multisig_creation_fee))
            }
        };

        let inventory = fetch_vault_inventory(
            rpc,
            &source_vault,
            vault_index,
            input.scans,
            input.extra_mints,
        )
        .await?;
        let (groups, notes) = inventory_groups(&inventory, input.options);
        let migration_source = V3MigrationSource {
            source_multisig,
            authority_index,
            program_id: Some(program_id),
        };
        let items = chunk_migration_groups(
            &groups,
            &ChunkInput {
                source: migration_source,
                events: input.events,
                address_lookup_tables: input.address_lookup_tables,
                limits: input.limits.unwrap_or(MigrationLimits::V3),
            },
        )?;
        let known_vaults: HashSet<Address> = v3_authority_addresses(&source_multisig)
            .into_iter()
            .chain(vault_addresses(&successor, &program_id))
            .collect();
        let members: Vec<ReportedMember> = source
            .keys
            .iter()
            .map(|key| ReportedMember {
                key: *key,
                votes: true,
            })
            .collect();
        let member_report = member_signing_report(&members, source.threshold, &known_vaults);
        let new_token_accounts = count_new_token_accounts(rpc, &groups, &vault).await?;
        let needed = new_token_accounts * ATA_RENT_ESTIMATE + creation_fee.unwrap_or(0);
        let warnings = inventory
            .warnings
            .iter()
            .cloned()
            .chain(notes)
            .chain(member_report_warnings(&member_report))
            .chain((governance_matches == Some(false)).then(|| {
                "the successor governance differs from v3: the migrate instructions fail until they agree".to_string()
            }))
            .chain((inventory.lamports < needed).then(|| {
                format!("the v3 authority has too little SOL for {new_token_accounts} new token accounts and the creation fee; fund it first")
            }))
            .collect();
        Ok(V3MigrationPlan {
            source: migration_source,
            source_vault,
            successor,
            vault_index,
            vault,
            events: input.events,
            create_successor,
            creation_fee,
            governance_matches,
            inventory,
            groups,
            items,
            address_lookup_tables: input.address_lookup_tables.to_vec(),
            member_report,
            warnings,
        })
    }

    /// The v3 proposal of a plan: the transactions to send in order, and the v3 transaction index.
    #[derive(Debug, Clone, PartialEq, Eq)]
    pub struct V3MigrationProposal {
        pub transactions: Vec<Vec<Instruction>>,
        pub transaction_index: u32,
        /// The attached instructions, in execution order: the successor creation first, if any.
        pub instructions: Vec<Instruction>,
    }

    /// One v3 transaction of the plan's authority: the creation (if needed), then every item.
    /// `member` creates, attaches, activates and (with `approve`) approves it. Sends nothing.
    pub async fn v3_migration_proposal(
        rpc: &RpcClient,
        plan: &V3MigrationPlan,
        member: &Address,
        approve: bool,
    ) -> ClientResult<V3MigrationProposal> {
        let multisig = plan.source.source_multisig;
        let source = fetch_v3_multisig(rpc, &multisig).await?;
        let instructions: Vec<Instruction> = plan
            .create_successor
            .iter()
            .cloned()
            .chain(plan.items.iter().map(|item| item.instruction.clone()))
            .collect();
        if instructions.len() > usize::from(u8::MAX) {
            return Err(ClientError::Plan(
                "a v3 transaction holds at most 255 instructions; split the plan".into(),
            ));
        }
        let transaction_index = source.transaction_index.checked_add(1).ok_or_else(|| {
            ClientError::Plan("the v3 transaction index is at its maximum".into())
        })?;
        let transaction = get_v3_transaction_pda(&multisig, transaction_index).0;
        let attach = instructions
            .iter()
            .zip(1..=u8::MAX)
            .map(|(instruction, index)| {
                let instruction_account = get_v3_instruction_pda(&transaction, index).0;
                vec![add_instruction(
                    &multisig,
                    &transaction,
                    &instruction_account,
                    member,
                    instruction,
                )]
            });
        let votes = std::iter::once(activate_transaction(&multisig, &transaction, member))
            .chain(approve.then(|| approve_transaction(&multisig, &transaction, member)))
            .collect();
        let transactions = std::iter::once(vec![create_transaction(
            &multisig,
            &transaction,
            member,
            plan.source.authority_index,
        )])
        .chain(attach)
        .chain(std::iter::once(votes))
        .collect();
        Ok(V3MigrationProposal {
            transactions,
            transaction_index,
            instructions,
        })
    }

    /// The `execute_instruction` call of each attached instruction of an approved v3 transaction
    /// that has not run yet, in order. Send them one at a time: a later one needs the earlier ones.
    pub async fn v3_execute_instructions(
        rpc: &RpcClient,
        source_multisig: &Address,
        transaction_index: u32,
        member: &Address,
    ) -> ClientResult<Vec<Instruction>> {
        let multisig = *source_multisig;
        let transaction = get_v3_transaction_pda(&multisig, transaction_index).0;
        let data = fetch_v3_transaction(rpc, &multisig, transaction_index).await?;
        let instruction_accounts: Vec<Address> = (1..=data.instruction_index)
            .filter(|index| *index > data.executed_index)
            .map(|index| get_v3_instruction_pda(&transaction, index).0)
            .collect();
        let attached = fetch_accounts(rpc, &instruction_accounts).await?;
        instruction_accounts
            .iter()
            .zip(attached)
            .map(|(instruction_account, account)| {
                let decoded = owned_by_v3(account)
                    .and_then(|account| MsInstruction::decode(&account.data))
                    .ok_or_else(|| {
                        ClientError::Plan(format!("{instruction_account} is not a v3 instruction"))
                    })?;
                Ok(execute_instruction(
                    &multisig,
                    &transaction,
                    instruction_account,
                    member,
                    &decoded,
                ))
            })
            .collect()
    }
}
