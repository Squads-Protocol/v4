import * as multisig from "@sqds/multisig";
import {
  Keypair,
  LAMPORTS_PER_SOL,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import { NATIVE_MINT } from "@solana/spl-token";
import assert from "assert";
import {
  createAutonomousMultisig,
  createLocalhostConnection,
  generateMultisigMembers,
  isCloseToNow,
  TestMembers,
} from "../../utils";

const { SpendingLimit } = multisig.accounts;
const { Period } = multisig.types;

describe("Examples / Spending Limits", () => {
  const connection = createLocalhostConnection();

  let members: TestMembers;
  before(async () => {
    members = await generateMultisigMembers(connection);
  });

  it("create Spending Limit for autonomous multisig", async () => {
    const [multisigPda] = await createAutonomousMultisig({
      connection,
      members,
      threshold: 1,
      timeLock: 0,
    });

    const transactionIndex = 1n;

    const spendingLimitParams = {
      createKey: Keypair.generate().publicKey,
      vaultIndex: 0,
      mint: NATIVE_MINT,
      amount: 10 * LAMPORTS_PER_SOL,
      period: Period.OneTime,
      members: [members.almighty.publicKey],
      // Empty `destinations` means all destinations are allowed.
      destinations: [
        Keypair.generate().publicKey,
        Keypair.generate().publicKey,
      ],
    };

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
              ...spendingLimitParams,
            },
          ],
        }),
        multisig.instructions.proposalCreate({
          multisigPda,
          transactionIndex,
          rentPayer: members.almighty.publicKey,
        }),
        multisig.instructions.proposalApprove({
          multisigPda,
          transactionIndex,
          member: members.almighty.publicKey,
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

    const [spendingLimitPda, spendingLimitBump] = multisig.getSpendingLimitPda({
      multisigPda,
      createKey: spendingLimitParams.createKey,
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
        spendingLimits: [spendingLimitPda],
      })
      .catch((err) => {
        console.log(err.logs);
        throw err;
      });
    await connection.confirmTransaction(signature);

    // Fetch the Spending Limit account and verify its fields.
    const spendingLimitAccount = await SpendingLimit.fromAccountAddress(
      connection,
      spendingLimitPda
    );

    assert.strictEqual(
      spendingLimitAccount.multisig.toBase58(),
      multisigPda.toBase58()
    );
    assert.strictEqual(
      spendingLimitAccount.createKey.toBase58(),
      spendingLimitParams.createKey.toBase58()
    );
    assert.strictEqual(
      spendingLimitAccount.vaultIndex,
      spendingLimitParams.vaultIndex
    );
    assert.strictEqual(
      spendingLimitAccount.mint.toBase58(),
      spendingLimitParams.mint.toBase58()
    );
    assert.strictEqual(
      spendingLimitAccount.amount.toString(),
      spendingLimitParams.amount.toString()
    );
    assert.strictEqual(spendingLimitAccount.period, spendingLimitParams.period);
    assert.strictEqual(
      spendingLimitAccount.remainingAmount.toString(),
      spendingLimitParams.amount.toString()
    );
    assert.ok(
      isCloseToNow(multisig.utils.toBigInt(spendingLimitAccount.lastReset))
    );
    assert.strictEqual(spendingLimitAccount.bump, spendingLimitBump);
    assert.deepEqual(
      spendingLimitAccount.members.map((k) => k.toBase58()),
      spendingLimitParams.members.map((k) => k.toBase58())
    );
    assert.deepEqual(
      spendingLimitAccount.destinations.map((k) => k.toBase58()),
      spendingLimitParams.destinations.map((k) => k.toBase58())
    );
  });
});
