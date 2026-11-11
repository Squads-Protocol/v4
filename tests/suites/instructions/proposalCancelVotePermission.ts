import {
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  TransactionMessage,
} from "@solana/web3.js";
import * as multisig from "@sqds/multisig";
import assert from "assert";
import {
  createLocalhostConnection,
  createTestTransferInstruction,
  generateFundedKeypair,
  getTestProgramId,
} from "../../utils";

const { Multisig, Proposal } = multisig.accounts;
const { Permission, Permissions } = multisig.types;

const programId = getTestProgramId();
const connection = createLocalhostConnection();

// Finding F2 in tla/README.md: these tests record the current behavior.
// Change them when F2 is fixed.
describe("Instructions / proposal_cancel after a Vote permission change (TLA+ F2)", () => {
  let a: Keypair;
  let b: Keypair;
  let c: Keypair;
  let multisigPda: PublicKey;
  const vaultTransactionIndex = 1n;
  const configTransactionIndex = 2n;

  const approve = async (transactionIndex: bigint, member: Keypair) => {
    const signature = await multisig.rpc.proposalApprove({
      connection,
      feePayer: member,
      multisigPda,
      transactionIndex,
      member,
      programId,
    });
    await connection.confirmTransaction(signature);
  };

  const cancel = (member: Keypair) =>
    multisig.rpc.proposalCancel({
      connection,
      feePayer: member,
      multisigPda,
      transactionIndex: vaultTransactionIndex,
      member,
      programId,
    });

  const proposal = () =>
    Proposal.fromAccountAddress(
      connection,
      multisig.getProposalPda({
        multisigPda,
        transactionIndex: vaultTransactionIndex,
        programId,
      })[0]
    );

  before(async () => {
    [a, b, c] = await Promise.all([
      generateFundedKeypair(connection),
      generateFundedKeypair(connection),
      generateFundedKeypair(connection),
    ]);
    const creator = await generateFundedKeypair(connection);
    const createKey = Keypair.generate();
    multisigPda = multisig.getMultisigPda({
      createKey: createKey.publicKey,
      programId,
    })[0];
    const programConfig =
      await multisig.accounts.ProgramConfig.fromAccountAddress(
        connection,
        multisig.getProgramConfigPda({ programId })[0]
      );

    // 2-of-3: every key has every permission.
    let signature = await multisig.rpc.multisigCreateV2({
      connection,
      treasury: programConfig.treasury,
      createKey,
      creator,
      multisigPda,
      configAuthority: null,
      threshold: 2,
      members: [a, b, c].map((k) => ({
        key: k.publicKey,
        permissions: Permissions.all(),
      })),
      timeLock: 0,
      rentCollector: null,
      programId,
    });
    await connection.confirmTransaction(signature);

    const [vaultPda] = multisig.getVaultPda({ multisigPda, index: 0, programId });
    signature = await connection.requestAirdrop(vaultPda, 2 * LAMPORTS_PER_SOL);
    await connection.confirmTransaction(signature);

    signature = await multisig.rpc.vaultTransactionCreate({
      connection,
      feePayer: a,
      multisigPda,
      transactionIndex: vaultTransactionIndex,
      vaultIndex: 0,
      transactionMessage: new TransactionMessage({
        payerKey: vaultPda,
        recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
        instructions: [
          createTestTransferInstruction(
            vaultPda,
            Keypair.generate().publicKey,
            1 * LAMPORTS_PER_SOL
          ),
        ],
      }),
      ephemeralSigners: 0,
      creator: a.publicKey,
      programId,
    });
    await connection.confirmTransaction(signature);
    signature = await multisig.rpc.proposalCreate({
      connection,
      feePayer: a,
      multisigPda,
      transactionIndex: vaultTransactionIndex,
      creator: a,
      programId,
    });
    await connection.confirmTransaction(signature);
    await approve(vaultTransactionIndex, a);
    await approve(vaultTransactionIndex, b);
  });

  it("keeps the cancellation of a member that lost Vote", async () => {
    // a cancels while a is still a voter: 1 of 2 cancellations.
    let signature = await cancel(a);
    await connection.confirmTransaction(signature);
    assert.ok(multisig.types.isProposalStatusApproved((await proposal()).status));

    // Config transaction: remove a, then add a back without Vote.
    signature = await multisig.rpc.configTransactionCreate({
      connection,
      feePayer: a,
      multisigPda,
      transactionIndex: configTransactionIndex,
      creator: a.publicKey,
      actions: [
        { __kind: "RemoveMember", oldMember: a.publicKey },
        {
          __kind: "AddMember",
          newMember: {
            key: a.publicKey,
            permissions: Permissions.fromPermissions([
              Permission.Initiate,
              Permission.Execute,
            ]),
          },
        },
      ],
      programId,
    });
    await connection.confirmTransaction(signature);
    signature = await multisig.rpc.proposalCreate({
      connection,
      feePayer: a,
      multisigPda,
      transactionIndex: configTransactionIndex,
      creator: a,
      programId,
    });
    await connection.confirmTransaction(signature);
    await approve(configTransactionIndex, a);
    await approve(configTransactionIndex, b);
    signature = await multisig.rpc.configTransactionExecute({
      connection,
      feePayer: a,
      multisigPda,
      transactionIndex: configTransactionIndex,
      member: a,
      rentPayer: a,
      programId,
    });
    await connection.confirmTransaction(signature);

    // a is a member without Vote; the vault transaction is stale but still Approved.
    const multisigAccount = await Multisig.fromAccountAddress(connection, multisigPda);
    const memberA = multisigAccount.members.find((m) => m.key.equals(a.publicKey));
    assert.ok(memberA);
    assert.equal(memberA.permissions.mask & Permission.Vote, 0);
    assert.equal(
      multisig.utils.toBigInt(multisigAccount.staleTransactionIndex),
      configTransactionIndex
    );
    assert.ok(multisig.types.isProposalStatusApproved((await proposal()).status));

    // a can no longer cancel.
    await assert.rejects(() => cancel(a), /Unauthorized/);

    // b cancels. The kept cancellation of a reaches threshold 2 with one current voter.
    signature = await cancel(b);
    await connection.confirmTransaction(signature);
    const cancelled = await proposal();
    assert.ok(multisig.types.isProposalStatusCancelled(cancelled.status));
    assert.deepEqual(
      cancelled.cancelled.map((k) => k.toBase58()).sort(),
      [a, b].map((k) => k.publicKey.toBase58()).sort()
    );
    const voters = multisigAccount.members
      .filter((m) => (m.permissions.mask & Permission.Vote) !== 0)
      .map((m) => m.key.toBase58());
    const voterCancellations = cancelled.cancelled.filter((k) =>
      voters.includes(k.toBase58())
    );
    assert.equal(voterCancellations.length, 1);
    assert.ok(voterCancellations.length < multisigAccount.threshold);
  });
});
