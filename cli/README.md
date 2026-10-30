# Squads Multisig 4r CLI

The following is an overview of commands available to interact with the Squads Multisig 4r program
(`SMS4Rd3C3P1V2PdGRSdZCVQ5fPJk7NsV7vAVoUgSvT5`) via CLI. Commands that take `--program-id` default to this
program. For the frozen Squads v4 program (`SQDS4…`), use `squads-multisig-cli` 0.1.x.

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

# 1. Installation

You can install the CLI with Cargo.
For this an installation of Rust will be needed. You can find installation steps [here](https://www.rust-lang.org/tools/install).

Now, install the Squads CLI.

```bash
cargo install squads-multisig-4r-cli --locked
```

Ledger support is a default feature. To build without it (and without `libudev`), use
`cargo install squads-multisig-4r-cli --locked --no-default-features`.

# 2. Supported wallets

The `--keypair` argument accepts these signer sources:

| Source | Example |
|---|---|
| Keypair file | `/path/to/keypair.json` or `file:///path/to/keypair.json` |
| Ledger hardware wallet | `usb://ledger`, `usb://ledger?key=0/0` |
| Seed phrase prompt | `prompt://` |
| JSON keypair on stdin | `stdin` or `-` |
| Base58-encoded keypair | `<base58 string>` |

The seed phrase prompt checks the phrase against the BIP39 word lists (English, Chinese,
Japanese, Spanish, Korean, French, Italian), like the Solana CLI.

### File system wallets

You can easily use your local filesystem wallet by using it as the "keypair" argument in commands.

```bash
squads-multisig-4r-cli example-command --keypair /path/to/keypair.json
```

This specifies the path of the Keypair that you want to use to sign a CLI transaction.

### Ledger support

To use a Ledger with the Squads CLI, just specify the Ledger device URL in the "keypair" argument.

```bash
squads-multisig-4r-cli example-command --keypair usb://ledger
```

This will use the default derivation path of your Ledger.

```bash
squads-multisig-4r-cli example-command --keypair usb://ledger/BsNsvfXqQTtJnagwFWdBS7FBXgnsK8VZ5CmuznN85swK?key=0/0
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
- `--program-id <PROGRAM_ID>`: (Optional) The ID of the multisig program. Defaults to the Squads Multisig 4r program ID.
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

   Adds a spending limit to the multisig account. `<PERIOD>` is the reset period and must be one of `OneTime`, `Day`, `Week`, or `Month` (case-sensitive).

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
- `--program-id <PROGRAM_ID>`: (Optional) The ID of the multisig program. Defaults to the Squads Multisig 4r program ID.
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
- `--program-id <PROGRAM_ID>`: (Optional) The ID of the multisig program. Defaults to the Squads Multisig 4r program ID.
- `--keypair <KEYPAIR_PATH>`: Path to your keypair file.
- `--config-authority <CONFIG_AUTHORITY>`: (Optional) Address granted **unilateral** control over the multisig configuration (add/remove members, change threshold, etc.). This makes the multisig "controlled" rather than autonomous — only set it if you intend a single key to govern config changes. This is **not** the rent collector; use `--rent-collector` for that.
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
   multisig-create --keypair /path/to/keypair.json --rent-collector <RENT_COLLECTOR_PUBKEY> --members "Member1PubKey,Permission1" "Member2PubKey,Permission2" --threshold 1
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
- `--program-id <PROGRAM_ID>`: (Optional) The ID of the multisig program. Defaults to the Squads Multisig 4r program ID.
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
- `--program-id <PROGRAM_ID>`: (Optional) The ID of the multisig program. Defaults to the Squads Multisig 4r program ID.
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
- `--program-id <PROGRAM_ID>`: (Optional) The ID of the multisig program. Defaults to the Squads Multisig 4r program ID.
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
- `--program-id <PROGRAM_ID>`: (Optional) The ID of the multisig program. Defaults to the Squads Multisig 4r program ID.
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
squads-multisig-4r-cli display-transaction --transaction-address 279SBhVyHLEBsphBkDBNMUbSoA31yRBDtnU5mzSM3d5n
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
squads-multisig-4r-cli display-config-transaction --transaction-address AQb6VyZGzC2kL7vFU7WqoTJYTNZdHKhKuHmzuxkqGGjV
```

## Migrate Plan

### Description

Shows what a v4 vault or a v3 authority holds and how it moves to its 4r successor: the successor address and state, the member signing report, the inventory, the items and the warnings. Each item moves one asset class (tokens, token authorities, stakes, vote accounts, programs or SOL). It sends nothing.

The owner program of `--multisig-pubkey` sets the lineage: `SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf` is v4, `SMPLecH534NA9acpos4G6x7uf3LWbCAwZQE9e8ZekMu` is v3. For a v4 multisig, each item is one batch entry. For a v3 multisig, each item is one instruction of a v3 transaction.

The member signing report lists the members that are off the curve (only a program signs for them) and marks the known vaults. The risk is `HIGH` when the wallet members that vote cannot reach the threshold alone. It is a warning and does not stop the plan.

A v3 member can be a delegate of the v3 roles program. A delegate can never sign in 4r, so the plan stops with an error that lists each delegate and its wallet. Replace each delegate with its wallet first, in a v3 transaction of authority 0: `add_member(wallet)`, `remove_member(delegate)`, then check the threshold.

### Syntax

```bash
migrate-plan --multisig-pubkey <MULTISIG> [--vault-index <INDEX> | --authority-index <INDEX>] [--rpc-url <RPC_URL>] [--program-id <PROGRAM_ID>] [--keep-token-accounts] [--preserve-token-account-addresses] [--extra-mint <MINT>]... [--skip-program-scans]
```

### Parameters

- `--multisig-pubkey <MULTISIG>`: The v4 or v3 multisig to move.
- `--vault-index <INDEX>`: (Optional, v4 only) The v4 vault to move. Default 0. The assets go to the successor vault with the same index.
- `--authority-index <INDEX>`: (Optional, v3 only) The v3 authority to move, from 1 to 256. Default 1. The assets go to the successor vault `INDEX - 1`.
- `--rpc-url <RPC_URL>`: (Optional) The URL of the Solana RPC endpoint. Defaults to mainnet.
- `--program-id <PROGRAM_ID>`: (Optional) The 4r program ID. Defaults to the Squads Multisig 4r program ID.
- `--keep-token-accounts`: (Optional) Keep the source token accounts open. By default they close, and the rent goes to the successor vault.
- `--preserve-token-account-addresses`: (Optional) Move token accounts that are not associated token accounts by owner change, so they keep their address.
- `--extra-mint <MINT>`: (Optional, repeatable) A mint where the vault holds only Token-2022 extension or metadata authorities. The scan cannot find such a mint.
- `--skip-program-scans`: (Optional) Do not scan for token roles (close authority, delegate), stakes, vote accounts, upgradeable programs and mints. Use it with an RPC that refuses `getProgramAccounts`.

The command refuses `--vault-index` for a v3 multisig and `--authority-index` for a v4 multisig.

## Migrate Propose

### Description

Creates the proposals of a migration as a member, and prints the transaction indexes to approve and execute.

- v4: a vault transaction that creates the successor (if it does not exist), and one batch that moves the assets.
- v3: one v3 transaction of the authority. Its first instruction creates the successor (if it does not exist), and each next instruction moves one item. The command sends `create_transaction`, one `add_instruction` for each instruction, then `activate_transaction` (and `approve_transaction` with `--approve`). One approval round covers the whole migration.

### Syntax

```bash
migrate-propose --multisig-pubkey <MULTISIG> --keypair <KEYPAIR_PATH> [--approve] [--lookup-tables] [--fee-payer-keypair <PATH>] [--yes] [same options as migrate-plan]
```

### Parameters

- `--keypair <KEYPAIR_PATH>`: A member. On v4, it needs Initiate permission. On v3, it pays the rent of the v3 transaction and instruction accounts.
- `--approve`: (Optional) Also approve the proposals. On v4, the member needs Vote permission.
- `--lookup-tables`: (Optional, v4 only) Put the item accounts in new address lookup tables first: fewer, larger batch entries. The member is the table authority. The command prints the table addresses; get their rent back with `migrate-lookup-tables` after the batch runs.
- `--fee-payer-keypair <PATH>`: (Optional) Pays the fees. On v4, it also pays the rent of the proposal accounts (and of the lookup tables).
- `--yes`: (Optional) Do not ask for confirmation.

## Migrate Execute

### Description

Executes an approved migration proposal, one transaction for each step, in order. It stops at the first step that fails.

- v4: the vault transaction that creates the successor, or the remaining entries of the batch. It reads the lookup tables that the batch messages use.
- v3: the remaining instructions of the v3 transaction (`execute_instruction`). It starts after the last instruction that ran, so you can run it again after a failure.

### Syntax

```bash
migrate-execute --multisig-pubkey <MULTISIG> --keypair <KEYPAIR_PATH> --transaction-index <INDEX> [--rpc-url <RPC_URL>] [--yes]
```

### Example Usage

```bash
# v4
squads-multisig-4r-cli migrate-plan --multisig-pubkey <V4_MULTISIG>
squads-multisig-4r-cli migrate-propose --multisig-pubkey <V4_MULTISIG> --keypair /path/to/keypair.json --approve
squads-multisig-4r-cli migrate-execute --multisig-pubkey <V4_MULTISIG> --keypair /path/to/keypair.json --transaction-index 1
squads-multisig-4r-cli migrate-execute --multisig-pubkey <V4_MULTISIG> --keypair /path/to/keypair.json --transaction-index 2

# v3, authority 1 (the v3 default vault)
squads-multisig-4r-cli migrate-plan --multisig-pubkey <V3_MULTISIG>
squads-multisig-4r-cli migrate-propose --multisig-pubkey <V3_MULTISIG> --keypair /path/to/keypair.json --approve
squads-multisig-4r-cli migrate-execute --multisig-pubkey <V3_MULTISIG> --keypair /path/to/keypair.json --transaction-index <V3_INDEX>
```

## Migrate Lookup Tables

### Description

Deactivates the lookup tables of a migration, or closes them about 513 slots after deactivation to get their rent back.

### Syntax

```bash
migrate-lookup-tables --tables <TABLE,...> --keypair <KEYPAIR_PATH> (--deactivate | --close) [--recipient <ADDRESS>] [--fee-payer-keypair <PATH>] [--rpc-url <RPC_URL>]
```

### Parameters

- `--tables <TABLE,...>`: The lookup tables (comma-separated), as `migrate-propose` printed them.
- `--keypair <KEYPAIR_PATH>`: The table authority (the member that proposed).
- `--deactivate`: Deactivate the tables. New transactions cannot use them.
- `--close`: Close deactivated tables. The rent goes to the recipient.
- `--recipient <ADDRESS>`: (Optional) The recipient of the rent. Default: the authority.
