# Squads V4 CLI

The following is an overview of commands available to interact with the Squads V4 program via CLI.

Overview

1. Installation
2. Supported wallets
3. [Commands](#3.-commands)
   - [Create config transaction](#config-transaction-create)
   - [Execute config transaction](#config-transaction-execute)
  


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
2. **Remove a Member:**
   ```bash
   config_transaction_create --keypair /path/to/keypair.json --multisig_pubkey <MULTISIG_PUBLIC_KEY> --action "RemoveMember <MEMBER_PUBLIC_KEY>"
   ```
3. **Change Threshold:**
   ```bash
   config_transaction_create --keypair /path/to/keypair.json --multisig_pubkey <MULTISIG_PUBLIC_KEY> --action "ChangeThreshold <NEW_THRESHOLD>"
   ```
4. **Set Time Lock:**
   ```bash
   config_transaction_create --keypair /path/to/keypair.json --multisig_pubkey <MULTISIG_PUBLIC_KEY> --action "SetTimeLock <TIME_LOCK_VALUE>"
   ```
5. **Add Spending Limit:**
   ```bash
   config_transaction_create --keypair /path/to/keypair.json --multisig_pubkey <MULTISIG_PUBLIC_KEY> --action "AddSpendingLimit <CREATE_KEY> <VAULT_INDEX> <MINT> <AMOUNT> <PERIOD> <MEMBERS> <DESTINATIONS>"
   ```

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
