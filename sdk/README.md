# @sqds/multisig

This is the package for the Squads v4 Typescript SDK.

<a href="https://docs.squads.so/main/v/development">Docs</a>
•
<a href="https://www.npmjs.com/package/@sqds/multisig">NPM</a>

## Installation

Add the SDK to your project with npm:
```
npm i @sqds/multisig
```

or yarn:
```
yarn add @sqds/multisig
```

## Get Started

First, get the multisig account address:
```typescript
import * as multisig from "@sqds/multisig";

const {
    Multisig
} = multisig.accounts;

const [multisigPda] = multisig.getMultisigPda({
    createKey,
});

/// or define it directly
const multisigPda = new PublicKey("<multisig key>");
```

Then get the multisig account info:
```typescript
const multisigAccount = await Multisig.fromAccountAddress(
    connection,
    multisigPda
);
// Log out the multisig's members
console.log("Members", multisigAccount.members);
```

Once you fetch your multisig, fetch the vault account:
```typescript
const [vaultPda] = multisig.getVaultPda({
    multisigPda,
    index: 0,
});
```

From here, you can create your first vault transaction:
```typescript
const transactionIndex = 1n;

const transferInstruction = SystemProgram.transfer(
    // The transfer is being signed from the Squads Vault, that is why we use the VaultPda
    vaultPda,
    to.publicKey,
    1 * LAMPORTS_PER_SOL
);

// Here we are adding all the instructions that we want to be executed in our transaction
const testTransferMessage = new TransactionMessage({
    payerKey: vaultPda,
    recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
    instructions: [transferInstruction],
});

await multisig.rpc.vaultTransactionCreate({
    connection,
    feePayer,
    multisigPda,
    transactionIndex,
    creator: feePayer.publicKey,
    vaultIndex: 0,
    ephemeralSigners: 0,
    transactionMessage: testTransferMessage,
});
```

Check our <a href="https://docs.squads.so/main/v/development">documentation</a> for more information on instruction types and ancillary features.