import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  TransactionMessage,
  SystemProgram,
} from "@solana/web3.js";
import * as multisig from "@sqds/multisig";
import * as assert from "assert";

const { Multisig, MultisigTransaction } = multisig.accounts;
const { Permission, Permissions, TransactionStatus } = multisig.types;

describe("multisig", () => {
  const connection = new Connection("http://127.0.0.1:8899", "confirmed");

  const members = {
    almighty: Keypair.generate(),
    proposer: Keypair.generate(),
    voter: Keypair.generate(),
    executor: Keypair.generate(),
  };

  console.log("Members:");
  for (const [name, keypair] of Object.entries(members)) {
    console.log(name, ":", keypair.publicKey.toBase58());
  }

  // For the sake of the tests we'll create two multisigs,
  // one - autonomous where all config changes should go through the members' approval process,
  // and the other - controlled where the config changes can be made by some external
  // `config_authority` - a regular Keypair in our case.
  let autonomousMultisigCreateKey: PublicKey;
  let controlledMultisigCreateKey: PublicKey;
  let controlledMultisigConfigAuthority: Keypair;

  before(async () => {
    // Airdrop 100 SOL to each member.
    await Promise.all(
      Object.values(members).map(async (member) => {
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
      const creator = await generateFundedKeypair(connection);

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
                key: members.almighty.publicKey,
                permissions: Permissions.all(),
              },
              {
                key: members.almighty.publicKey,
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
      const creator = await generateFundedKeypair(connection);

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
      const creator = await generateFundedKeypair(connection);

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
            members: Object.values(members).map((m) => ({
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
      const creator = await generateFundedKeypair(connection);

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
            threshold: Object.keys(members).length + 1,
            members: Object.values(members).map((m) => ({
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
      const creator = await generateFundedKeypair(connection);

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
        threshold: 2,
        members: [
          { key: members.almighty.publicKey, permissions: Permissions.all() },
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
      const creator = await generateFundedKeypair(connection);

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
        threshold: 2,
        members: [
          { key: members.almighty.publicKey, permissions: Permissions.all() },
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
            key: members.almighty.publicKey,
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
        /Attempted to perform an unauthorized action/
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

    it("add a new member to an autonomous multisig");
  });

  describe("transaction_create", () => {
    it("error: not a member", async () => {
      const nonMember = await generateFundedKeypair(connection);

      const [multisigPda] = multisig.getMultisigPda({
        createKey: autonomousMultisigCreateKey,
      });
      let multisigAccount = await Multisig.fromAccountAddress(
        connection,
        multisigPda
      );

      // Vault, index 1.
      const [vaultPda] = multisig.getAuthorityPda({
        multisigPda,
        index: 1,
      });

      // Test transfer instruction.
      const testPayee = Keypair.generate();
      const testIx = await createTestTransferInstruction(
        vaultPda,
        testPayee.publicKey
      );
      const testTransferMessage = new TransactionMessage({
        payerKey: vaultPda,
        recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
        instructions: [testIx],
      });

      const transactionIndex =
        multisig.utils.toBigInt(multisigAccount.transactionIndex) + 1n;

      await assert.rejects(
        () =>
          multisig.rpc.transactionCreate({
            connection,
            feePayer: nonMember,
            multisigPda,
            transactionIndex,
            creator: nonMember.publicKey,
            authorityIndex: 1,
            transactionMessage: testTransferMessage,
          }),
        /Provided pubkey is not a member of multisig/
      );
    });

    it("error: unauthorized", async () => {
      const [multisigPda] = multisig.getMultisigPda({
        createKey: autonomousMultisigCreateKey,
      });
      let multisigAccount = await Multisig.fromAccountAddress(
        connection,
        multisigPda
      );

      // Vault, index 1.
      const [vaultPda] = multisig.getAuthorityPda({
        multisigPda,
        index: 1,
      });

      // Test transfer instruction.
      const testPayee = Keypair.generate();
      const testIx = await createTestTransferInstruction(
        vaultPda,
        testPayee.publicKey
      );
      const testTransferMessage = new TransactionMessage({
        payerKey: vaultPda,
        recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
        instructions: [testIx],
      });

      const transactionIndex =
        multisig.utils.toBigInt(multisigAccount.transactionIndex) + 1n;

      await assert.rejects(
        () =>
          multisig.rpc.transactionCreate({
            connection,
            feePayer: members.voter,
            multisigPda,
            transactionIndex,
            creator: members.voter.publicKey,
            authorityIndex: 1,
            transactionMessage: testTransferMessage,
          }),
        /Attempted to perform an unauthorized action/
      );
    });

    it("create a new transaction", async () => {
      const [multisigPda] = multisig.getMultisigPda({
        createKey: autonomousMultisigCreateKey,
      });
      let multisigAccount = await Multisig.fromAccountAddress(
        connection,
        multisigPda
      );

      // Vault, index 1.
      const [vaultPda, vaultBump] = multisig.getAuthorityPda({
        multisigPda,
        index: 1,
      });

      // Airdrop 2 SOL to the Vault, we'll need it for the test transfer instructions.
      const airdropSig = await connection.requestAirdrop(
        vaultPda,
        2 * LAMPORTS_PER_SOL
      );
      await connection.confirmTransaction(airdropSig);

      // Test transfer instruction (2x)
      const testPayee = Keypair.generate();
      const testIx1 = await createTestTransferInstruction(
        vaultPda,
        testPayee.publicKey,
        1 * LAMPORTS_PER_SOL
      );
      const testIx2 = await createTestTransferInstruction(
        vaultPda,
        testPayee.publicKey,
        1 * LAMPORTS_PER_SOL
      );
      const testTransferMessage = new TransactionMessage({
        payerKey: vaultPda,
        recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
        instructions: [testIx1, testIx2],
      });

      const transactionIndex =
        multisig.utils.toBigInt(multisigAccount.transactionIndex) + 1n;

      const signature = await multisig.rpc.transactionCreate({
        connection,
        feePayer: members.proposer,
        multisigPda,
        transactionIndex,
        creator: members.proposer.publicKey,
        authorityIndex: 1,
        transactionMessage: testTransferMessage,
        memo: "Transfer 2 SOL to a test account",
      });
      await connection.confirmTransaction(signature);

      multisigAccount = await Multisig.fromAccountAddress(
        connection,
        multisigPda
      );
      assert.strictEqual(
        multisigAccount.transactionIndex.toString(),
        transactionIndex.toString()
      );

      const [transactionPda, transactionBump] = multisig.getTransactionPda({
        multisigPda,
        index: transactionIndex,
      });
      const transactionAccount = await MultisigTransaction.fromAccountAddress(
        connection,
        transactionPda
      );
      assert.strictEqual(
        transactionAccount.creator.toBase58(),
        members.proposer.publicKey.toBase58()
      );
      assert.strictEqual(
        transactionAccount.multisig.toBase58(),
        multisigPda.toBase58()
      );
      assert.strictEqual(
        transactionAccount.transactionIndex.toString(),
        transactionIndex.toString()
      );
      assert.strictEqual(transactionAccount.authorityBump, vaultBump);
      assert.strictEqual(transactionAccount.bump, transactionBump);
      assert.strictEqual(transactionAccount.status, TransactionStatus.Active);
      assert.deepEqual(transactionAccount.approved, []);
      assert.deepEqual(transactionAccount.rejected, []);
      assert.deepEqual(transactionAccount.cancelled, []);
      // TODO: verify the transaction message data.
      assert.ok(transactionAccount.message);
    });
  });

  describe("transaction_approve", () => {
    it("error: not a member", async () => {
      const nonMember = await generateFundedKeypair(connection);

      const [multisigPda] = multisig.getMultisigPda({
        createKey: autonomousMultisigCreateKey,
      });
      let multisigAccount = await Multisig.fromAccountAddress(
        connection,
        multisigPda
      );

      // Approve the last transaction.
      const transactionIndex = multisig.utils.toBigInt(
        multisigAccount.transactionIndex
      );

      await assert.rejects(
        () =>
          multisig.rpc.transactionApprove({
            connection,
            feePayer: nonMember,
            multisigPda,
            transactionIndex,
            member: nonMember.publicKey,
          }),
        /Provided pubkey is not a member of multisig/
      );
    });

    it("error: unauthorized", async () => {
      const [multisigPda] = multisig.getMultisigPda({
        createKey: autonomousMultisigCreateKey,
      });
      let multisigAccount = await Multisig.fromAccountAddress(
        connection,
        multisigPda
      );

      // Approve the last transaction.
      const transactionIndex = multisig.utils.toBigInt(
        multisigAccount.transactionIndex
      );

      await assert.rejects(
        () =>
          multisig.rpc.transactionApprove({
            connection,
            feePayer: members.executor,
            multisigPda,
            transactionIndex,
            member: members.executor.publicKey,
          }),
        /Attempted to perform an unauthorized action/
      );
    });

    it("approve transaction", async () => {
      const [multisigPda] = multisig.getMultisigPda({
        createKey: autonomousMultisigCreateKey,
      });
      let multisigAccount = await Multisig.fromAccountAddress(
        connection,
        multisigPda
      );

      // Approve the last transaction.
      const transactionIndex = multisig.utils.toBigInt(
        multisigAccount.transactionIndex
      );

      const signature = await multisig.rpc.transactionApprove({
        connection,
        feePayer: members.voter,
        multisigPda,
        transactionIndex,
        member: members.voter.publicKey,
        memo: "LGTM",
      });
      await connection.confirmTransaction(signature);

      // Verify the transaction account.
      const [transactionPda] = multisig.getTransactionPda({
        multisigPda,
        index: transactionIndex,
      });
      const transactionAccount = await MultisigTransaction.fromAccountAddress(
        connection,
        transactionPda
      );
      assert.deepEqual(transactionAccount.approved, [members.voter.publicKey]);
      assert.deepEqual(transactionAccount.rejected, []);
      assert.deepEqual(transactionAccount.cancelled, []);
      // Our threshold is 2, so the transaction is not yet ExecutionReady.
      assert.strictEqual(transactionAccount.status, TransactionStatus.Active);
    });

    it("error: already approved", async () => {
      const [multisigPda] = multisig.getMultisigPda({
        createKey: autonomousMultisigCreateKey,
      });
      let multisigAccount = await Multisig.fromAccountAddress(
        connection,
        multisigPda
      );

      // Approve the last transaction.
      const transactionIndex = multisig.utils.toBigInt(
        multisigAccount.transactionIndex
      );

      await assert.rejects(
        () =>
          multisig.rpc.transactionApprove({
            connection,
            feePayer: members.voter,
            multisigPda,
            transactionIndex,
            member: members.voter.publicKey,
          }),
        /Member already approved the transaction/
      );
    });

    it("approve transaction and reach threshold", async () => {
      const [multisigPda] = multisig.getMultisigPda({
        createKey: autonomousMultisigCreateKey,
      });
      let multisigAccount = await Multisig.fromAccountAddress(
        connection,
        multisigPda
      );

      // Approve the last transaction.
      const transactionIndex = multisig.utils.toBigInt(
        multisigAccount.transactionIndex
      );

      const signature = await multisig.rpc.transactionApprove({
        connection,
        feePayer: members.almighty,
        multisigPda,
        transactionIndex,
        member: members.almighty.publicKey,
        memo: "LGTM",
        signers: [members.almighty],
      });
      await connection.confirmTransaction(signature);

      // Verify the transaction account.
      const [transactionPda] = multisig.getTransactionPda({
        multisigPda,
        index: transactionIndex,
      });
      const transactionAccount = await MultisigTransaction.fromAccountAddress(
        connection,
        transactionPda
      );
      assert.deepEqual(
        transactionAccount.approved.map((key) => key.toBase58()),
        [members.voter.publicKey, members.almighty.publicKey]
          .sort(comparePubkeys)
          .map((key) => key.toBase58())
      );
      assert.deepEqual(transactionAccount.rejected, []);
      assert.deepEqual(transactionAccount.cancelled, []);
      // We reached the threshold, so the transaction is ExecutionReady now.
      assert.strictEqual(
        transactionAccount.status,
        TransactionStatus.ExecuteReady
      );
    });

    it("error: stale transaction");

    it("error: invalid transaction status");

    it("error: transaction is not for multisig");
  });

  describe("transaction_execute", () => {
    it("execute a transaction", async () => {
      const [multisigPda] = multisig.getMultisigPda({
        createKey: autonomousMultisigCreateKey,
      });
      let multisigAccount = await Multisig.fromAccountAddress(
        connection,
        multisigPda
      );

      // Execute the last transaction.
      const transactionIndex = multisig.utils.toBigInt(
        multisigAccount.transactionIndex
      );

      const [transactionPda] = multisig.getTransactionPda({
        multisigPda,
        index: transactionIndex,
      });
      let transactionAccount = await MultisigTransaction.fromAccountAddress(
        connection,
        transactionPda
      );

      const [vaultPda] = multisig.getAuthorityPda({
        multisigPda,
        index: transactionAccount.authorityIndex,
      });
      const preVaultBalance = await connection.getBalance(vaultPda);
      assert.strictEqual(preVaultBalance, 2 * LAMPORTS_PER_SOL);

      const signature = await multisig.rpc.transactionExecute({
        connection,
        feePayer: members.executor,
        multisigPda,
        transactionIndex,
        member: members.executor.publicKey,
        signers: [members.executor],
      });
      await connection.confirmTransaction(signature);

      // Verify the transaction account.
      transactionAccount = await MultisigTransaction.fromAccountAddress(
        connection,
        transactionPda
      );
      assert.strictEqual(transactionAccount.status, TransactionStatus.Executed);

      const postVaultBalance = await connection.getBalance(vaultPda);
      // Transferred 2 SOL to payee.
      assert.strictEqual(postVaultBalance, 0);
    });

    it("error: not a member");

    it("error: unauthorized");

    it("error: invalid transaction status");

    it("error: transaction is not for multisig");
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

async function createTestTransferInstruction(
  authority: PublicKey,
  recipient: PublicKey,
  amount = 1000000
) {
  return SystemProgram.transfer({
    fromPubkey: authority,
    lamports: amount,
    toPubkey: recipient,
  });
}

function comparePubkeys(a: PublicKey, b: PublicKey) {
  return a.toBuffer().compare(b.toBuffer());
}
