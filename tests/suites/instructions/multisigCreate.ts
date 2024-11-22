import { Keypair } from "@solana/web3.js";
import * as multisig from "@sqds/multisig";
import assert from "assert";
import {
  createAutonomousMultisig,
  createControlledMultisig,
  createLocalhostConnection,
  generateFundedKeypair,
  generateMultisigMembers,
  getTestProgramId,
  TestMembers
} from "../../utils";

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
      /Deprecated/
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
      /Deprecated/
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
      /Deprecated/
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
      /Deprecated/
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
      /Deprecated/
    );
  });

  it("error: create a new autonomous multisig (deprecated)", async () => {
    const createKey = Keypair.generate();
    assert.rejects(
      () =>
        createAutonomousMultisig({
          connection,
          createKey,
          members,
          threshold: 2,
          timeLock: 0,
          programId,
        }),
      /Deprecated/
    );

  });

  it("error: create a new controlled multisig (deprecated)", async () => {
    const createKey = Keypair.generate();
    const configAuthority = await generateFundedKeypair(connection);
    assert.rejects(
      () =>
        createControlledMultisig({
          connection,
          createKey,
          configAuthority: configAuthority.publicKey,
          members,
          threshold: 2,
          timeLock: 0,
          programId,
        }),
      /Deprecated/
    );

  });
});
