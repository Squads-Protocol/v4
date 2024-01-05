import * as multisig from "@sqds/multisig";
import {
  comparePubkeys,
  createAutonomousMultisig,
  createControlledMultisig,
  createLocalhostConnection,
  generateFundedKeypair,
  generateMultisigMembers,
  getTestProgramId,
  TestMembers,
} from "../../utils";
import { Keypair, PublicKey } from "@solana/web3.js";
import assert from "assert";

const { Multisig } = multisig.accounts;
const { Permission, Permissions } = multisig.types;

const programId = getTestProgramId();
const connection = createLocalhostConnection();

describe("Instructions / multisig_create", () => {
  let members: TestMembers;

  before(async () => {
    members = await generateMultisigMembers(connection);
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
        multisig.rpc.multisigCreate({
          connection,
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

    const tx = multisig.transactions.multisigCreate({
      blockhash: (await connection.getLatestBlockhash()).blockhash,
      createKey: createKey.publicKey,
      creator: creator.publicKey,
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
        multisig.rpc.multisigCreate({
          connection,
          createKey,
          creator,
          multisigPda,
          configAuthority: null,
          timeLock: 0,
          threshold: 1,
          members: [],
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
        multisig.rpc.multisigCreate({
          connection,
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
        multisig.rpc.multisigCreate({
          connection,
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
        multisig.rpc.multisigCreate({
          connection,
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
          sendOptions: { skipPreflight: true },
          programId,
        }),
      /Invalid threshold, must be between 1 and number of members with Vote permission/
    );
  });

  it("create a new autonomous multisig", async () => {
    const createKey = Keypair.generate();

    const [multisigPda, multisigBump] = await createAutonomousMultisig({
      connection,
      createKey,
      members,
      threshold: 2,
      timeLock: 0,
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

  it("create a new controlled multisig", async () => {
    const createKey = Keypair.generate();
    const configAuthority = await generateFundedKeypair(connection);

    const [multisigPda] = await createControlledMultisig({
      connection,
      createKey,
      configAuthority: configAuthority.publicKey,
      members,
      threshold: 2,
      timeLock: 0,
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
});
