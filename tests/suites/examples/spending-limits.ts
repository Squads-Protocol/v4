import * as multisig from "@sqds/multisig";
import {
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createMint,
  getAssociatedTokenAddressSync,
  mintTo,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  createAssociatedTokenAccount,
} from "@solana/spl-token";
import assert from "assert";
import {
  comparePubkeys,
  createAutonomousMultisig,
  createLocalhostConnection,
  generateFundedKeypair,
  generateMultisigMembers,
  getTestProgramId,
  isCloseToNow,
  TestMembers,
} from "../../utils";

const { SpendingLimit } = multisig.accounts;
const { Period } = multisig.types;

const programId = getTestProgramId();

describe("Examples / Spending Limits", () => {
  const connection = createLocalhostConnection();

  let multisigPda: PublicKey;
  let members: TestMembers;
  let nonMember: Keypair;
  let solSpendingLimitParams: multisig.types.ConfigActionRecord["AddSpendingLimit"];
  let splSpendingLimitParams: multisig.types.ConfigActionRecord["AddSpendingLimit"];
  let splMint: PublicKey;
  before(async () => {
    members = await generateMultisigMembers(connection);

    multisigPda = (
      await createAutonomousMultisig({
        connection,
        members,
        threshold: 1,
        timeLock: 0,
        programId,
      })
    )[0];

    nonMember = await generateFundedKeypair(connection);

    // Set params for creating a Spending Limit for SOL tokens.
    solSpendingLimitParams = {
      createKey: Keypair.generate().publicKey,
      vaultIndex: 0,
      // This means this Spending Limit is for SOL tokens.
      mint: PublicKey.default,
      amount: 10 * LAMPORTS_PER_SOL,
      period: Period.OneTime,
      members: [members.almighty.publicKey, nonMember.publicKey],
      destinations: [
        Keypair.generate().publicKey,
        Keypair.generate().publicKey,
      ],
    };

    // Airdrop SOL to the vault.
    const [vaultPda] = multisig.getVaultPda({
      multisigPda,
      index: solSpendingLimitParams.vaultIndex,
      programId,
    });
    let signature = await connection.requestAirdrop(
      vaultPda,
      100 * LAMPORTS_PER_SOL
    );
    await connection.confirmTransaction(signature);

    // Set params for creating a Spending Limit for SPL tokens.
    const mintAuthority = await generateFundedKeypair(connection);
    const mintDecimals = 6;
    splMint = await createMint(
      connection,
      mintAuthority,
      mintAuthority.publicKey,
      null,
      mintDecimals,
      undefined,
      undefined,
      TOKEN_PROGRAM_ID
    );

    splSpendingLimitParams = {
      createKey: Keypair.generate().publicKey,
      vaultIndex: 0,
      mint: splMint,
      amount: 10 * 10 ** mintDecimals,
      period: Period.OneTime,
      members: [members.almighty.publicKey, nonMember.publicKey],
      destinations: [
        Keypair.generate().publicKey,
        Keypair.generate().publicKey,
      ],
    };

    // Initialize vault token account and mint tokens to it.
    const vaultTokenAccount = getAssociatedTokenAddressSync(
      splMint,
      vaultPda,
      true,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
    const message = new TransactionMessage({
      payerKey: mintAuthority.publicKey,
      recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
      instructions: [
        createAssociatedTokenAccountInstruction(
          mintAuthority.publicKey,
          vaultTokenAccount,
          vaultPda,
          splMint,
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID
        ),
      ],
    }).compileToV0Message();
    const tx = new VersionedTransaction(message);
    tx.sign([mintAuthority]);
    signature = await connection.sendTransaction(tx);
    await connection.confirmTransaction(signature);

    await mintTo(
      connection,
      mintAuthority,
      splMint,
      vaultTokenAccount,
      mintAuthority.publicKey,
      100 * 10 ** mintDecimals,
      undefined,
      undefined,
      TOKEN_PROGRAM_ID
    );
  });

  it("create SOL and SPL Spending Limits for autonomous multisig", async () => {
    const transactionIndex = 1n;

    // Create the Config Transaction, Proposal for it, and approve the Proposal.
    const message = new TransactionMessage({
      payerKey: members.almighty.publicKey,
      recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
      instructions: [
        multisig.instructions.configTransactionCreate({
          multisigPda,
          transactionIndex,
          creator: members.almighty.publicKey,
          actions: [
            {
              __kind: "AddSpendingLimit",
              ...solSpendingLimitParams,
            },
            {
              __kind: "AddSpendingLimit",
              ...splSpendingLimitParams,
            },
          ],
          programId,
        }),
        multisig.instructions.proposalCreate({
          multisigPda,
          transactionIndex,
          creator: members.almighty.publicKey,
          programId,
        }),
        multisig.instructions.proposalApprove({
          multisigPda,
          transactionIndex,
          member: members.almighty.publicKey,
          programId,
        }),
      ],
    }).compileToV0Message();

    const tx = new VersionedTransaction(message);
    tx.sign([members.almighty]);

    let signature = await connection
      .sendTransaction(tx, {
        skipPreflight: true,
      })
      .catch((err) => {
        console.log(err.logs);
        throw err;
      });
    await connection.confirmTransaction(signature);

    const [solSpendingLimitPda, solSpendingLimitBump] =
      multisig.getSpendingLimitPda({
        multisigPda,
        createKey: solSpendingLimitParams.createKey,
        programId,
      });

    const [splSpendingLimitPda, splSpendingLimitBump] =
      multisig.getSpendingLimitPda({
        multisigPda,
        createKey: splSpendingLimitParams.createKey,
        programId,
      });

    // Execute the Config Transaction which will create the Spending Limit.
    signature = await multisig.rpc
      .configTransactionExecute({
        connection,
        feePayer: members.executor,
        multisigPda,
        transactionIndex,
        member: members.executor,
        rentPayer: members.executor,
        spendingLimits: [solSpendingLimitPda, splSpendingLimitPda],
        programId,
      })
      .catch((err) => {
        console.log(err.logs);
        throw err;
      });
    await connection.confirmTransaction(signature);

    // Fetch the Spending Limit account and verify its fields.
    const solSpendingLimitAccount = await SpendingLimit.fromAccountAddress(
      connection,
      solSpendingLimitPda
    );

    assert.strictEqual(
      solSpendingLimitAccount.multisig.toBase58(),
      multisigPda.toBase58()
    );
    assert.strictEqual(
      solSpendingLimitAccount.createKey.toBase58(),
      solSpendingLimitParams.createKey.toBase58()
    );
    assert.strictEqual(
      solSpendingLimitAccount.vaultIndex,
      solSpendingLimitParams.vaultIndex
    );
    assert.strictEqual(
      solSpendingLimitAccount.mint.toBase58(),
      solSpendingLimitParams.mint.toBase58()
    );
    assert.strictEqual(
      solSpendingLimitAccount.amount.toString(),
      solSpendingLimitParams.amount.toString()
    );
    assert.strictEqual(
      solSpendingLimitAccount.period,
      solSpendingLimitParams.period
    );
    assert.strictEqual(
      solSpendingLimitAccount.remainingAmount.toString(),
      solSpendingLimitParams.amount.toString()
    );
    assert.ok(
      isCloseToNow(
        multisig.utils.toBigInt(solSpendingLimitAccount.lastReset),
        5000
      )
    );
    assert.strictEqual(solSpendingLimitAccount.bump, solSpendingLimitBump);
    assert.deepEqual(
      solSpendingLimitAccount.members
        .sort(comparePubkeys)
        .map((k) => k.toBase58()),
      solSpendingLimitParams.members
        .sort(comparePubkeys)
        .map((k) => k.toBase58())
    );
    assert.deepEqual(
      solSpendingLimitAccount.destinations.map((k) => k.toBase58()),
      solSpendingLimitParams.destinations.map((k) => k.toBase58())
    );

    // TODO: Same checks should be done for SPL Spending Limit.
  });

  it("use SOL Spending Limit", async () => {
    const [solSpendingLimitPda] = multisig.getSpendingLimitPda({
      multisigPda,
      createKey: solSpendingLimitParams.createKey,
      programId,
    });

    // Member of the multisig that can use the Spending Limit.
    let signature = await multisig.rpc
      .spendingLimitUse({
        connection,
        feePayer: members.almighty,
        // A member that can use the Spending Limit.
        member: members.almighty,
        multisigPda,
        spendingLimit: solSpendingLimitPda,
        // We don't need to specify the mint, because this Spending Limit is for SOL.
        mint: undefined,
        vaultIndex: solSpendingLimitParams.vaultIndex,
        // Use the entire amount.
        amount: (solSpendingLimitParams.amount as number) / 2,
        // SOL has 9 decimals.
        decimals: 9,
        // Transfer tokens to one of the allowed destinations.
        destination: solSpendingLimitParams.destinations[0],
        // You can optionally add a memo.
        memo: "Using my allowance!",
        programId,
      })
      .catch((err) => {
        console.log(err.logs);
        throw err;
      });
    await connection.confirmTransaction(signature);

    // Fetch the Spending Limit account.
    let solSpendingLimitAccount = await SpendingLimit.fromAccountAddress(
      connection,
      solSpendingLimitPda
    );

    // We used the half of the amount.
    assert.strictEqual(
      solSpendingLimitAccount.remainingAmount.toString(),
      String((solSpendingLimitParams.amount as number) / 2)
    );

    // Non-member of the multisig that can use the Spending Limit.
    signature = await multisig.rpc
      .spendingLimitUse({
        connection,
        feePayer: members.almighty,
        // A member that can use the Spending Limit.
        member: nonMember,
        multisigPda,
        spendingLimit: solSpendingLimitPda,
        // We don't need to specify the mint, because this Spending Limit is for SOL.
        mint: undefined,
        vaultIndex: solSpendingLimitParams.vaultIndex,
        // Use the entire amount.
        amount: (solSpendingLimitParams.amount as number) / 2,
        // SOL has 9 decimals.
        decimals: 9,
        // Transfer tokens to one of the allowed destinations.
        destination: solSpendingLimitParams.destinations[0],
        // You can optionally add a memo.
        memo: "Using my allowance!",
        programId,
      })
      .catch((err) => {
        console.log(err.logs);
        throw err;
      });
    await connection.confirmTransaction(signature);

    solSpendingLimitAccount = await SpendingLimit.fromAccountAddress(
      connection,
      solSpendingLimitPda
    );

    // We used the entire amount, so the remaining amount should be 0.
    assert.strictEqual(solSpendingLimitAccount.remainingAmount.toString(), "0");

    // Try exceeding the Spending Limit.
    await assert.rejects(
      () =>
        multisig.rpc.spendingLimitUse({
          connection,
          feePayer: members.almighty,
          member: members.almighty,
          multisigPda,
          spendingLimit: solSpendingLimitPda,
          mint: undefined,
          vaultIndex: solSpendingLimitParams.vaultIndex,
          amount: 1,
          decimals: 9,
          destination: solSpendingLimitParams.destinations[0],
          programId,
        }),
      /Spending limit exceeded/
    );
  });

  it("use SPL Spending Limit", async () => {
    // First of all, make sure the destination token account is initialized.
    const destination = splSpendingLimitParams.destinations[0];
    await createAssociatedTokenAccount(
      connection,
      members.almighty,
      splMint,
      destination,
      undefined,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    const [splSpendingLimitPda] = multisig.getSpendingLimitPda({
      multisigPda,
      createKey: splSpendingLimitParams.createKey,
      programId,
    });

    let signature = await multisig.rpc
      .spendingLimitUse({
        connection,
        feePayer: members.almighty,
        // A member that can use the Spending Limit.
        member: members.almighty,
        multisigPda,
        spendingLimit: splSpendingLimitPda,
        mint: splMint,
        vaultIndex: splSpendingLimitParams.vaultIndex,
        // Use the entire amount.
        amount: splSpendingLimitParams.amount as number,
        // Our SPL mint has 6 decimals.
        decimals: 6,
        // Transfer tokens to one of the allowed destinations.
        destination,
        tokenProgram: TOKEN_PROGRAM_ID,
        // You can optionally add a memo.
        memo: "Using my allowance!",
        programId,
      })
      .catch((err) => {
        console.log(err.logs);
        throw err;
      });
    await connection.confirmTransaction(signature);

    // Fetch the Spending Limit account.
    const splSpendingLimitAccount = await SpendingLimit.fromAccountAddress(
      connection,
      splSpendingLimitPda
    );

    // We used the entire amount, so the remaining amount should be 0.
    assert.strictEqual(splSpendingLimitAccount.remainingAmount.toString(), "0");

    // Try exceeding the Spending Limit.
    await assert.rejects(
      () =>
        multisig.rpc.spendingLimitUse({
          connection,
          feePayer: members.almighty,
          member: members.almighty,
          multisigPda,
          spendingLimit: splSpendingLimitPda,
          mint: splMint,
          vaultIndex: splSpendingLimitParams.vaultIndex,
          amount: 1,
          decimals: 6,
          destination,
          tokenProgram: TOKEN_PROGRAM_ID,
          programId,
        }),
      /Spending limit exceeded/
    );
  });

  it("remove Spending Limits for autonomous multisig", async () => {
    const [solSpendingLimitPda] = multisig.getSpendingLimitPda({
      multisigPda,
      createKey: solSpendingLimitParams.createKey,
      programId,
    });
    const [splSpendingLimitPda] = multisig.getSpendingLimitPda({
      multisigPda,
      createKey: splSpendingLimitParams.createKey,
      programId,
    });

    const transactionIndex = 2n;

    // Create the Config Transaction, Proposal for it, and approve the Proposal.
    const message = new TransactionMessage({
      payerKey: members.almighty.publicKey,
      recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
      instructions: [
        multisig.instructions.configTransactionCreate({
          multisigPda,
          transactionIndex,
          creator: members.almighty.publicKey,
          actions: [
            {
              __kind: "RemoveSpendingLimit",
              spendingLimit: solSpendingLimitPda,
            },
            {
              __kind: "RemoveSpendingLimit",
              spendingLimit: splSpendingLimitPda,
            },
          ],
          programId,
        }),
        multisig.instructions.proposalCreate({
          multisigPda,
          transactionIndex,
          creator: members.almighty.publicKey,
          programId,
        }),
        multisig.instructions.proposalApprove({
          multisigPda,
          transactionIndex,
          member: members.almighty.publicKey,
          programId,
        }),
      ],
    }).compileToV0Message();

    const tx = new VersionedTransaction(message);
    tx.sign([members.almighty]);

    let signature = await connection
      .sendTransaction(tx, {
        skipPreflight: true,
      })
      .catch((err) => {
        console.log(err.logs);
        throw err;
      });
    await connection.confirmTransaction(signature);

    // Execute the Config Transaction which will remove the Spending Limits.
    signature = await multisig.rpc
      .configTransactionExecute({
        connection,
        feePayer: members.executor,
        multisigPda,
        transactionIndex,
        member: members.executor,
        rentPayer: members.executor,
        spendingLimits: [solSpendingLimitPda, splSpendingLimitPda],
        programId,
      })
      .catch((err) => {
        console.log(err.logs);
        throw err;
      });
    await connection.confirmTransaction(signature);

    // The Spending Limits should be gone.
    assert.strictEqual(
      await connection.getAccountInfo(solSpendingLimitPda),
      null
    );
    assert.strictEqual(
      await connection.getAccountInfo(splSpendingLimitPda),
      null
    );
  });
});
