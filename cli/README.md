# Squads V4 CLI

The following is an overview of commands available to interact with the Squads V4 program via CLI.

Overview

1. [Installation](#1-installation)
2. [Supported wallets](#2-supported-wallets)
3. [Commands](#3-commands)
   - [Create config transaction](#config-transaction-create)
   - [Execute config transaction](#config-transaction-execute)
   - [Create multisig](#multisig-create)
   - [Vote on proposals](#proposal-vote)
   - [Reclaim Vault Transaction rent](#vault-transaction-accounts-close)
   - [Create new Vault Transaction](#vault-transaction-create)
   - [Execute Vault Transaction](#vault-transaction-execute)
   - [Display Vault Transaction](#display-transaction)
   - [Display Config Transaction](#display-config-transaction)
   - [Claim Rent](#claim-rent)
   - [Display Proposals](#display-proposals)
   - [Display Vault](#display-vault)
   - [Initiate Transfer](#initiate-transfer)
   - [Initiate Batch Transfer](#initiate-batch-transfer)
   - [Initiate Program Upgrade](#initiate-program-upgrade)
   - [Program Config Init](#program-config-init)

# 1. Installation

You can install the CLI with Cargo.
For this an installation of Rust will be needed. You can find installation steps [here](https://www.rust-lang.org/tools/install).

Now, install the Squads CLI.

```bash
cargo install squads-multisig-cli
```

# 2. Supported wallets

The Squads CLI has exactly the same wallet support as the Solana CLI, meaning it supports file system wallets as well as Ledger hardware wallets.

### File system wallets

You can easily use your local filesystem wallet by using it as the "keypair" argument in commands.

```bash
squads-multisig-cli example-command --keypair /path/to/keypair.json
```

This specifies the path of the Keypair that you want to use to sign a CLI transaction.

### Ledger support

To use a Ledger with the Squads CLI, just specify the Ledger device URL in the "keypair" argument.

```bash
squads-multisig-cli example-command --keypair usb://ledger
```

This will use the default derivation path of your Ledger.

```bash
squads-multisig-cli example-command --keypair usb://ledger/BsNsvfXqQTtJnagwFWdBS7FBXgnsK8VZ5CmuznN85swK?key=0/0
```

This specifies a custom derivation path. You can read more about it [here](https://docs.solana.com/wallet-guide/hardware-wallets/ledger).

# 3. Commands

## Config Transaction Create

### Description

Creates a new configuration proposal transaction for a specific action.

### Syntax

```bash
config-transaction-create --rpc-url <RPC_URL> --program-id <PROGRAM_ID> --keypair <KEYPAIR_PATH> --multisig-pubkey <MULTISIG_PUBLIC_KEY> --action <ACTION> [--memo <MEMO>]
```

### Parameters

- `--rpc-url <RPC_URL>`: (Optional) The URL of the Solana RPC endpoint. Defaults to mainnet if not specified.
- `--program-id <PROGRAM_ID>`: (Optional) The ID of the multisig program. Defaults to a standard ID if not specified.
- `--keypair <KEYPAIR_PATH>`: Path to your keypair file.
- `--multisig-pubkey <MULTISIG_PUBLIC_KEY>`: The public key of the multisig account.
- `--action <ACTION>`: The action to execute. Format depends on the action type.
- `--memo <MEMO>`: (Optional) A memo for the transaction.

### Examples

1. **Add a New Member:**

   ```bash
   config-transaction-create --keypair /path/to/keypair.json --multisig-pubkey <MULTISIG_PUBLIC_KEY> --action "AddMember <NEW_MEMBER_PUBLIC_KEY> <PERMISSIONS>"
   ```

   Adds a new member to the multisig configuration with specified permissions.
   Permissions:
   1: Initiate only
   7: All permissions (Initiate, Approve, Execute)

2. **Remove a Member:**

   ```bash
   config-transaction-create --keypair /path/to/keypair.json --multisig-pubkey <MULTISIG_PUBLIC_KEY> --action "RemoveMember <MEMBER_PUBLIC_KEY>"
   ```

   Removes an existing member from the multisig configuration.

3. **Change Threshold:**

   ```bash
   config-transaction-create --keypair /path/to/keypair.json --multisig-pubkey <MULTISIG_PUBLIC_KEY> --action "ChangeThreshold <NEW_THRESHOLD>"
   ```

   Changes the threshold number of signatures required for executing multisig transactions.

4. **Set Time Lock:**

   ```bash
   config-transaction-create --keypair /path/to/keypair.json --multisig-pubkey <MULTISIG_PUBLIC_KEY> --action "SetTimeLock <TIME_LOCK_VALUE>"
   ```

   Sets a time lock for the multisig account.

5. **Add Spending Limit:**

   ```bash
   config-transaction-create --keypair /path/to/keypair.json --multisig-pubkey <MULTISIG_PUBLIC_KEY> --action "AddSpendingLimit <CREATE_KEY> <VAULT_INDEX> <MINT> <AMOUNT> <PERIOD> <MEMBERS> <DESTINATIONS>"
   ```

   Adds a spending limit to the multisig account.

6. **Remove Spending Limit:**

   ```bash
   config-transaction-create --keypair /path/to/keypair.json --multisig-pubkey <MULTISIG_PUBLIC_KEY> --action "RemoveSpendingLimit <SPENDING_LIMIT_PUBKEY>"
   ```

   Removes an existing spending limit from the multisig account.

7. **Set Rent Collector:**
   ```bash
   config-transaction-create --keypair /path/to/keypair.json --multisig-pubkey <MULTISIG_PUBLIC_KEY> --action "SetRentCollector <NEW_RENT_COLLECTOR_PUBKEY>"
   ```
   Sets a new rent collector for the multisig account.

## Config Transaction Execute

### Description

Executes a proposed transaction for a multisig configuration change. This command is used to execute configuration transactions once they have reached threshold.

### Syntax

```bash
config-transaction-execute --rpc-url <RPC_URL> --program-id <PROGRAM_ID> --keypair <KEYPAIR_PATH> --multisig-pubkey <MULTISIG_PUBLIC_KEY> --transaction-index <TRANSACTION_INDEX>
```

### Parameters

- `--rpc-url <RPC_URL>`: (Optional) The URL of the Solana RPC endpoint. Defaults to mainnet if not specified.
- `--program-id <PROGRAM_ID>`: (Optional) The ID of the multisig program. Defaults to a standard ID if not specified.
- `--keypair <KEYPAIR_PATH>`: Path to your keypair file.
- `--multisig-pubkey <MULTISIG_PUBLIC_KEY>`: The public key of the multisig account.
- `--transaction-index <TRANSACTION_INDEX>`: The index of the transaction to be executed.

### Example Usage

```bash
config-transaction-execute --keypair /path/to/keypair.json --multisig-pubkey <MULTISIG_PUBLIC_KEY> --transaction-index 1
```

## Multisig Create

### Description

Creates a new multisig with initial members and threshold configuration.

### Syntax

```bash
multisig-create --rpc-url <RPC_URL> --program-id <PROGRAM_ID> --keypair <KEYPAIR_PATH> --config-authority <CONFIG_AUTHORITY> --members <MEMBER_1> <MEMBER_2> ... --threshold <THRESHOLD>
```

### Parameters

- `--rpc-url <RPC_URL>`: (Optional) The URL of the Solana RPC endpoint. Defaults to mainnet if not specified.
- `--program-id <PROGRAM_ID>`: (Optional) The ID of the multisig program. Defaults to a standard ID if not specified.
- `--keypair <KEYPAIR_PATH>`: Path to your keypair file.
- `--config-authority <CONFIG_AUTHORITY>`: (Optional) Address of the Program Config Authority.
- `--members <MEMBER_...>`: List of members' public keys, separated by spaces.
- `--threshold <THRESHOLD>`: The threshold number of signatures required for executing multisig transactions.
- `--rent-collector <RENT_COLLECTOR>` : The Public key that will be able to reclaim rent from canceled and executed transactions.

### Example Usage

1. **Creating a Multisig with Two Members:**

   ```bash
   multisig-create --keypair /path/to/keypair.json --members "Member1PubKey,Permission1" "Member2PubKey,Permission2" --threshold 2
   ```

   Creates a new multisig account with two members and a threshold of 2.

2. **Creating a Multisig with Config Authority:**

   ```bash
   multisig-create --keypair /path/to/keypair.json --config-authority <CONFIG_AUTHORITY_PUBKEY> --members "Member1PubKey,Permission1" "Member2PubKey,Permission2" --threshold 1
   ```

   Initializes a multisig account with a specified config authority and a threshold of 1.

3. **Creating a Multisig with Rent Collector:**
   ```bash
   multisig-create --keypair /path/to/keypair.json --config-authority <RENT_COLLECTOR_PUBKEY> --members "Member1PubKey,Permission1" "Member2PubKey,Permission2" --threshold 1
   ```
   Initializes a multisig account with a specified rent collector and a threshold of 1.

## Proposal Vote

### Description

Casts a vote on a proposed transaction proposal. This command allows a member of a multisig to approve, reject, or cancel a transaction proposal.

### Syntax

```bash
proposal-vote --rpc_url <RPC_URL> --program-id <PROGRAM_ID> --keypair <KEYPAIR_PATH> --multisig-pubkey <MULTISIG_PUBLIC_KEY> --transaction-index <TRANSACTION_INDEX> --action <ACTION> [--memo <MEMO>]
```

### Parameters

- `--rpc-url <RPC_URL>`: (Optional) The URL of the Solana RPC endpoint. Defaults to mainnet if not specified.
- `--program-id <PROGRAM_ID>`: (Optional) The ID of the multisig program. Defaults to a standard ID if not specified.
- `--keypair <KEYPAIR_PATH>`: Path to your keypair file.
- `--multisig-pubkey <MULTISIG_PUBLIC_KEY>`: The public key of the multisig account.
- `--transaction-index <TRANSACTION_INDEX>`: The index of the transaction to vote on.
- `--action <ACTION>`: The vote action to cast (Approve, Reject, Cancel).
- `--memo <MEMO>`: (Optional) A memo for the vote.

### Example Usage

1. **Approving a Transaction:**

   ```bash
   proposal-vote --keypair /path/to/keypair.json --multisig-pubkey <MULTISIG_PUBLIC_KEY> --transaction_index 1 --action Approve
   ```

   Casts an approval vote for the transaction at index 1 in the specified multisig account.

2. **Rejecting a Transaction:**

   ```bash
   proposal-vote --keypair /path/to/keypair.json --multisig-pubkey <MULTISIG_PUBLIC_KEY> --transaction_index 1 --action Reject
   ```

   Casts a rejection vote for the transaction at index 1.

3. **Cancelling a Transaction:**
   ```bash
   proposal-vote --keypair /path/to/keypair.json --multisig-pubkey <MULTISIG_PUBLIC_KEY> --transaction-index 1 --action Cancel
   ```
   Cancels the transaction at index 1 in the multisig account.

## Vault Transaction Accounts Close

### Description

Closes the proposal and transaction accounts associated with a specific Vault Transaction. The rent will be returned to the multisigs "rent_collector".

### Syntax

```bash
vault-transaction_accounts-close --rpc_url <RPC_URL> --program-id <PROGRAM_ID> --keypair <KEYPAIR_PATH> --multisig-pubkey <MULTISIG_PUBLIC_KEY> --transaction-index <TRANSACTION_INDEX> --rent-collector <RENT_COLLECTOR_PUBKEY>
```

### Parameters

- `--rpc-url <RPC_URL>`: (Optional) The URL of the Solana RPC endpoint. Defaults to mainnet if not specified.
- `--program-id <PROGRAM_ID>`: (Optional) The ID of the multisig program. Defaults to a standard ID if not specified.
- `--keypair <KEYPAIR_PATH>`: Path to your keypair file.
- `--multisig-pubkey <MULTISIG_PUBLIC_KEY>`: The public key of the multisig account.
- `--transaction-index <TRANSACTION_INDEX>`: The index of the transaction whose accounts are to be closed.
- `--rent-collector <RENT_COLLECTOR_PUBKEY>`: The public key of the account responsible for collecting rent.

### Example Usage

```bash
vault-transaction-accounts-close --keypair /path/to/keypair.json --multisig-pubkey <MULTISIG_PUBLIC_KEY> --transaction-index 1 --rent-collector <RENT_COLLECTOR_PUBKEY>
```

In this example, the command closes the transaction accounts for the transaction at index 1 in the specified multisig account and collects rent using the provided rent collector public key.

## Vault Transaction Create

### Description

Creates a new vault transaction with a custom transaction message.

### Syntax

```bash
vault-transaction-create --rpc-url <RPC_URL> --program-id <PROGRAM_ID> --keypair <KEYPAIR_PATH> --multisig-pubkey <MULTISIG_PUBLIC_KEY> --vault-index <VAULT_INDEX> --transaction-message <TRANSACTION_MESSAGE> [--memo <MEMO>]
```

### Parameters

- `--rpc-url <RPC_URL>`: (Optional) The URL of the Solana RPC endpoint. Defaults to mainnet if not specified.
- `--program-id <PROGRAM_ID>`: (Optional) The ID of the multisig program. Defaults to a standard ID if not specified.
- `--keypair <KEYPAIR_PATH>`: Path to your keypair file.
- `--multisig-pubkey <MULTISIG_PUBLIC_KEY>`: The public key of the multisig account.
- `--vault-index <VAULT_INDEX>`: The index of the vault where the transaction is being created.
- `--transaction-message <TRANSACTION_MESSAGE>`: The message or payload of the transaction.
- `--memo <MEMO>`: (Optional) A memo for the transaction.

### Example Usage

```bash
vault-transaction-create --keypair /path/to/keypair.json --multisig-pubkey <MULTISIG_PUBLIC_KEY> --vault-index 1 --transaction-message [1, 2, 3, 5, 5, 6, 7, 8]
```

In this example, a new transaction with the specified message is proposed in the multisig vault at vault index 1.

## Vault Transaction Execute

### Description

Executes a transaction once its proposal has reachen threshold.

### Syntax

```bash
vault-transaction-execute --rpc-url <RPC_URL> --program-id <PROGRAM_ID> --keypair <KEYPAIR_PATH> --multisig-pubkey <MULTISIG_PUBLIC_KEY> --transaction-index <TRANSACTION_INDEX>
```

### Parameters

- `--rpc-url <RPC_URL>`: (Optional) The URL of the Solana RPC endpoint. Defaults to mainnet if not specified.
- `--program-id <PROGRAM_ID>`: (Optional) The ID of the multisig program. Defaults to a standard ID if not specified.
- `--keypair <KEYPAIR_PATH>`: Path to your keypair file.
- `--multisig-pubkey <MULTISIG_PUBLIC_KEY>`: The public key of the multisig account.
- `--transaction-index <TRANSACTION_INDEX>`: The index of the transaction to be executed.

### Example Usage

```bash
vault-transaction-execute --keypair /path/to/keypair.json --multisig-pubkey <MULTISIG_PUBLIC_KEY> --transaction-index 1
```

This example executes the transaction at index 1 in the specified multisig.

## Display Transaction

### Description

Fetches a vault transaction account and displays its decoded instructions, including each instruction's program ID, accounts (with writable/signer flags), base58-encoded data, and any address lookup tables used.

### Syntax

```bash
display-transaction --transaction-address <TRANSACTION_ADDRESS> [--rpc-url <RPC_URL>]
```

### Parameters

- `--transaction-address <TRANSACTION_ADDRESS>`: The public key of the VaultTransaction account to inspect.
- `--rpc-url <RPC_URL>`: (Optional) The URL of the Solana RPC endpoint. Defaults to `https://api.mainnet-beta.solana.com`.

### Example Usage

```bash
squads-multisig-cli display-transaction --transaction-address 279SBhVyHLEBsphBkDBNMUbSoA31yRBDtnU5mzSM3d5n
```

## Display Config Transaction

### Description

Fetches a config transaction account and displays its decoded actions, such as adding or removing members, changing the threshold, setting the time lock, managing spending limits, and updating the rent collector.

### Syntax

```bash
display-config-transaction --transaction-address <TRANSACTION_ADDRESS> [--rpc-url <RPC_URL>]
```

### Parameters

- `--transaction-address <TRANSACTION_ADDRESS>`: The public key of the ConfigTransaction account to inspect.
- `--rpc-url <RPC_URL>`: (Optional) The URL of the Solana RPC endpoint. Defaults to `https://api.mainnet-beta.solana.com`.

### Example Usage

```bash
squads-multisig-cli display-config-transaction --transaction-address AQb6VyZGzC2kL7vFU7WqoTJYTNZdHKhKuHmzuxkqGGjV
```

## Claim Rent

### Description

Scans executed or terminal proposals for a multisig and reclaims rent from closed 
vault, config, and batch transaction accounts, returning SOL to the multisig 
`rent_collector`.

### Syntax

```bash
claim-rent --keypair <KEYPAIR_PATH> --multisig-pubkey <MULTISIG_PUBLIC_KEY> [--rpc-url <RPC_URL>] [--program-id <PROGRAM_ID>] [--fee-payer-keypair <FEE_PAYER_PATH>] [--last-n <LAST_N>] [--dry-run] [--priority-fee-lamports <LAMPORTS>]
```

### Parameters

- `--rpc-url <RPC_URL>`: (Optional) The URL of the Solana RPC endpoint. Defaults to mainnet if not specified.
- `--program-id <PROGRAM_ID>`: (Optional) The ID of the multisig program. Defaults to a standard ID if not specified.
- `--keypair <KEYPAIR_PATH>`: Path to your keypair file (fee payer unless `--fee-payer-keypair` is set).
- `--fee-payer-keypair <FEE_PAYER_PATH>`: (Optional) Path to a separate fee payer keypair.
- `--multisig-pubkey <MULTISIG_PUBLIC_KEY>`: The public key of the multisig account.
- `--last-n <LAST_N>`: (Optional) Number of most recent transaction indices to scan. Defaults to 500.
- `--dry-run`: (Optional) List closable accounts and estimated rent only; does not send any transactions.
- `--priority-fee-lamports <LAMPORTS>`: (Optional) Priority fee in lamports. Defaults to 5000.

### Example Usage

```bash
claim-rent --keypair /path/to/keypair.json --multisig-pubkey <MULTISIG_PUBLIC_KEY>
```

Dry run to preview reclaimable rent without sending transactions:

```bash
claim-rent --keypair /path/to/keypair.json --multisig-pubkey <MULTISIG_PUBLIC_KEY> --dry-run
```

## Display Proposals

### Description

Fetches and displays all outstanding proposals for a multisig, showing their 
status (Draft, Active, Approved), transaction index, proposal PDA, and 
current vote counts.

### Syntax

```bash
display-proposals --multisig-pubkey <MULTISIG_PUBLIC_KEY> [--rpc-url <RPC_URL>] [--program-id <PROGRAM_ID>] [--limit <LIMIT>]
```

### Parameters

- `--rpc-url <RPC_URL>`: (Optional) The URL of the Solana RPC endpoint. Defaults to mainnet if not specified.
- `--program-id <PROGRAM_ID>`: (Optional) The ID of the multisig program. Defaults to a standard ID if not specified.
- `--multisig-pubkey <MULTISIG_PUBLIC_KEY>`: The public key of the multisig account.
- `--limit <LIMIT>`: (Optional) Maximum number of recent transactions to check. Defaults to 20.

### Example Usage

```bash
display-proposals --multisig-pubkey <MULTISIG_PUBLIC_KEY>
```

## Display Vault

### Description

Derives and displays the vault PDA address for a given multisig and vault index.

### Syntax

```bash
display-vault --multisig-address <MULTISIG_ADDRESS> [--program-id <PROGRAM_ID>] [--vault-index <VAULT_INDEX>]
```

### Parameters

- `--program-id <PROGRAM_ID>`: (Optional) The ID of the multisig program. Defaults to a standard ID if not specified.
- `--multisig-address <MULTISIG_ADDRESS>`: The public key of the multisig account.
- `--vault-index <VAULT_INDEX>`: (Optional) The vault index to derive. Defaults to 0.

### Example Usage

```bash
display-vault --multisig-address <MULTISIG_PUBLIC_KEY>
```

```bash
display-vault --multisig-address <MULTISIG_PUBLIC_KEY> --vault-index 1
```

## Initiate Transfer

### Description

Creates and activates a vault transaction that transfers SPL tokens from the 
multisig vault. Supports both wallet addresses (ATA is derived automatically) 
and direct token account addresses as recipient. Optionally approves the 
proposal atomically in the same transaction.

### Syntax

```bash
initiate-transfer --keypair <KEYPAIR_PATH> --multisig-pubkey <MULTISIG_PUBLIC_KEY> --vault-index <VAULT_INDEX> --token-mint-address <MINT> --token-amount-u64 <AMOUNT> --recipient <RECIPIENT> [--rpc-url <RPC_URL>] [--program-id <PROGRAM_ID>] [--token-program-id <TOKEN_PROGRAM_ID>] [--fee-payer-keypair <FEE_PAYER_PATH>] [--memo <MEMO>] [--priority-fee-lamports <LAMPORTS>] [--approve]
```

### Parameters

- `--rpc-url <RPC_URL>`: (Optional) The URL of the Solana RPC endpoint. Defaults to mainnet if not specified.
- `--program-id <PROGRAM_ID>`: (Optional) The ID of the multisig program. Defaults to a standard ID if not specified.
- `--token-program-id <TOKEN_PROGRAM_ID>`: (Optional) Token program ID. Defaults to standard SPL token program.
- `--keypair <KEYPAIR_PATH>`: Path to your keypair file.
- `--fee-payer-keypair <FEE_PAYER_PATH>`: (Optional) Path to a separate fee payer keypair.
- `--multisig-pubkey <MULTISIG_PUBLIC_KEY>`: The public key of the multisig account.
- `--vault-index <VAULT_INDEX>`: The index of the vault to transfer from.
- `--token-mint-address <MINT>`: The mint address of the token to transfer.
- `--token-amount-u64 <AMOUNT>`: The transfer amount in raw token units (u64).
- `--recipient <RECIPIENT>`: Recipient wallet or token account address.
- `--memo <MEMO>`: (Optional) A memo for the transaction.
- `--priority-fee-lamports <LAMPORTS>`: (Optional) Priority fee in lamports. Defaults to 200000.
- `--approve`: (Optional) Approve the proposal atomically in the same transaction. Requires Vote permission.

### Example Usage

```bash
initiate-transfer --keypair /path/to/keypair.json --multisig-pubkey <MULTISIG_PUBLIC_KEY> --vault-index 0 --token-mint-address <MINT_ADDRESS> --token-amount-u64 1000000 --recipient <RECIPIENT_ADDRESS>
```

With auto-approve:

```bash
initiate-transfer --keypair /path/to/keypair.json --multisig-pubkey <MULTISIG_PUBLIC_KEY> --vault-index 0 --token-mint-address <MINT_ADDRESS> --token-amount-u64 1000000 --recipient <RECIPIENT_ADDRESS> --approve
```

## Initiate Batch Transfer

### Description

Creates and activates a vault transaction containing multiple SOL and SPL token 
transfers from the multisig vault in a single proposal. Each transfer leg is 
specified with `--transfer`. Optionally approves the proposal atomically.

### Syntax

```bash
initiate-batch-transfer --keypair <KEYPAIR_PATH> --multisig-pubkey <MULTISIG_PUBLIC_KEY> --vault-index <VAULT_INDEX> --transfer <LEG> [--transfer <LEG> ...] [--rpc-url <RPC_URL>] [--program-id <PROGRAM_ID>] [--fee-payer-keypair <FEE_PAYER_PATH>] [--memo <MEMO>] [--priority-fee-lamports <LAMPORTS>] [--approve]
```

### Parameters

- `--rpc-url <RPC_URL>`: (Optional) The URL of the Solana RPC endpoint. Defaults to mainnet if not specified.
- `--program-id <PROGRAM_ID>`: (Optional) The ID of the multisig program. Defaults to a standard ID if not specified.
- `--keypair <KEYPAIR_PATH>`: Path to your keypair file.
- `--fee-payer-keypair <FEE_PAYER_PATH>`: (Optional) Path to a separate fee payer keypair.
- `--multisig-pubkey <MULTISIG_PUBLIC_KEY>`: The public key of the multisig account.
- `--vault-index <VAULT_INDEX>`: The index of the vault to transfer from.
- `--transfer <LEG>`: A transfer leg. Repeatable. Format: `sol:<recipient>:<lamports>` for SOL, or `<mint>:<recipient>:<amount>` for SPL tokens (raw amount).
- `--memo <MEMO>`: (Optional) A memo for the transaction.
- `--priority-fee-lamports <LAMPORTS>`: (Optional) Priority fee in lamports. Defaults to 200000.
- `--approve`: (Optional) Approve the proposal atomically in the same transaction. Requires Vote permission.

### Example Usage

SOL transfer only:

```bash
initiate-batch-transfer --keypair /path/to/keypair.json --multisig-pubkey <MULTISIG_PUBLIC_KEY> --vault-index 0 --transfer "sol:<RECIPIENT_ADDRESS>:1000000000"
```

Mixed SOL and SPL in one proposal:

```bash
initiate-batch-transfer --keypair /path/to/keypair.json --multisig-pubkey <MULTISIG_PUBLIC_KEY> --vault-index 0 --transfer "sol:<RECIPIENT_1>:500000000" --transfer "<MINT_ADDRESS>:<RECIPIENT_2>:1000000"
```

## Initiate Program Upgrade

### Description

Creates and activates a vault transaction that upgrades a BPF upgradeable 
program from a buffer. Optionally approves the proposal atomically in the 
same transaction.

### Syntax

```bash
initiate-program-upgrade --keypair <KEYPAIR_PATH> --multisig-pubkey <MULTISIG_PUBLIC_KEY> --vault-index <VAULT_INDEX> --program-to-upgrade-id <PROGRAM_ID> --buffer-address <BUFFER_ADDRESS> --spill-address <SPILL_ADDRESS> [--rpc-url <RPC_URL>] [--squads-program-id <SQUADS_PROGRAM_ID>] [--fee-payer-keypair <FEE_PAYER_PATH>] [--memo <MEMO>] [--priority-fee-lamports <LAMPORTS>] [--approve]
```

### Parameters

- `--rpc-url <RPC_URL>`: (Optional) The URL of the Solana RPC endpoint. Defaults to mainnet if not specified.
- `--squads-program-id <SQUADS_PROGRAM_ID>`: (Optional) The ID of the Squads multisig program. Defaults to a standard ID if not specified.
- `--keypair <KEYPAIR_PATH>`: Path to your keypair file.
- `--fee-payer-keypair <FEE_PAYER_PATH>`: (Optional) Path to a separate fee payer keypair.
- `--multisig-pubkey <MULTISIG_PUBLIC_KEY>`: The public key of the multisig account.
- `--vault-index <VAULT_INDEX>`: The vault index to use as the upgrade authority.
- `--program-to-upgrade-id <PROGRAM_ID>`: The address of the program to upgrade.
- `--buffer-address <BUFFER_ADDRESS>`: The address of the buffer account containing the new program binary.
- `--spill-address <SPILL_ADDRESS>`: The address that will receive the lamports from the closed buffer account.
- `--memo <MEMO>`: (Optional) A memo for the transaction.
- `--priority-fee-lamports <LAMPORTS>`: (Optional) Priority fee in lamports. Defaults to 200000.
- `--approve`: (Optional) Approve the proposal atomically in the same transaction. Requires Vote permission.

### Example Usage

```bash
initiate-program-upgrade --keypair /path/to/keypair.json --multisig-pubkey <MULTISIG_PUBLIC_KEY> --vault-index 0 --program-to-upgrade-id <PROGRAM_ADDRESS> --buffer-address <BUFFER_ADDRESS> --spill-address <SPILL_ADDRESS>
```

## Program Config Init

### Description

Initializes the global program config account. This is a one-time setup 
operation, only callable by the program authority. Sets the config authority, 
treasury address, and multisig creation fee.

### Syntax

```bash
program-config-init --initializer-keypair <KEYPAIR_PATH> --program-config-authority <AUTHORITY> --treasury <TREASURY> --multisig-creation-fee <FEE> [--rpc-url <RPC_URL>] [--program-id <PROGRAM_ID>] [--fee-payer-keypair <FEE_PAYER_PATH>] [--priority-fee-lamports <LAMPORTS>]
```

### Parameters

- `--rpc-url <RPC_URL>`: (Optional) The URL of the Solana RPC endpoint. Defaults to mainnet if not specified.
- `--program-id <PROGRAM_ID>`: (Optional) The ID of the multisig program. Defaults to a standard ID if not specified.
- `--initializer-keypair <KEYPAIR_PATH>`: Path to the initializer keypair (must be the program authority).
- `--fee-payer-keypair <FEE_PAYER_PATH>`: (Optional) Path to a separate fee payer keypair.
- `--program-config-authority <AUTHORITY>`: Address of the authority that will control the program config.
- `--treasury <TREASURY>`: Address of the treasury that will receive multisig creation fees.
- `--multisig-creation-fee <FEE>`: Multisig creation fee in lamports.
- `--priority-fee-lamports <LAMPORTS>`: (Optional) Priority fee in lamports. Defaults to 5000.

### Example Usage

```bash
program-config-init --initializer-keypair /path/to/keypair.json --program-config-authority <AUTHORITY_ADDRESS> --treasury <TREASURY_ADDRESS> --multisig-creation-fee 1000000
```
