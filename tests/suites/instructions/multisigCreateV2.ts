import * as multisig from "@sqds/multisig";
import {
  comparePubkeys,
  createAutonomousMultisigV2,
  createControlledMultisigV2,
  createLocalhostConnection,
  generateFundedKeypair,
  generateMultisigMembers,
  getTestProgramConfigAuthority,
  getTestProgramId,
  getTestProgramTreasury,
  TestMembers,
} from "../../utils";
import {
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import assert from "assert";

const { Multisig } = multisig.accounts;
const { Permission, Permissions } = multisig.types;

const connection = createLocalhostConnection();

const programId = getTestProgramId();
const programConfigAuthority = getTestProgramConfigAuthority();
const programTreasury = getTestProgramTreasury();
const programConfigPda = multisig.getProgramConfigPda({ programId })[0];

describe("Instructions / multisig_create_v2", () => {
  let members: TestMembers;
  let programTreasury: PublicKey;

  before(async () => {
    members = await generateMultisigMembers(connection);

    const programConfigPda = multisig.getProgramConfigPda({ programId })[0];
    const programConfig =
      await multisig.accounts.ProgramConfig.fromAccountAddress(
        connection,
        programConfigPda
      );
    programTreasury = programConfig.treasury;
  });

  it("error: duplicate member", async () => {
    const creator = await generateFundedKeypair(connection);

    const createKey = Keypair.generate();
    const [multisigPda] = multisig.getMultisigPda({
      createKey: createKey.publicKey,
      programId,
    });

    await assert.rejects(
      () =>
        multisig.rpc.multisigCreateV2({
          connection,
          treasury: programTreasury,
          creator,
          multisigPda,
          configAuthority: null,
          timeLock: 0,
          threshold: 1,
          members: [
            {
              key: members.almighty.publicKey,
              permissions: Permissions.all(),
            },
            {
              key: members.almighty.publicKey,
              permissions: Permissions.all(),
            },
          ],
          createKey,
          rentCollector: null,
          sendOptions: { skipPreflight: true },
          programId,
        }),
      /Found multiple members with the same pubkey/
    );
  });

  it("error: missing signature from `createKey`", async () => {
    const creator = await generateFundedKeypair(connection);

    const createKey = Keypair.generate();
    const [multisigPda] = multisig.getMultisigPda({
      createKey: createKey.publicKey,
      programId,
    });

    const tx = multisig.transactions.multisigCreateV2({
      blockhash: (await connection.getLatestBlockhash()).blockhash,
      treasury: programTreasury,
      createKey: createKey.publicKey,
      creator: creator.publicKey,
      multisigPda,
      configAuthority: null,
      timeLock: 0,
      threshold: 1,
      rentCollector: null,
      members: [
        {
          key: members.almighty.publicKey,
          permissions: Permissions.all(),
        },
        {
          key: members.almighty.publicKey,
          permissions: Permissions.all(),
        },
      ],
      programId,
    });

    // Missing signature from `createKey`.
    tx.sign([creator]);

    await assert.rejects(
      () => connection.sendTransaction(tx, { skipPreflight: true }),
      /Transaction signature verification failure/
    );
  });

  it("error: empty members", async () => {
    const creator = await generateFundedKeypair(connection);

    const createKey = Keypair.generate();
    const [multisigPda] = multisig.getMultisigPda({
      createKey: createKey.publicKey,
      programId,
    });

    await assert.rejects(
      () =>
        multisig.rpc.multisigCreateV2({
          connection,
          treasury: programTreasury,
          createKey,
          creator,
          multisigPda,
          configAuthority: null,
          timeLock: 0,
          threshold: 1,
          members: [],
          rentCollector: null,
          sendOptions: { skipPreflight: true },
          programId,
        }),
      /Members don't include any proposers/
    );
  });

  it("error: member has unknown permission", async () => {
    const creator = await generateFundedKeypair(connection);
    const member = Keypair.generate();

    const createKey = Keypair.generate();
    const [multisigPda] = multisig.getMultisigPda({
      createKey: createKey.publicKey,
      programId,
    });

    await assert.rejects(
      () =>
        multisig.rpc.multisigCreateV2({
          connection,
          treasury: programTreasury,
          createKey,
          creator,
          multisigPda,
          configAuthority: null,
          timeLock: 0,
          threshold: 1,
          members: [
            {
              key: member.publicKey,
              permissions: {
                mask: 1 | 2 | 4 | 8,
              },
            },
          ],
          rentCollector: null,
          sendOptions: { skipPreflight: true },
          programId,
        }),
      /Member has unknown permission/
    );
  });

  // We cannot really test it because we can't pass u16::MAX members to the instruction.
  it("error: too many members");

  it("error: invalid threshold (< 1)", async () => {
    const creator = await generateFundedKeypair(connection);

    const createKey = Keypair.generate();
    const [multisigPda] = multisig.getMultisigPda({
      createKey: createKey.publicKey,
      programId,
    });

    await assert.rejects(
      () =>
        multisig.rpc.multisigCreateV2({
          connection,
          treasury: programTreasury,
          createKey,
          creator,
          multisigPda,
          configAuthority: null,
          timeLock: 0,
          threshold: 0,
          members: Object.values(members).map((m) => ({
            key: m.publicKey,
            permissions: Permissions.all(),
          })),
          rentCollector: null,
          sendOptions: { skipPreflight: true },
          programId,
        }),
      /Invalid threshold, must be between 1 and number of members/
    );
  });

  it("error: invalid threshold (> members with permission to Vote)", async () => {
    const creator = await generateFundedKeypair(connection);

    const createKey = Keypair.generate();
    const [multisigPda] = multisig.getMultisigPda({
      createKey: createKey.publicKey,
      programId,
    });

    await assert.rejects(
      () =>
        multisig.rpc.multisigCreateV2({
          connection,
          treasury: programTreasury,
          createKey,
          creator,
          multisigPda,
          configAuthority: null,
          timeLock: 0,
          members: [
            {
              key: members.almighty.publicKey,
              permissions: Permissions.all(),
            },
            // Can only initiate transactions.
            {
              key: members.proposer.publicKey,
              permissions: Permissions.fromPermissions([Permission.Initiate]),
            },
            // Can only vote on transactions.
            {
              key: members.voter.publicKey,
              permissions: Permissions.fromPermissions([Permission.Vote]),
            },
            // Can only execute transactions.
            {
              key: members.executor.publicKey,
              permissions: Permissions.fromPermissions([Permission.Execute]),
            },
          ],
          // Threshold is 3, but there are only 2 voters.
          threshold: 3,
          rentCollector: null,
          sendOptions: { skipPreflight: true },
          programId,
        }),
      /Invalid threshold, must be between 1 and number of members with Vote permission/
    );
  });

  it("create a new autonomous multisig", async () => {
    const createKey = Keypair.generate();

    const [multisigPda, multisigBump] = await createAutonomousMultisigV2({
      connection,
      createKey,
      members,
      threshold: 2,
      timeLock: 0,
      rentCollector: null,
      programId,
    });

    const multisigAccount = await Multisig.fromAccountAddress(
      connection,
      multisigPda
    );
    assert.strictEqual(
      multisigAccount.configAuthority.toBase58(),
      PublicKey.default.toBase58()
    );
    assert.strictEqual(multisigAccount.threshold, 2);
    assert.deepEqual(
      multisigAccount.members,
      [
        {
          key: members.almighty.publicKey,
          permissions: {
            mask: Permission.Initiate | Permission.Vote | Permission.Execute,
          },
        },
        {
          key: members.proposer.publicKey,
          permissions: {
            mask: Permission.Initiate,
          },
        },
        {
          key: members.voter.publicKey,
          permissions: {
            mask: Permission.Vote,
          },
        },
        {
          key: members.executor.publicKey,
          permissions: {
            mask: Permission.Execute,
          },
        },
      ].sort((a, b) => comparePubkeys(a.key, b.key))
    );
    assert.strictEqual(multisigAccount.rentCollector, null);
    assert.strictEqual(multisigAccount.transactionIndex.toString(), "0");
    assert.strictEqual(multisigAccount.staleTransactionIndex.toString(), "0");
    assert.strictEqual(
      multisigAccount.createKey.toBase58(),
      createKey.publicKey.toBase58()
    );
    assert.strictEqual(multisigAccount.bump, multisigBump);
  });

  it("create a new autonomous multisig with rent reclamation enabled", async () => {
    const createKey = Keypair.generate();
    const rentCollector = Keypair.generate().publicKey;

    const [multisigPda, multisigBump] = await createAutonomousMultisigV2({
      connection,
      createKey,
      members,
      threshold: 2,
      timeLock: 0,
      rentCollector,
      programId,
    });

    const multisigAccount = await Multisig.fromAccountAddress(
      connection,
      multisigPda
    );

    assert.strictEqual(
      multisigAccount.rentCollector?.toBase58(),
      rentCollector.toBase58()
    );
  });

  it("create a new controlled multisig", async () => {
    const createKey = Keypair.generate();
    const configAuthority = await generateFundedKeypair(connection);

    const [multisigPda] = await createControlledMultisigV2({
      connection,
      createKey,
      configAuthority: configAuthority.publicKey,
      members,
      threshold: 2,
      timeLock: 0,
      rentCollector: null,
      programId,
    });

    const multisigAccount = await Multisig.fromAccountAddress(
      connection,
      multisigPda
    );

    assert.strictEqual(
      multisigAccount.configAuthority.toBase58(),
      configAuthority.publicKey.toBase58()
    );
    // We can skip the rest of the assertions because they are already tested
    // in the previous case and will be the same here.
  });

  it("create a new multisig and pay creation fee", async () => {
    //region Airdrop to the program config authority
    let signature = await connection.requestAirdrop(
      programConfigAuthority.publicKey,
      LAMPORTS_PER_SOL
    );
    await connection.confirmTransaction(signature);
    //endregion

    const multisigCreationFee = 0.1 * LAMPORTS_PER_SOL;

    //region Configure the global multisig creation fee
    const setCreationFeeIx =
      multisig.generated.createProgramConfigSetMultisigCreationFeeInstruction(
        {
          programConfig: programConfigPda,
          authority: programConfigAuthority.publicKey,
        },
        {
          args: { newMultisigCreationFee: multisigCreationFee },
        },
        programId
      );
    const message = new TransactionMessage({
      recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
      payerKey: programConfigAuthority.publicKey,
      instructions: [setCreationFeeIx],
    }).compileToV0Message();
    const tx = new VersionedTransaction(message);
    tx.sign([programConfigAuthority]);
    signature = await connection.sendTransaction(tx);
    await connection.confirmTransaction(signature);
    let programConfig =
      await multisig.accounts.ProgramConfig.fromAccountAddress(
        connection,
        programConfigPda
      );
    assert.strictEqual(
      programConfig.multisigCreationFee.toString(),
      multisigCreationFee.toString()
    );
    //endregion

    //region Create a new multisig
    const creator = await generateFundedKeypair(connection);
    const createKey = Keypair.generate();

    const creatorBalancePre = await connection.getBalance(creator.publicKey);

    const multisigPda = multisig.getMultisigPda({
      createKey: createKey.publicKey,
      programId,
    })[0];

    signature = await multisig.rpc.multisigCreateV2({
      connection,
      treasury: programTreasury,
      createKey,
      creator,
      multisigPda,
      configAuthority: null,
      timeLock: 0,
      threshold: 2,
      members: [
        { key: members.almighty.publicKey, permissions: Permissions.all() },
        {
          key: members.proposer.publicKey,
          permissions: Permissions.fromPermissions([Permission.Initiate]),
        },
        {
          key: members.voter.publicKey,
          permissions: Permissions.fromPermissions([Permission.Vote]),
        },
        {
          key: members.executor.publicKey,
          permissions: Permissions.fromPermissions([Permission.Execute]),
        },
      ],
      rentCollector: null,
      programId,
      sendOptions: { skipPreflight: true },
    });
    await connection.confirmTransaction(signature);

    const creatorBalancePost = await connection.getBalance(creator.publicKey);
    const rentAndNetworkFee = 2738320;

    assert.strictEqual(
      creatorBalancePost,
      creatorBalancePre - rentAndNetworkFee - multisigCreationFee
    );
    //endregion

    //region Reset the global multisig creation fee
    const resetCreationFeeIx =
      multisig.generated.createProgramConfigSetMultisigCreationFeeInstruction(
        {
          programConfig: programConfigPda,
          authority: programConfigAuthority.publicKey,
        },
        {
          args: { newMultisigCreationFee: 0 },
        },
        programId
      );
    const message2 = new TransactionMessage({
      recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
      payerKey: programConfigAuthority.publicKey,
      instructions: [resetCreationFeeIx],
    }).compileToV0Message();
    const tx2 = new VersionedTransaction(message2);
    tx2.sign([programConfigAuthority]);
    signature = await connection.sendTransaction(tx2);
    await connection.confirmTransaction(signature);
    programConfig = await multisig.accounts.ProgramConfig.fromAccountAddress(
      connection,
      programConfigPda
    );
    assert.strictEqual(programConfig.multisigCreationFee.toString(), "0");
    //endregion
  });
});
