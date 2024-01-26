# Squads V4 CLI

The following is an overview of commands available to interact with the Squads V4 program via CLI.

Overview

1. Installation
2. Supported wallets
3. [Commands](#3.-commands)
   - [Create config transaction](#config-transaction-create)
   - [Execute config transaction](#config-transaction-execute)
   - [Create multisig](#multisig-create)
   - [Vote on proposals](#proposal-vote)
   - [Reclaim Vault Transaction rent](#vault-transaction-accounts-close)
  
# 1. Installation

# 2. Supported wallets

# 3. Commands

## Config Transaction Create

### Description
Creates a new configuration proposal transaction for a specific action. 

### Syntax
```bash
config_transaction_create --rpc_url <RPC_URL> --program_id <PROGRAM_ID> --keypair <KEYPAIR_PATH> --multisig_pubkey <MULTISIG_PUBLIC_KEY> --action <ACTION> [--memo <MEMO>]
```

### Parameters
- `--rpc_url <RPC_URL>`: (Optional) The URL of the Solana RPC endpoint. Defaults to mainnet if not specified.
- `--program_id <PROGRAM_ID>`: (Optional) The ID of the multisig program. Defaults to a standard ID if not specified.
- `--keypair <KEYPAIR_PATH>`: Path to your keypair file.
- `--multisig_pubkey <MULTISIG_PUBLIC_KEY>`: The public key of the multisig account.
- `--action <ACTION>`: The action to execute. Format depends on the action type.
- `--memo <MEMO>`: (Optional) A memo for the transaction.

### Examples
1. **Add a New Member:**
   ```bash
   config_transaction_create --keypair /path/to/keypair.json --multisig_pubkey <MULTISIG_PUBLIC_KEY> --action "AddMember <NEW_MEMBER_PUBLIC_KEY> <PERMISSIONS>"
   ```
   Adds a new member to the multisig configuration with specified permissions.
   Permissions:
   1: Initiate only
   7: All permissions (Initiate, Approve, Execute)

3. **Remove a Member:**
   ```bash
   config_transaction_create --keypair /path/to/keypair.json --multisig_pubkey <MULTISIG_PUBLIC_KEY> --action "RemoveMember <MEMBER_PUBLIC_KEY>"
   ```
   Removes an existing member from the multisig configuration.

4. **Change Threshold:**
   ```bash
   config_transaction_create --keypair /path/to/keypair.json --multisig_pubkey <MULTISIG_PUBLIC_KEY> --action "ChangeThreshold <NEW_THRESHOLD>"
   ```
   Changes the threshold number of signatures required for executing multisig transactions.

5. **Set Time Lock:**
   ```bash
   config_transaction_create --keypair /path/to/keypair.json --multisig_pubkey <MULTISIG_PUBLIC_KEY> --action "SetTimeLock <TIME_LOCK_VALUE>"
   ```
   Sets a time lock for the multisig account. 

6. **Add Spending Limit:**
   ```bash
   config_transaction_create --keypair /path/to/keypair.json --multisig_pubkey <MULTISIG_PUBLIC_KEY> --action "AddSpendingLimit <CREATE_KEY> <VAULT_INDEX> <MINT> <AMOUNT> <PERIOD> <MEMBERS> <DESTINATIONS>"
   ```
   Adds a spending limit to the multisig account.

7. **Remove Spending Limit:**
   ```bash
   config_transaction_create --keypair /path/to/keypair.json --multisig_pubkey <MULTISIG_PUBLIC_KEY> --action "RemoveSpendingLimit <SPENDING_LIMIT_PUBKEY>"
   ```
   Removes an existing spending limit from the multisig account.

8. **Set Rent Collector:**
   ```bash
   config_transaction_create --keypair /path/to/keypair.json --multisig_pubkey <MULTISIG_PUBLIC_KEY> --action "SetRentCollector <NEW_RENT_COLLECTOR_PUBKEY>"
   ```
   Sets a new rent collector for the multisig account.

## Config Transaction Execute

### Description
Executes a proposed transaction for a multisig configuration change. This command is used to execute configuration transactions once they have reached threshold.

### Syntax
```bash
config_transaction_execute --rpc_url <RPC_URL> --program_id <PROGRAM_ID> --keypair <KEYPAIR_PATH> --multisig_pubkey <MULTISIG_PUBLIC_KEY> --transaction_index <TRANSACTION_INDEX>
```

### Parameters
- `--rpc_url <RPC_URL>`: (Optional) The URL of the Solana RPC endpoint. Defaults to mainnet if not specified.
- `--program_id <PROGRAM_ID>`: (Optional) The ID of the multisig program. Defaults to a standard ID if not specified.
- `--keypair <KEYPAIR_PATH>`: Path to your keypair file.
- `--multisig_pubkey <MULTISIG_PUBLIC_KEY>`: The public key of the multisig account.
- `--transaction_index <TRANSACTION_INDEX>`: The index of the transaction to be executed.

### Example Usage
```bash
config_transaction_execute --keypair /path/to/keypair.json --multisig_pubkey <MULTISIG_PUBLIC_KEY> --transaction_index 1
```

## Multisig Create

### Description
Creates a new multisig with initial members and threshold configuration.

### Syntax
```bash
multisig_create --rpc_url <RPC_URL> --program_id <PROGRAM_ID> --keypair <KEYPAIR_PATH> --config_authority <CONFIG_AUTHORITY> --members <MEMBER_1> <MEMBER_2> ... --threshold <THRESHOLD>
```

### Parameters
- `--rpc_url <RPC_URL>`: (Optional) The URL of the Solana RPC endpoint. Defaults to mainnet if not specified.
- `--program_id <PROGRAM_ID>`: (Optional) The ID of the multisig program. Defaults to a standard ID if not specified.
- `--keypair <KEYPAIR_PATH>`: Path to your keypair file.
- `--config_authority <CONFIG_AUTHORITY>`: (Optional) Address of the Program Config Authority.
- `--members <MEMBER_...>`: List of members' public keys, separated by spaces.
- `--threshold <THRESHOLD>`: The threshold number of signatures required for executing multisig transactions.

### Example Usage
1. **Creating a Multisig with Two Members:**
   ```bash
   multisig_create --keypair /path/to/keypair.json --members "Member1PubKey,Permission1" "Member2PubKey,Permission2" --threshold 2
   ```
   Creates a new multisig account with two members and a threshold of 2.

2. **Creating a Multisig with Config Authority:**
   ```bash
   multisig_create --keypair /path/to/keypair.json --config_authority <CONFIG_AUTHORITY_PUBKEY> --members "Member1PubKey,Permission1" "Member2PubKey,Permission2" --threshold 1
   ```
   Initializes a multisig account with a specified config authority and a threshold of 1.

## Proposal Vote

### Description
Casts a vote on a proposed transaction proposal. This command allows a member of a multisig to approve, reject, or cancel a transaction proposal.

### Syntax
```bash
proposal_vote --rpc_url <RPC_URL> --program_id <PROGRAM_ID> --keypair <KEYPAIR_PATH> --multisig_pubkey <MULTISIG_PUBLIC_KEY> --transaction_index <TRANSACTION_INDEX> --action <ACTION> [--memo <MEMO>]
```

### Parameters
- `--rpc_url <RPC_URL>`: (Optional) The URL of the Solana RPC endpoint. Defaults to mainnet if not specified.
- `--program_id <PROGRAM_ID>`: (Optional) The ID of the multisig program. Defaults to a standard ID if not specified.
- `--keypair <KEYPAIR_PATH>`: Path to your keypair file.
- `--multisig_pubkey <MULTISIG_PUBLIC_KEY>`: The public key of the multisig account.
- `--transaction_index <TRANSACTION_INDEX>`: The index of the transaction to vote on.
- `--action <ACTION>`: The vote action to cast (Approve, Reject, Cancel).
- `--memo <MEMO>`: (Optional) A memo for the vote.

### Example Usage
1. **Approving a Transaction:**
   ```bash
   proposal_vote --keypair /path/to/keypair.json --multisig_pubkey <MULTISIG_PUBLIC_KEY> --transaction_index 1 --action Approve
   ```
   Casts an approval vote for the transaction at index 1 in the specified multisig account.

2. **Rejecting a Transaction:**
   ```bash
   proposal_vote --keypair /path/to/keypair.json --multisig_pubkey <MULTISIG_PUBLIC_KEY> --transaction_index 1 --action Reject
   ```
   Casts a rejection vote for the transaction at index 1.

3. **Cancelling a Transaction:**
   ```bash
   proposal_vote --keypair /path/to/keypair.json --multisig_pubkey <MULTISIG_PUBLIC_KEY> --transaction_index 1 --action Cancel
   ```
   Cancels the transaction at index 1 in the multisig account.

## Vault Transaction Accounts Close

### Description
Closes the accounts associated with a specific transaction in a multisig vault on the Solana blockchain. This command is used to collect rent from the transaction accounts and clean up state.

### Syntax
```bash
vault_transaction_accounts_close --rpc_url <RPC_URL> --program_id <PROGRAM_ID> --keypair <KEYPAIR_PATH> --multisig_pubkey <MULTISIG_PUBLIC_KEY> --transaction_index <TRANSACTION_INDEX> --rent_collector <RENT_COLLECTOR_PUBKEY>
```

### Parameters
- `--rpc_url <RPC_URL>`: (Optional) The URL of the Solana RPC endpoint. Defaults to mainnet if not specified.
- `--program_id <PROGRAM_ID>`: (Optional) The ID of the multisig program. Defaults to a standard ID if not specified.
- `--keypair <KEYPAIR_PATH>`: Path to your keypair file.
- `--multisig_pubkey <MULTISIG_PUBLIC_KEY>`: The public key of the multisig account.
- `--transaction_index <TRANSACTION_INDEX>`: The index of the transaction whose accounts are to be closed.
- `--rent_collector <RENT_COLLECTOR_PUBKEY>`: The public key of the account responsible for collecting rent.

### Example Usage
```bash
vault_transaction_accounts_close --keypair /path/to/keypair.json --multisig_pubkey <MULTISIG_PUBLIC_KEY> --transaction_index 1 --rent_collector <RENT_COLLECTOR_PUBKEY>
```
In this example, the command closes the transaction accounts for the transaction at index 1 in the specified multisig account and collects rent using the provided rent collector public key.
