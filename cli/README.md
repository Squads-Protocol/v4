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
   - [Vote account operations](#vote-account-operations)
4. [Validator runbook](#4-validator-runbook)

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

Accounts that are vaults of the transaction's multisig are labelled `(vault N)`. Vote program instructions are also decoded into readable fields (e.g. `Vote: Withdraw`, amount in SOL, recipient), and a red warning is printed when an instruction moves a vote account's withdraw authority, or a commission collector, outside the multisig's vaults, or when a vote program instruction cannot be decoded.

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

## Vote account operations

### Description

Proposes an operation on a vote account whose authorized withdrawer is a vault of the multisig. Each command creates one vault transaction and its proposal (one operation per proposal, like the `solana vote-*` commands). Approve it with `proposal-vote` and run it with `vault-transaction-execute`, as for any vault transaction.

Before proposing, every command:

- checks that the vault at `--vault-index` is the vote account's authorized withdrawer, and stops with an error otherwise;
- simulates the vault instructions as if the vault signed them. If the simulation fails, the error and logs are shown and you are asked whether to propose anyway, because some operations fail now but succeed later (for example a commission increase outside the allowed part of the epoch);
- asks for an extra confirmation when the operation moves the withdraw authority, or a commission collector, to an address that is not a vault of the multisig.

### Syntax

```bash
vote withdraw --vote-account <VOTE_ACCOUNT> --recipient <RECIPIENT> (--amount <SOL> | --all | --close) <COMMON>
vote update-commission --vote-account <VOTE_ACCOUNT> --commission <PERCENT> <COMMON>
vote authorize --vote-account <VOTE_ACCOUNT> --authority-type <voter|withdrawer> --new-authority <PUBKEY> <COMMON>
vote update-identity --vote-account <VOTE_ACCOUNT> --new-identity <PUBKEY> <COMMON>
vote update-commission-collector --vote-account <VOTE_ACCOUNT> --kind <inflation-rewards|block-revenue> --collector <PUBKEY> <COMMON>
```

`<COMMON>` is `--keypair <KEYPAIR_PATH> --multisig-pubkey <MULTISIG_PUBLIC_KEY> --vault-index <VAULT_INDEX> [--rpc-url <RPC_URL>] [--program-id <PROGRAM_ID>] [--fee-payer-keypair <KEYPAIR_PATH>] [--memo <MEMO>] [--priority-fee-lamports <LAMPORTS>] [--approve]`.

### Parameters

- `--vote-account <VOTE_ACCOUNT>`: The vote account. Its authorized withdrawer must be the vault at `--vault-index`.
- `--vault-index <VAULT_INDEX>`: The index of the vault that is the authorized withdrawer.
- `--keypair <KEYPAIR_PATH>`: The proposing member's keypair file, or `usb://ledger`.
- `--approve`: (Optional) Approve the proposal in the same transaction. The proposer needs the Vote permission.
- `withdraw`: `--recipient` receives the SOL. Pass exactly one of `--amount <SOL>` (for example `1.5`; it must leave the account at or above its rent-exempt minimum, or empty), `--all` (everything above the rent-exempt minimum) or `--close` (the full balance, which closes the vote account; the vote program only allows this when the account earned no credits in the current or previous epoch, so a proposal that simulates fine can still fail at execution).
- `update-commission`: `--commission` is a percentage from 0 to 100.
- `authorize`: `--authority-type voter` or `withdrawer`, and the `--new-authority` address. A vote account that holds a BLS public key (SIMD-0387) rejects a plain voter change; the command stops before proposing, and the current voter can rotate itself with `solana vote-authorize-voter-checked`.
- `update-identity`: `--new-identity` is the new validator identity. The vote program requires the new identity to sign, so execute the proposal with `vault-transaction-execute --extra-keypair <NEW_IDENTITY_KEYPAIR>`.
- `update-commission-collector`: `--kind inflation-rewards` or `block-revenue`, and the `--collector` address (SIMD-0232). The collector must be the vote account itself or an existing rent-exempt account owned by the system program.

### Example Usage

```bash
squads-multisig-cli vote withdraw \
  --keypair usb://ledger \
  --multisig-pubkey <MULTISIG_PUBLIC_KEY> \
  --vault-index 0 \
  --vote-account <VOTE_ACCOUNT> \
  --recipient <RECIPIENT> \
  --amount 12.5 \
  --memo "October rewards"
```

# 4. Validator runbook

This runbook covers a validator whose vote account is controlled by a Squads multisig, using only the open source Solana CLI and this CLI. The identity and vote authority keys stay with the validator; the multisig vault is the vote account's authorized withdrawer.

## Set up

1. Find the vault address: `squads-multisig-cli display-vault --multisig-address <MULTISIG> --vault-index 0`.
2. Make the vault the withdrawer:
   - new vote account: `solana create-vote-account <VOTE_KEYPAIR> <IDENTITY_KEYPAIR> <VAULT>`;
   - existing vote account: `solana vote-authorize-withdrawer <VOTE_ACCOUNT> <CURRENT_WITHDRAWER_KEYPAIR> <VAULT>` (not the `-checked` variant, which needs the new withdrawer, here the vault, to sign).
3. Check: `solana vote-account <VOTE_ACCOUNT>` shows the vault as `Withdraw Authority`.

## Day-to-day operations

Every operation follows the same three steps.

1. A member proposes it, for example `squads-multisig-cli vote withdraw ... --vault-index 0`. The command prints the transaction index and the transaction address, to share with the approvers.
2. Each approver inspects and approves it:
   ```bash
   squads-multisig-cli display-transaction --transaction-address <TRANSACTION_ADDRESS>
   squads-multisig-cli proposal-vote --keypair usb://ledger --multisig-pubkey <MULTISIG> --transaction-index <INDEX> --action Approve
   ```
   `display-proposals --multisig-pubkey <MULTISIG>` lists the pending proposals by transaction index. A hardware wallet only shows the outer Squads instruction, so `display-transaction` is where approvers check the vote instruction itself.
3. Once the threshold is reached, anyone executes it:
   ```bash
   squads-multisig-cli vault-transaction-execute --keypair <KEYPAIR> --multisig-pubkey <MULTISIG> --transaction-index <INDEX>
   ```

| Task | Command |
| --- | --- |
| Withdraw rewards | `vote withdraw --amount <SOL>` or `--all` |
| Change commission | `vote update-commission --commission <PERCENT>` |
| Change where block revenue / inflation rewards commission is paid | `vote update-commission-collector --kind <block-revenue\|inflation-rewards> --collector <ADDRESS>` |
| Change the validator identity | `vote update-identity --new-identity <PUBKEY>`, then execute with `--extra-keypair <NEW_IDENTITY_KEYPAIR>` |
| Move the withdraw authority to another vault | `vote authorize --authority-type withdrawer --new-authority <OTHER_VAULT>` |
| Close the vote account | `vote withdraw --close` (only once the account has stopped earning credits) |
