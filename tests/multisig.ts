import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
} from "@solana/web3.js";
import * as multisig from "@sqds/multisig";
import * as assert from "assert";

const { Multisig } = multisig.accounts;
const { Permission, Permissions } = multisig.types;

describe("multisig", () => {
  const connection = new Connection("http://127.0.0.1:8899", "confirmed");

  // Used only for paying for creation of multisigs, it's not actually a member of any of them.
  const creator = Keypair.generate();
  console.log("creator:", creator.publicKey.toBase58());

  const members = [Keypair.generate(), Keypair.generate(), Keypair.generate()];
  console.log(
    "members:",
    JSON.stringify(
      members.map((m) => m.publicKey),
      null,
      2
    )
  );

  // For the sake of the tests we'll create two multisigs,
  // one - autonomous where all config changes should go through the members' approval process,
  // and the other - controlled where the config changes can be made by some external
  // `config_authority` - a regular Keypair in our case.
  let autonomousMultisigCreateKey: PublicKey;
  let controlledMultisigCreateKey: PublicKey;
  let controlledMultisigConfigAuthority: Keypair;

  before(async () => {
    // Airdropped 10 SOL to creator.
    const sig = await connection.requestAirdrop(
      creator.publicKey,
      10 * LAMPORTS_PER_SOL
    );
    await connection.confirmTransaction(sig);

    // Airdrop 100 SOL to each member.
    await Promise.all(
      members.map(async (member) => {
        const sig = await connection.requestAirdrop(
          member.publicKey,
          100 * LAMPORTS_PER_SOL
        );
        await connection.confirmTransaction(sig);
      })
    );
  });

  describe("multisig_create", () => {
    it("error: duplicate member", async () => {
      const createKey = Keypair.generate().publicKey;
      const [multisigPda] = multisig.getMultisigPda({
        createKey,
      });
      const [configAuthority] = multisig.getAuthorityPda({
        multisigPda,
        index: 0,
      });

      await assert.rejects(
        () =>
          multisig.rpc.multisigCreate({
            connection,
            creator,
            multisigPda,
            configAuthority,
            threshold: 1,
            members: [
              {
                key: members[0].publicKey,
                permissions: Permissions.all(),
              },
              {
                key: members[0].publicKey,
                permissions: Permissions.all(),
              },
            ],
            createKey,
            allowExternalExecute: false,
            sendOptions: { skipPreflight: true },
          }),
        /Found multiple members with the same pubkey/
      );
    });

    it("error: empty members", async () => {
      const createKey = Keypair.generate().publicKey;
      const [multisigPda] = multisig.getMultisigPda({
        createKey,
      });
      const [configAuthority] = multisig.getAuthorityPda({
        multisigPda,
        index: 0,
      });

      await assert.rejects(
        () =>
          multisig.rpc.multisigCreate({
            connection,
            creator,
            multisigPda,
            configAuthority,
            threshold: 1,
            members: [],
            createKey,
            allowExternalExecute: false,
            sendOptions: { skipPreflight: true },
          }),
        /Members array is empty/
      );
    });

    // We cannot really test it because we can't pass u16::MAX members to the instruction.
    it("error: too many members");

    it("error: invalid threshold (< 1)", async () => {
      const createKey = Keypair.generate().publicKey;
      const [multisigPda] = multisig.getMultisigPda({
        createKey,
      });
      const [configAuthority] = multisig.getAuthorityPda({
        multisigPda,
        index: 0,
      });

      await assert.rejects(
        () =>
          multisig.rpc.multisigCreate({
            connection,
            creator,
            multisigPda,
            configAuthority,
            threshold: 0,
            members: members.map((m) => ({
              key: m.publicKey,
              permissions: Permissions.all(),
            })),
            createKey,
            allowExternalExecute: false,
            sendOptions: { skipPreflight: true },
          }),
        /Invalid threshold, must be between 1 and number of members/
      );
    });

    it("error: invalid threshold (> members.length)", async () => {
      const createKey = Keypair.generate().publicKey;
      const [multisigPda] = multisig.getMultisigPda({
        createKey,
      });
      const [configAuthority] = multisig.getAuthorityPda({
        multisigPda,
        index: 0,
      });

      await assert.rejects(
        () =>
          multisig.rpc.multisigCreate({
            connection,
            creator,
            multisigPda,
            configAuthority,
            threshold: members.length + 1,
            members: members.map((m) => ({
              key: m.publicKey,
              permissions: Permissions.all(),
            })),
            createKey,
            allowExternalExecute: false,
            sendOptions: { skipPreflight: true },
          }),
        /Invalid threshold, must be between 1 and number of members/
      );
    });

    it("create a new autonomous multisig", async () => {
      autonomousMultisigCreateKey = Keypair.generate().publicKey;

      const [multisigPda, multisigBump] = multisig.getMultisigPda({
        createKey: autonomousMultisigCreateKey,
      });
      const [configAuthority] = multisig.getAuthorityPda({
        multisigPda,
        index: 0,
      });

      const signature = await multisig.rpc.multisigCreate({
        connection,
        creator,
        multisigPda,
        configAuthority,
        threshold: 1,
        members: members.map((m) => ({
          key: m.publicKey,
          permissions: Permissions.all(),
        })),
        createKey: autonomousMultisigCreateKey,
        allowExternalExecute: false,
        sendOptions: { skipPreflight: true },
      });

      await connection.confirmTransaction(signature);

      const multisigAccount = await Multisig.fromAccountAddress(
        connection,
        multisigPda
      );

      assert.strictEqual(
        multisigAccount.configAuthority.toBase58(),
        configAuthority.toBase58()
      );
      assert.strictEqual(multisigAccount.threshold, 1);
      assert.deepEqual(
        multisigAccount.members,
        members
          .map((m) => ({
            key: m.publicKey,
            permissions: {
              mask: Permission.Initiate | Permission.Vote | Permission.Execute,
            },
          }))
          .sort((a, b) => a.key.toBuffer().compare(b.key.toBuffer()))
      );
      assert.strictEqual(multisigAccount.authorityIndex, 1);
      assert.strictEqual(multisigAccount.transactionIndex.toString(), "0");
      assert.strictEqual(multisigAccount.staleTransactionIndex.toString(), "0");
      assert.strictEqual(multisigAccount.allowExternalExecute, false);
      assert.strictEqual(
        multisigAccount.createKey.toBase58(),
        autonomousMultisigCreateKey.toBase58()
      );
      assert.strictEqual(multisigAccount.bump, multisigBump);
    });

    it("create a new controlled multisig", async () => {
      controlledMultisigCreateKey = Keypair.generate().publicKey;
      controlledMultisigConfigAuthority = await generateFundedKeypair(
        connection
      );

      const [multisigPda] = multisig.getMultisigPda({
        createKey: controlledMultisigCreateKey,
      });

      const signature = await multisig.rpc.multisigCreate({
        connection,
        creator,
        multisigPda,
        configAuthority: controlledMultisigConfigAuthority.publicKey,
        threshold: 1,
        members: members.map((m) => ({
          key: m.publicKey,
          permissions: Permissions.all(),
        })),
        createKey: controlledMultisigCreateKey,
        allowExternalExecute: false,
        sendOptions: { skipPreflight: true },
      });

      await connection.confirmTransaction(signature);

      const multisigAccount = await Multisig.fromAccountAddress(
        connection,
        multisigPda
      );

      assert.strictEqual(
        multisigAccount.configAuthority.toBase58(),
        controlledMultisigConfigAuthority.publicKey.toBase58()
      );
      // We can skip the rest of the assertions because they are already tested
      // in the previous case and will be the same here.
    });
  });

  describe("multisig_add_member", () => {
    const newMember = {
      key: Keypair.generate().publicKey,
      permissions: Permissions.all(),
    } as const;
    const newMember2 = {
      key: Keypair.generate().publicKey,
      permissions: Permissions.all(),
    } as const;

    it("error: adding an existing member", async () => {
      const feePayer = await generateFundedKeypair(connection);
      const [multisigPda] = multisig.getMultisigPda({
        createKey: controlledMultisigCreateKey,
      });

      // Adding the same member again should fail.
      await assert.rejects(
        multisig.rpc.multisigAddMember({
          connection,
          feePayer,
          multisigPda,
          configAuthority: controlledMultisigConfigAuthority.publicKey,
          newMember: {
            key: members[0].publicKey,
            permissions: Permissions.all(),
          },
          signers: [controlledMultisigConfigAuthority],
          sendOptions: { skipPreflight: true },
        }),
        /Member is already in multisig/
      );
    });

    it("error: missing authority signature", async () => {
      const feePayer = await generateFundedKeypair(connection);
      const [multisigPda] = multisig.getMultisigPda({
        createKey: controlledMultisigCreateKey,
      });

      await assert.rejects(
        multisig.rpc.multisigAddMember({
          connection,
          feePayer,
          multisigPda,
          configAuthority: controlledMultisigConfigAuthority.publicKey,
          newMember,
          signers: [
            /* missing authority signature */
          ],
          sendOptions: { skipPreflight: true },
        }),
        /Transaction signature verification failure/
      );
    });

    it("error: invalid authority", async () => {
      const fakeAuthority = await generateFundedKeypair(connection);
      const [multisigPda] = multisig.getMultisigPda({
        createKey: controlledMultisigCreateKey,
      });

      await assert.rejects(
        multisig.rpc.multisigAddMember({
          connection,
          feePayer: fakeAuthority,
          multisigPda,
          configAuthority: fakeAuthority.publicKey,
          newMember,
          signers: [fakeAuthority],
          sendOptions: { skipPreflight: true },
        }),
        /Invalid authority/
      );
    });

    it("add a new member to a controlled multisig", async () => {
      // feePayer can be anyone.
      const feePayer = await generateFundedKeypair(connection);

      const [multisigPda] = multisig.getMultisigPda({
        createKey: controlledMultisigCreateKey,
      });
      let multisigAccountInfo = await connection.getAccountInfo(multisigPda);
      assert.ok(multisigAccountInfo);
      let [multisigAccount] = Multisig.fromAccountInfo(multisigAccountInfo);

      const initialMembersLength = multisigAccount.members.length;
      const initialOccupiedSize =
        multisig.generated.multisigBeet.toFixedFromValue({
          accountDiscriminator: multisig.generated.multisigDiscriminator,
          ...multisigAccount,
        }).byteSize;
      const initialAllocatedSize = multisigAccountInfo.data.length;

      // Right after the creation of the multisig, the allocated account space is fully utilized.
      assert.equal(initialOccupiedSize, initialAllocatedSize);

      let signature = await multisig.rpc.multisigAddMember({
        connection,
        feePayer,
        multisigPda,
        configAuthority: controlledMultisigConfigAuthority.publicKey,
        newMember,
        memo: "Adding my good friend to the multisig",
        signers: [controlledMultisigConfigAuthority],
        sendOptions: { skipPreflight: true },
      });
      await connection.confirmTransaction(signature);

      multisigAccountInfo = await connection.getAccountInfo(multisigPda);
      multisigAccount = Multisig.fromAccountInfo(multisigAccountInfo!)[0];

      let newMembersLength = multisigAccount.members.length;
      let newOccupiedSize = multisig.generated.multisigBeet.toFixedFromValue({
        accountDiscriminator: multisig.generated.multisigDiscriminator,
        ...multisigAccount,
      }).byteSize;

      // New member was added.
      assert.strictEqual(newMembersLength, initialMembersLength + 1);
      assert.ok(
        multisigAccount.members.find((m) => m.key.equals(newMember.key))
      );
      // Account occupied size increased by the size of the new Member.
      assert.strictEqual(
        newOccupiedSize,
        initialOccupiedSize + multisig.generated.memberBeet.byteSize
      );
      // Account allocated size increased by the size of 10 `Member`s
      // to accommodate for future additions.
      assert.strictEqual(
        multisigAccountInfo!.data.length,
        initialAllocatedSize + 10 * multisig.generated.memberBeet.byteSize
      );

      // Adding one more member shouldn't increase the allocated size.
      signature = await multisig.rpc.multisigAddMember({
        connection,
        feePayer,
        multisigPda,
        configAuthority: controlledMultisigConfigAuthority.publicKey,
        newMember: newMember2,
        signers: [controlledMultisigConfigAuthority],
        sendOptions: { skipPreflight: true },
      });
      await connection.confirmTransaction(signature);
      // Re-fetch the multisig account.
      multisigAccountInfo = await connection.getAccountInfo(multisigPda);
      multisigAccount = Multisig.fromAccountInfo(multisigAccountInfo!)[0];
      newMembersLength = multisigAccount.members.length;
      newOccupiedSize = multisig.generated.multisigBeet.toFixedFromValue({
        accountDiscriminator: multisig.generated.multisigDiscriminator,
        ...multisigAccount,
      }).byteSize;
      // Added one more member.
      assert.strictEqual(newMembersLength, initialMembersLength + 2);
      assert.ok(
        multisigAccount.members.find((m) => m.key.equals(newMember2.key))
      );
      // Account occupied size increased by the size of one more Member.
      assert.strictEqual(
        newOccupiedSize,
        initialOccupiedSize + 2 * multisig.generated.memberBeet.byteSize
      );
      // Account allocated size remained unchanged since the previous addition.
      assert.strictEqual(
        multisigAccountInfo!.data.length,
        initialAllocatedSize + 10 * multisig.generated.memberBeet.byteSize
      );
    });
  });
});

async function generateFundedKeypair(connection: Connection) {
  const keypair = Keypair.generate();

  const tx = await connection.requestAirdrop(
    keypair.publicKey,
    1 * LAMPORTS_PER_SOL
  );
  await connection.confirmTransaction(tx);

  return keypair;
}
