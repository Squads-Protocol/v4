import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  TransactionMessage,
  VersionedTransaction,
  AddressLookupTableProgram,
  AddressLookupTableAccount,
} from "@solana/web3.js";
import * as multisig from "@sqds/multisig";
import * as assert from "assert";
import {
  createInitializeMint2Instruction,
  getMinimumBalanceForRentExemptMint,
  getMint,
  MINT_SIZE,
  TOKEN_2022_PROGRAM_ID,
} from "@solana/spl-token";

const { toBigInt } = multisig.utils;
const { Multisig, VaultTransaction, ConfigTransaction, Proposal, Batch } =
  multisig.accounts;
const { Permission, Permissions } = multisig.types;

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
  let autonomousMultisigCreateKey: Keypair;
  let controlledMultisigCreateKey: Keypair;
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

      const createKey = Keypair.generate();
      const [multisigPda] = multisig.getMultisigPda({
        createKey: createKey.publicKey,
      });
      const [configAuthority] = multisig.getVaultPda({
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
          }),
        /Found multiple members with the same pubkey/
      );
    });
    it("error: missing signature from `createKey`", async () => {
      const creator = await generateFundedKeypair(connection);

      const createKey = Keypair.generate();
      const [multisigPda] = multisig.getMultisigPda({
        createKey: createKey.publicKey,
      });
      const [configAuthority] = multisig.getVaultPda({
        multisigPda,
        index: 0,
      });

      const tx = multisig.transactions.multisigCreate({
        blockhash: (await connection.getLatestBlockhash()).blockhash,
        createKey: createKey.publicKey,
        creator: creator.publicKey,
        multisigPda,
        configAuthority,
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
      });
      const [configAuthority] = multisig.getVaultPda({
        multisigPda,
        index: 0,
      });

      await assert.rejects(
        () =>
          multisig.rpc.multisigCreate({
            connection,
            createKey,
            creator,
            multisigPda,
            configAuthority,
            timeLock: 0,
            threshold: 1,
            members: [],
            sendOptions: { skipPreflight: true },
          }),
        /Members don't include any voters/
      );
    });

    // We cannot really test it because we can't pass u16::MAX members to the instruction.
    it("error: too many members");

    it("error: invalid threshold (< 1)", async () => {
      const creator = await generateFundedKeypair(connection);

      const createKey = Keypair.generate();
      const [multisigPda] = multisig.getMultisigPda({
        createKey: createKey.publicKey,
      });
      const [configAuthority] = multisig.getVaultPda({
        multisigPda,
        index: 0,
      });

      await assert.rejects(
        () =>
          multisig.rpc.multisigCreate({
            connection,
            createKey,
            creator,
            multisigPda,
            configAuthority,
            timeLock: 0,
            threshold: 0,
            members: Object.values(members).map((m) => ({
              key: m.publicKey,
              permissions: Permissions.all(),
            })),
            sendOptions: { skipPreflight: true },
          }),
        /Invalid threshold, must be between 1 and number of members/
      );
    });

    it("error: invalid threshold (> members with permission to Vote)", async () => {
      const creator = await generateFundedKeypair(connection);

      const createKey = Keypair.generate();
      const [multisigPda] = multisig.getMultisigPda({
        createKey: createKey.publicKey,
      });
      const [configAuthority] = multisig.getVaultPda({
        multisigPda,
        index: 0,
      });

      await assert.rejects(
        () =>
          multisig.rpc.multisigCreate({
            connection,
            createKey,
            creator,
            multisigPda,
            configAuthority,
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
          }),
        /Invalid threshold, must be between 1 and number of members with Vote permission/
      );
    });

    it("create a new autonomous multisig", async () => {
      const creator = await generateFundedKeypair(connection);

      autonomousMultisigCreateKey = Keypair.generate();

      const [multisigPda, multisigBump] = multisig.getMultisigPda({
        createKey: autonomousMultisigCreateKey.publicKey,
      });

      const signature = await multisig.rpc.multisigCreate({
        connection,
        creator,
        multisigPda,
        configAuthority: null,
        timeLock: 0,
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
        sendOptions: { skipPreflight: true },
      });

      await connection.confirmTransaction(signature);

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
      assert.strictEqual(multisigAccount.reserved, 0);
      assert.strictEqual(multisigAccount.transactionIndex.toString(), "0");
      assert.strictEqual(multisigAccount.staleTransactionIndex.toString(), "0");
      assert.strictEqual(
        multisigAccount.createKey.toBase58(),
        autonomousMultisigCreateKey.publicKey.toBase58()
      );
      assert.strictEqual(multisigAccount.bump, multisigBump);
    });

    it("create a new controlled multisig", async () => {
      const creator = await generateFundedKeypair(connection);

      controlledMultisigCreateKey = Keypair.generate();
      controlledMultisigConfigAuthority = await generateFundedKeypair(
        connection
      );

      const [multisigPda] = multisig.getMultisigPda({
        createKey: controlledMultisigCreateKey.publicKey,
      });

      const signature = await multisig.rpc.multisigCreate({
        connection,
        createKey: controlledMultisigCreateKey,
        creator,
        multisigPda,
        configAuthority: controlledMultisigConfigAuthority.publicKey,
        threshold: 2,
        timeLock: 0,
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
        createKey: controlledMultisigCreateKey.publicKey,
      });

      // Adding the same member again should fail.
      await assert.rejects(
        multisig.rpc.multisigAddMember({
          connection,
          feePayer,
          multisigPda,
          configAuthority: controlledMultisigConfigAuthority.publicKey,
          rentPayer: controlledMultisigConfigAuthority,
          newMember: {
            key: members.almighty.publicKey,
            permissions: Permissions.all(),
          },
          signers: [controlledMultisigConfigAuthority],
          sendOptions: { skipPreflight: true },
        }),
        /Found multiple members with the same pubkey/
      );
    });

    it("error: missing authority signature", async () => {
      const feePayer = await generateFundedKeypair(connection);
      const [multisigPda] = multisig.getMultisigPda({
        createKey: controlledMultisigCreateKey.publicKey,
      });

      await assert.rejects(
        multisig.rpc.multisigAddMember({
          connection,
          feePayer,
          multisigPda,
          configAuthority: controlledMultisigConfigAuthority.publicKey,
          rentPayer: feePayer,
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
        createKey: controlledMultisigCreateKey.publicKey,
      });

      await assert.rejects(
        multisig.rpc.multisigAddMember({
          connection,
          feePayer: fakeAuthority,
          multisigPda,
          configAuthority: fakeAuthority.publicKey,
          rentPayer: fakeAuthority,
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
        createKey: controlledMultisigCreateKey.publicKey,
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
        rentPayer: controlledMultisigConfigAuthority,
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
        rentPayer: controlledMultisigConfigAuthority,
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

  describe("multisig_set_time_lock", () => {
    it("error: invalid authority");

    it("set `time_lock` on a controlled multisig");
  });

  describe("multisig_set_config_authority", () => {
    it("error: invalid authority");

    it("set `config_authority` on a controlled multisig");
  });

  describe("config_transaction_create", () => {
    it("error: not supported for controlled multisig", async () => {
      const [multisigPda] = multisig.getMultisigPda({
        createKey: controlledMultisigCreateKey.publicKey,
      });
      let multisigAccount = await Multisig.fromAccountAddress(
        connection,
        multisigPda
      );
      const transactionIndex = toBigInt(multisigAccount.transactionIndex) + 1n;

      await assert.rejects(
        () =>
          multisig.rpc.configTransactionCreate({
            connection,
            feePayer: members.proposer,
            multisigPda,
            transactionIndex,
            creator: members.proposer.publicKey,
            actions: [{ __kind: "ChangeThreshold", newThreshold: 3 }],
          }),
        /Instruction not supported for controlled multisig/
      );
    });

    it("error: empty actions", async () => {
      const [multisigPda] = multisig.getMultisigPda({
        createKey: autonomousMultisigCreateKey.publicKey,
      });
      let multisigAccount = await Multisig.fromAccountAddress(
        connection,
        multisigPda
      );
      const transactionIndex =
        multisig.utils.toBigInt(multisigAccount.transactionIndex) + 1n;

      await assert.rejects(
        () =>
          multisig.rpc.configTransactionCreate({
            connection,
            feePayer: members.proposer,
            multisigPda,
            transactionIndex,
            creator: members.proposer.publicKey,
            actions: [],
          }),
        /Config transaction must have at least one action/
      );
    });

    it("error: not a member", async () => {
      const nonMember = await generateFundedKeypair(connection);

      const [multisigPda] = multisig.getMultisigPda({
        createKey: autonomousMultisigCreateKey.publicKey,
      });
      let multisigAccount = await Multisig.fromAccountAddress(
        connection,
        multisigPda
      );
      const transactionIndex =
        multisig.utils.toBigInt(multisigAccount.transactionIndex) + 1n;

      await assert.rejects(
        () =>
          multisig.rpc.configTransactionCreate({
            connection,
            feePayer: nonMember,
            multisigPda,
            transactionIndex,
            creator: nonMember.publicKey,
            actions: [{ __kind: "ChangeThreshold", newThreshold: 3 }],
          }),
        /Provided pubkey is not a member of multisig/
      );
    });

    it("error: unauthorized", async () => {
      const [multisigPda] = multisig.getMultisigPda({
        createKey: autonomousMultisigCreateKey.publicKey,
      });
      let multisigAccount = await Multisig.fromAccountAddress(
        connection,
        multisigPda
      );
      const transactionIndex =
        multisig.utils.toBigInt(multisigAccount.transactionIndex) + 1n;

      await assert.rejects(
        () =>
          multisig.rpc.configTransactionCreate({
            connection,
            feePayer: members.voter,
            multisigPda,
            transactionIndex,
            // Voter is not authorized to initialize config transactions.
            creator: members.voter.publicKey,
            actions: [{ __kind: "ChangeThreshold", newThreshold: 3 }],
          }),
        /Attempted to perform an unauthorized action/
      );
    });

    it("create a new config transaction", async () => {
      const [multisigPda] = multisig.getMultisigPda({
        createKey: autonomousMultisigCreateKey.publicKey,
      });
      let multisigAccount = await Multisig.fromAccountAddress(
        connection,
        multisigPda
      );
      const transactionIndex =
        multisig.utils.toBigInt(multisigAccount.transactionIndex) + 1n;

      const signature = await multisig.rpc.configTransactionCreate({
        connection,
        feePayer: members.proposer,
        multisigPda,
        transactionIndex,
        creator: members.proposer.publicKey,
        actions: [{ __kind: "ChangeThreshold", newThreshold: 1 }],
      });
      await connection.confirmTransaction(signature);

      // Re-fetch the multisig account.
      multisigAccount = await Multisig.fromAccountAddress(
        connection,
        multisigPda
      );
      const lastTransactionIndex = multisig.utils.toBigInt(
        multisigAccount.transactionIndex
      );
      assert.strictEqual(lastTransactionIndex, transactionIndex);

      // Fetch the newly created ConfigTransaction account.
      const [transactionPda, transactionBump] = multisig.getTransactionPda({
        multisigPda,
        index: transactionIndex,
      });
      const configTransactionAccount =
        await ConfigTransaction.fromAccountAddress(connection, transactionPda);

      // Assertions.
      assert.strictEqual(
        configTransactionAccount.multisig.toBase58(),
        multisigPda.toBase58()
      );
      assert.strictEqual(
        configTransactionAccount.creator.toBase58(),
        members.proposer.publicKey.toBase58()
      );
      assert.strictEqual(
        configTransactionAccount.index.toString(),
        transactionIndex.toString()
      );
      assert.strictEqual(configTransactionAccount.bump, transactionBump);
      assert.deepEqual(configTransactionAccount.actions, [
        {
          __kind: "ChangeThreshold",
          newThreshold: 1,
        },
      ]);
    });

    it("create second config transaction", async () => {
      const newMember = {
        key: Keypair.generate().publicKey,
        permissions: Permissions.all(),
      } as const;

      const [multisigPda] = multisig.getMultisigPda({
        createKey: autonomousMultisigCreateKey.publicKey,
      });
      let multisigAccount = await Multisig.fromAccountAddress(
        connection,
        multisigPda
      );
      const transactionIndex =
        multisig.utils.toBigInt(multisigAccount.transactionIndex) + 1n;

      const signature = await multisig.rpc.configTransactionCreate({
        connection,
        feePayer: members.proposer,
        multisigPda,
        transactionIndex,
        creator: members.proposer.publicKey,
        actions: [{ __kind: "AddMember", newMember }],
      });
      await connection.confirmTransaction(signature);

      // Fetch the newly created ConfigTransaction account.
      const [transactionPda] = multisig.getTransactionPda({
        multisigPda,
        index: transactionIndex,
      });
      const configTransactionAccount =
        await ConfigTransaction.fromAccountAddress(connection, transactionPda);

      // Make sure the transaction was created correctly.
      assert.strictEqual(
        configTransactionAccount.index.toString(),
        transactionIndex.toString()
      );
    });

    it("create third config transaction", async () => {
      const [multisigPda] = multisig.getMultisigPda({
        createKey: autonomousMultisigCreateKey.publicKey,
      });
      let multisigAccount = await Multisig.fromAccountAddress(
        connection,
        multisigPda
      );
      const transactionIndex =
        multisig.utils.toBigInt(multisigAccount.transactionIndex) + 1n;

      const signature = await multisig.rpc.configTransactionCreate({
        connection,
        feePayer: members.proposer,
        multisigPda,
        transactionIndex,
        creator: members.proposer.publicKey,
        actions: [
          { __kind: "RemoveMember", oldMember: members.almighty.publicKey },
        ],
      });
      await connection.confirmTransaction(signature);

      // Fetch the newly created ConfigTransaction account.
      const [transactionPda] = multisig.getTransactionPda({
        multisigPda,
        index: transactionIndex,
      });
      const configTransactionAccount =
        await ConfigTransaction.fromAccountAddress(connection, transactionPda);

      // Make sure the transaction was created correctly.
      assert.strictEqual(
        configTransactionAccount.index.toString(),
        transactionIndex.toString()
      );
    });
  });

  describe("vault_transaction_create", () => {
    it("error: not a member", async () => {
      const nonMember = await generateFundedKeypair(connection);

      const [multisigPda] = multisig.getMultisigPda({
        createKey: autonomousMultisigCreateKey.publicKey,
      });
      let multisigAccount = await Multisig.fromAccountAddress(
        connection,
        multisigPda
      );

      const transactionIndex =
        multisig.utils.toBigInt(multisigAccount.transactionIndex) + 1n;

      // Vault, index 0.
      const [vaultPda] = multisig.getVaultPda({
        multisigPda,
        index: 0,
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

      await assert.rejects(
        () =>
          multisig.rpc.vaultTransactionCreate({
            connection,
            feePayer: nonMember,
            multisigPda,
            transactionIndex,
            creator: nonMember.publicKey,
            vaultIndex: 0,
            ephemeralSigners: 0,
            transactionMessage: testTransferMessage,
          }),
        /Provided pubkey is not a member of multisig/
      );
    });

    it("error: unauthorized", async () => {
      const [multisigPda] = multisig.getMultisigPda({
        createKey: autonomousMultisigCreateKey.publicKey,
      });
      let multisigAccount = await Multisig.fromAccountAddress(
        connection,
        multisigPda
      );

      // Vault, index 0.
      const [vaultPda] = multisig.getVaultPda({
        multisigPda,
        index: 0,
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
          multisig.rpc.vaultTransactionCreate({
            connection,
            feePayer: members.voter,
            multisigPda,
            transactionIndex,
            creator: members.voter.publicKey,
            vaultIndex: 0,
            ephemeralSigners: 0,
            transactionMessage: testTransferMessage,
          }),
        /Attempted to perform an unauthorized action/
      );
    });

    it("create a new vault transaction", async () => {
      const [multisigPda] = multisig.getMultisigPda({
        createKey: autonomousMultisigCreateKey.publicKey,
      });
      let multisigAccount = await Multisig.fromAccountAddress(
        connection,
        multisigPda
      );

      const transactionIndex =
        multisig.utils.toBigInt(multisigAccount.transactionIndex) + 1n;

      // Vault, index 0.
      const [vaultPda, vaultBump] = multisig.getVaultPda({
        multisigPda,
        index: 0,
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

      const signature = await multisig.rpc.vaultTransactionCreate({
        connection,
        feePayer: members.proposer,
        multisigPda,
        transactionIndex,
        creator: members.proposer.publicKey,
        vaultIndex: 0,
        ephemeralSigners: 0,
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
      const transactionAccount = await VaultTransaction.fromAccountAddress(
        connection,
        transactionPda
      );
      assert.strictEqual(
        transactionAccount.multisig.toBase58(),
        multisigPda.toBase58()
      );
      assert.strictEqual(
        transactionAccount.creator.toBase58(),
        members.proposer.publicKey.toBase58()
      );
      assert.strictEqual(
        transactionAccount.index.toString(),
        transactionIndex.toString()
      );
      assert.strictEqual(transactionAccount.vaultBump, vaultBump);
      assert.deepEqual(
        transactionAccount.ephemeralSignerBumps,
        new Uint8Array()
      );
      assert.strictEqual(transactionAccount.bump, transactionBump);
      // TODO: verify the transaction message data.
      assert.ok(transactionAccount.message);
    });

    // We will use this tx in tests for `transaction_reject`.
    it("create second vault transaction", async () => {
      const [multisigPda] = multisig.getMultisigPda({
        createKey: autonomousMultisigCreateKey.publicKey,
      });
      let multisigAccount = await Multisig.fromAccountAddress(
        connection,
        multisigPda
      );

      const transactionIndex =
        multisig.utils.toBigInt(multisigAccount.transactionIndex) + 1n;

      // Vault, index 0.
      const [vaultPda] = multisig.getVaultPda({
        multisigPda,
        index: 0,
      });

      // Test transfer instruction.
      const testPayee = Keypair.generate();
      const testIx1 = await createTestTransferInstruction(
        vaultPda,
        testPayee.publicKey,
        1 * LAMPORTS_PER_SOL
      );
      const testTransferMessage = new TransactionMessage({
        payerKey: vaultPda,
        recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
        instructions: [testIx1],
      });

      const signature = await multisig.rpc.vaultTransactionCreate({
        connection,
        feePayer: members.proposer,
        multisigPda,
        transactionIndex,
        creator: members.proposer.publicKey,
        vaultIndex: 0,
        ephemeralSigners: 0,
        transactionMessage: testTransferMessage,
        memo: "Transfer 1 SOL to a test account",
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
    });

    // We will use this tx in tests for `transaction_cancel`.
    it("create third vault transaction", async () => {
      const [multisigPda] = multisig.getMultisigPda({
        createKey: autonomousMultisigCreateKey.publicKey,
      });
      let multisigAccount = await Multisig.fromAccountAddress(
        connection,
        multisigPda
      );

      const transactionIndex =
        multisig.utils.toBigInt(multisigAccount.transactionIndex) + 1n;
      assert.strictEqual(transactionIndex.toString(), "6");

      // Vault, index 0.
      const [vaultPda] = multisig.getVaultPda({
        multisigPda,
        index: 0,
      });

      // Test transfer instruction.
      const testPayee = Keypair.generate();
      const testIx = await createTestTransferInstruction(
        vaultPda,
        testPayee.publicKey,
        1 * LAMPORTS_PER_SOL
      );
      const testTransferMessage = new TransactionMessage({
        payerKey: vaultPda,
        recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
        instructions: [testIx],
      });

      const signature = await multisig.rpc.vaultTransactionCreate({
        connection,
        feePayer: members.proposer,
        multisigPda,
        transactionIndex,
        creator: members.proposer.publicKey,
        vaultIndex: 0,
        ephemeralSigners: 0,
        transactionMessage: testTransferMessage,
        memo: "Transfer 1 SOL to a test account",
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
    });
  });

  describe("proposal_create", () => {
    it("error: invalid transaction index", async () => {
      const rentPayer = await generateFundedKeypair(connection);

      const [multisigPda] = multisig.getMultisigPda({
        createKey: autonomousMultisigCreateKey.publicKey,
      });

      // Attempt to create a proposal for a transaction that doesn't exist.
      const transactionIndex = 7n;

      await assert.rejects(
        () =>
          multisig.rpc.proposalCreate({
            connection,
            feePayer: rentPayer,
            multisigPda,
            transactionIndex,
            rentPayer,
          }),
        /Invalid transaction index/
      );
    });

    it("anyone can create proposals for transactions", async () => {
      const rentPayer = await generateFundedKeypair(connection);

      const [multisigPda] = multisig.getMultisigPda({
        createKey: autonomousMultisigCreateKey.publicKey,
      });

      // The first config transaction.
      const transactionIndex = 1n;

      const signature = await multisig.rpc.proposalCreate({
        connection,
        feePayer: rentPayer,
        multisigPda,
        transactionIndex,
        rentPayer,
      });
      await connection.confirmTransaction(signature);

      // Fetch the newly created Proposal account.
      const [proposalPda, proposalBump] = multisig.getProposalPda({
        multisigPda,
        transactionIndex,
      });
      const proposalAccount = await Proposal.fromAccountAddress(
        connection,
        proposalPda
      );

      // Make sure the proposal was created correctly.
      assert.strictEqual(
        proposalAccount.multisig.toBase58(),
        multisigPda.toBase58()
      );
      assert.strictEqual(
        proposalAccount.transactionIndex.toString(),
        transactionIndex.toString()
      );
      assert.ok(multisig.types.isProposalStatusActive(proposalAccount.status));
      assert.ok(isCloseToNow(toBigInt(proposalAccount.status.timestamp)));
      assert.strictEqual(proposalAccount.bump, proposalBump);
      assert.deepEqual(proposalAccount.approved, []);
      assert.deepEqual(proposalAccount.rejected, []);
      assert.deepEqual(proposalAccount.cancelled, []);

      // Also create proposals for the rest of the config transactions.

      const transactionIndex2 = 2n;
      const signature2 = await multisig.rpc.proposalCreate({
        connection,
        feePayer: rentPayer,
        multisigPda,
        transactionIndex: transactionIndex2,
        rentPayer,
      });
      await connection.confirmTransaction(signature2);
      const [proposalPda2] = multisig.getProposalPda({
        multisigPda,
        transactionIndex: transactionIndex2,
      });
      const proposalAccount2 = await Proposal.fromAccountAddress(
        connection,
        proposalPda2
      );
      assert.strictEqual(
        proposalAccount2.transactionIndex.toString(),
        transactionIndex2.toString()
      );

      const transactionIndex3 = 3n;
      const signature3 = await multisig.rpc.proposalCreate({
        connection,
        feePayer: rentPayer,
        multisigPda,
        transactionIndex: transactionIndex3,
        rentPayer,
      });
      await connection.confirmTransaction(signature3);
      const [proposalPda3] = multisig.getProposalPda({
        multisigPda,
        transactionIndex: transactionIndex3,
      });
      const proposalAccount3 = await Proposal.fromAccountAddress(
        connection,
        proposalPda3
      );
      assert.strictEqual(
        proposalAccount3.transactionIndex.toString(),
        transactionIndex3.toString()
      );
    });
  });

  describe("proposal_approve", () => {
    it("error: not a member", async () => {
      const nonMember = await generateFundedKeypair(connection);

      const [multisigPda] = multisig.getMultisigPda({
        createKey: autonomousMultisigCreateKey.publicKey,
      });

      // Approve the proposal for the first config transaction.
      const transactionIndex = 1n;

      await assert.rejects(
        () =>
          multisig.rpc.proposalApprove({
            connection,
            feePayer: nonMember,
            multisigPda,
            transactionIndex,
            member: nonMember,
          }),
        /Provided pubkey is not a member of multisig/
      );
    });

    it("error: unauthorized", async () => {
      const [multisigPda] = multisig.getMultisigPda({
        createKey: autonomousMultisigCreateKey.publicKey,
      });

      // Approve the proposal for the first config transaction.
      const transactionIndex = 1n;

      await assert.rejects(
        () =>
          multisig.rpc.proposalApprove({
            connection,
            feePayer: members.executor,
            multisigPda,
            transactionIndex,
            // Executor is not authorized to approve config transactions.
            member: members.executor,
          }),
        /Attempted to perform an unauthorized action/
      );
    });

    it("approve config transaction", async () => {
      const [multisigPda] = multisig.getMultisigPda({
        createKey: autonomousMultisigCreateKey.publicKey,
      });

      // Approve the proposal for the first config transaction.
      const transactionIndex = 1n;

      const signature = await multisig.rpc.proposalApprove({
        connection,
        feePayer: members.voter,
        multisigPda,
        transactionIndex,
        member: members.voter,
      });
      await connection.confirmTransaction(signature);

      // Fetch the Proposal account.
      const [proposalPda] = multisig.getProposalPda({
        multisigPda,
        transactionIndex,
      });
      const proposalAccount = await Proposal.fromAccountAddress(
        connection,
        proposalPda
      );

      // Assertions.
      assert.deepEqual(proposalAccount.approved, [members.voter.publicKey]);
      assert.deepEqual(proposalAccount.rejected, []);
      assert.deepEqual(proposalAccount.cancelled, []);
      // Our threshold is 2, so the proposal is not yet Approved.
      assert.ok(multisig.types.isProposalStatusActive(proposalAccount.status));
    });

    it("error: already approved", async () => {
      const [multisigPda] = multisig.getMultisigPda({
        createKey: autonomousMultisigCreateKey.publicKey,
      });

      // Approve the proposal for the first config transaction once again.
      const transactionIndex = 1n;

      await assert.rejects(
        () =>
          multisig.rpc.proposalApprove({
            connection,
            feePayer: members.voter,
            multisigPda,
            transactionIndex,
            member: members.voter,
          }),
        /Member already approved the transaction/
      );
    });

    it("approve config transaction and reach threshold", async () => {
      const [multisigPda] = multisig.getMultisigPda({
        createKey: autonomousMultisigCreateKey.publicKey,
      });

      // Approve the proposal for the first config transaction.
      const transactionIndex = 1n;

      const signature = await multisig.rpc.proposalApprove({
        connection,
        feePayer: members.almighty,
        multisigPda,
        transactionIndex,
        member: members.almighty,
      });
      await connection.confirmTransaction(signature);

      // Fetch the Proposal account.
      const [proposalPda] = multisig.getProposalPda({
        multisigPda,
        transactionIndex,
      });
      const proposalAccount = await Proposal.fromAccountAddress(
        connection,
        proposalPda
      );

      // Assertions.
      assert.deepEqual(
        proposalAccount.approved.map((key) => key.toBase58()),
        [members.voter.publicKey, members.almighty.publicKey]
          .sort(comparePubkeys)
          .map((key) => key.toBase58())
      );
      assert.deepEqual(proposalAccount.rejected, []);
      assert.deepEqual(proposalAccount.cancelled, []);
      // Our threshold is 2, so the transaction is now Approved.
      assert.ok(
        multisig.types.isProposalStatusApproved(proposalAccount.status)
      );
    });

    it("error: stale transaction");

    it("error: invalid transaction status");

    it("error: proposal is not for multisig");
  });

  describe("proposal_reject", () => {
    it("error: try to reject an approved proposal", async () => {
      const [multisigPda] = multisig.getMultisigPda({
        createKey: autonomousMultisigCreateKey.publicKey,
      });

      // Reject the proposal for the first config transaction.
      const transactionIndex = 1n;

      await assert.rejects(
        () =>
          multisig.rpc.proposalReject({
            connection,
            feePayer: members.voter,
            multisigPda,
            transactionIndex,
            member: members.voter,
          }),
        /Invalid proposal status/
      );
    });

    it("error: not a member", async () => {
      const nonMember = await generateFundedKeypair(connection);

      const [multisigPda] = multisig.getMultisigPda({
        createKey: autonomousMultisigCreateKey.publicKey,
      });

      // Reject the proposal for the second config transaction.
      const transactionIndex = 2n;

      await assert.rejects(
        () =>
          multisig.rpc.proposalReject({
            connection,
            feePayer: nonMember,
            multisigPda,
            transactionIndex,
            member: nonMember,
          }),
        /Provided pubkey is not a member of multisig/
      );
    });

    it("error: unauthorized", async () => {
      const [multisigPda] = multisig.getMultisigPda({
        createKey: autonomousMultisigCreateKey.publicKey,
      });

      // Reject the proposal for the second config transaction.
      const transactionIndex = 2n;

      await assert.rejects(
        () =>
          multisig.rpc.proposalReject({
            connection,
            feePayer: members.executor,
            multisigPda,
            transactionIndex,
            member: members.executor,
          }),
        /Attempted to perform an unauthorized action/
      );
    });

    it("reject proposal and reach cutoff", async () => {
      const [multisigPda] = multisig.getMultisigPda({
        createKey: autonomousMultisigCreateKey.publicKey,
      });
      let multisigAccount = await Multisig.fromAccountAddress(
        connection,
        multisigPda
      );

      // Reject the proposal for the second config transaction.
      const transactionIndex = 2n;

      const signature = await multisig.rpc.proposalReject({
        connection,
        feePayer: members.voter,
        multisigPda,
        transactionIndex,
        member: members.voter,
        memo: "LGTM",
      });
      await connection.confirmTransaction(signature);

      // Fetch the Proposal account.
      const [proposalPda] = multisig.getProposalPda({
        multisigPda,
        transactionIndex,
      });
      const proposalAccount = await Proposal.fromAccountAddress(
        connection,
        proposalPda
      );
      assert.deepEqual(proposalAccount.approved, []);
      assert.deepEqual(proposalAccount.rejected, [members.voter.publicKey]);
      assert.deepEqual(proposalAccount.cancelled, []);
      // Our threshold is 2, and 2 voters, so the cutoff is 1...
      assert.strictEqual(multisigAccount.threshold, 2);
      assert.strictEqual(
        multisigAccount.members.filter((m) =>
          Permissions.has(m.permissions, Permission.Vote)
        ).length,
        2
      );
      // ...thus we've reached the cutoff, and the proposal is now Rejected.
      assert.ok(
        multisig.types.isProposalStatusRejected(proposalAccount.status)
      );
    });

    it("error: invalid status (Rejected)", async () => {
      const [multisigPda] = multisig.getMultisigPda({
        createKey: autonomousMultisigCreateKey.publicKey,
      });

      // Reject the proposal for the second config transaction.
      const transactionIndex = 2n;

      await assert.rejects(
        () =>
          multisig.rpc.proposalReject({
            connection,
            feePayer: members.almighty,
            multisigPda,
            transactionIndex,
            member: members.almighty,
          }),
        /Invalid proposal status/
      );
    });

    it("error: stale transaction");

    it("error: transaction is not for multisig");
  });

  describe("proposal_cancel", () => {
    it("cancel proposal", async () => {
      const [multisigPda] = multisig.getMultisigPda({
        createKey: autonomousMultisigCreateKey.publicKey,
      });

      // Cancel the proposal for the third config transaction.
      const transactionIndex = 3n;

      // First approve the transaction.
      const approveSignature1 = await multisig.rpc.proposalApprove({
        connection,
        feePayer: members.voter,
        multisigPda,
        transactionIndex,
        member: members.voter,
      });
      await connection.confirmTransaction(approveSignature1);

      const approveSignature2 = await multisig.rpc.proposalApprove({
        connection,
        feePayer: members.almighty,
        multisigPda,
        transactionIndex,
        member: members.almighty,
      });
      await connection.confirmTransaction(approveSignature2);

      // The proposal must be `Approved` now.
      const [proposalPda] = multisig.getProposalPda({
        multisigPda,
        transactionIndex,
      });
      let proposalAccount = await Proposal.fromAccountAddress(
        connection,
        proposalPda
      );
      assert.ok(
        multisig.types.isProposalStatusApproved(proposalAccount.status)
      );

      // Now cancel the transaction.
      const cancelSignature1 = await multisig.rpc.proposalCancel({
        connection,
        feePayer: members.voter,
        multisigPda,
        transactionIndex,
        member: members.voter,
      });
      await connection.confirmTransaction(cancelSignature1);

      proposalAccount = await Proposal.fromAccountAddress(
        connection,
        proposalPda
      );
      // Our threshold is 2, so after the first cancel, the proposal is still `Approved`.
      assert.ok(
        multisig.types.isProposalStatusApproved(proposalAccount.status)
      );

      // Second member cancels the transaction.
      const cancelSignature2 = await multisig.rpc.proposalCancel({
        connection,
        feePayer: members.almighty,
        multisigPda,
        transactionIndex,
        member: members.almighty,
      });
      await connection.confirmTransaction(cancelSignature2);

      proposalAccount = await Proposal.fromAccountAddress(
        connection,
        proposalPda
      );
      // Reached the threshold, so the transaction should be `Cancelled` now.
      assert.ok(
        multisig.types.isProposalStatusCancelled(proposalAccount.status)
      );
    });
  });

  describe("vault_transaction_execute", () => {
    it("execute a vault transaction", async () => {
      const [multisigPda] = multisig.getMultisigPda({
        createKey: autonomousMultisigCreateKey.publicKey,
      });

      // Execute the first vault transaction.
      const transactionIndex = 4n;

      const [transactionPda] = multisig.getTransactionPda({
        multisigPda,
        index: transactionIndex,
      });
      let transactionAccount = await VaultTransaction.fromAccountAddress(
        connection,
        transactionPda
      );

      const [proposalPda] = multisig.getProposalPda({
        multisigPda,
        transactionIndex,
      });
      const proposalAccountInfo = await connection.getAccountInfo(proposalPda);
      // This transaction doesn't have a proposal yet.
      assert.strictEqual(proposalAccountInfo, null);

      // Create a proposal for the transaction.
      let signature = await multisig.rpc.proposalCreate({
        connection,
        feePayer: members.proposer,
        multisigPda,
        transactionIndex,
        rentPayer: members.proposer,
      });
      await connection.confirmTransaction(signature);

      // Approve the proposal by the first member.
      signature = await multisig.rpc.proposalApprove({
        connection,
        feePayer: members.voter,
        multisigPda,
        transactionIndex,
        member: members.voter,
      });
      await connection.confirmTransaction(signature);

      // Approve the proposal by the second member.
      signature = await multisig.rpc.proposalApprove({
        connection,
        feePayer: members.almighty,
        multisigPda,
        transactionIndex,
        member: members.almighty,
      });
      await connection.confirmTransaction(signature);

      const [vaultPda] = multisig.getVaultPda({
        multisigPda,
        index: transactionAccount.vaultIndex,
      });
      const preVaultBalance = await connection.getBalance(vaultPda);
      assert.strictEqual(preVaultBalance, 2 * LAMPORTS_PER_SOL);

      // Execute the transaction.
      signature = await multisig.rpc.vaultTransactionExecute({
        connection,
        feePayer: members.executor,
        multisigPda,
        transactionIndex,
        member: members.executor.publicKey,
        signers: [members.executor],
      });
      await connection.confirmTransaction(signature);

      // Verify the transaction account.
      const proposalAccount = await Proposal.fromAccountAddress(
        connection,
        proposalPda
      );
      assert.ok(
        multisig.types.isProposalStatusExecuted(proposalAccount.status)
      );

      const postVaultBalance = await connection.getBalance(vaultPda);
      // Transferred 2 SOL to payee.
      assert.strictEqual(postVaultBalance, 0);
    });

    it("error: not a member");

    it("error: unauthorized");

    it("error: invalid transaction status");

    it("error: transaction is not for multisig");

    it("error: execute reentrancy");
  });

  describe("config_transaction_execute", () => {
    it("error: invalid proposal status (Cancelled)", async () => {
      const [multisigPda] = multisig.getMultisigPda({
        createKey: autonomousMultisigCreateKey.publicKey,
      });

      // Attempt to execute a transaction with a cancelled proposal.
      const transactionIndex = 3n;

      await assert.rejects(
        () =>
          multisig.rpc.configTransactionExecute({
            connection,
            feePayer: members.almighty,
            multisigPda,
            transactionIndex,
            rentPayer: members.almighty,
            member: members.almighty,
          }),
        /Invalid proposal status/
      );
    });

    it("execute a config transaction", async () => {
      const [multisigPda] = multisig.getMultisigPda({
        createKey: autonomousMultisigCreateKey.publicKey,
      });

      // Execute the first config transaction.
      const transactionIndex = 1n;

      const signature = await multisig.rpc.configTransactionExecute({
        connection,
        feePayer: members.almighty,
        multisigPda,
        transactionIndex,
        member: members.almighty,
        rentPayer: members.almighty,
      });
      await connection.confirmTransaction(signature);

      // Verify the transaction account.
      const [proposalPda] = multisig.getProposalPda({
        multisigPda,
        transactionIndex,
      });
      const proposalAccount = await Proposal.fromAccountAddress(
        connection,
        proposalPda
      );
      assert.ok(
        multisig.types.isProposalStatusExecuted(proposalAccount.status)
      );

      // Verify the multisig account.
      const multisigAccount = await Multisig.fromAccountAddress(
        connection,
        multisigPda
      );
      // The threshold should have been updated.
      assert.strictEqual(multisigAccount.threshold, 1);
    });

    it("create, approve, execute in 1 Solana tx", async () => {
      const [multisigPda] = multisig.getMultisigPda({
        createKey: autonomousMultisigCreateKey.publicKey,
      });
      let multisigAccount = await Multisig.fromAccountAddress(
        connection,
        multisigPda
      );

      const transactionIndex =
        multisig.utils.toBigInt(multisigAccount.transactionIndex) + 1n;

      const createTransactionIx = multisig.instructions.configTransactionCreate(
        {
          multisigPda,
          transactionIndex,
          creator: members.almighty.publicKey,
          // Revert the threshold back to 2.
          actions: [{ __kind: "ChangeThreshold", newThreshold: 2 }],
        }
      );
      const createProposalIx = multisig.instructions.proposalCreate({
        multisigPda,
        transactionIndex,
        rentPayer: members.almighty.publicKey,
      });

      const approveProposalIx = multisig.instructions.proposalApprove({
        multisigPda,
        transactionIndex,
        member: members.almighty.publicKey,
      });

      const executeTransactionIx =
        multisig.instructions.configTransactionExecute({
          multisigPda,
          transactionIndex,
          member: members.almighty.publicKey,
          rentPayer: members.almighty.publicKey,
        });

      const message = new TransactionMessage({
        payerKey: members.almighty.publicKey,
        recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
        instructions: [
          createTransactionIx,
          createProposalIx,
          approveProposalIx,
          executeTransactionIx,
        ],
      }).compileToV0Message();

      const tx = new VersionedTransaction(message);

      tx.sign([members.almighty]);

      const signature = await connection.sendTransaction(tx, {
        skipPreflight: true,
      });
      await connection.confirmTransaction(signature);

      // Verify the multisig account.
      multisigAccount = await Multisig.fromAccountAddress(
        connection,
        multisigPda
      );

      // The threshold should have been updated.
      assert.strictEqual(multisigAccount.threshold, 2);
    });
  });

  describe("utils", () => {
    describe("getAvailableMemoSize", () => {
      it("provides estimates for available size to use for memo", async () => {
        const multisigCreator = await generateFundedKeypair(connection);
        const createKey = Keypair.generate();
        const [multisigPda] = multisig.getMultisigPda({
          createKey: createKey.publicKey,
        });
        const [configAuthority] = multisig.getVaultPda({
          multisigPda,
          index: 0,
        });

        const multisigCreateArgs: Parameters<
          typeof multisig.transactions.multisigCreate
        >[0] = {
          blockhash: (await connection.getLatestBlockhash()).blockhash,
          createKey: createKey.publicKey,
          creator: multisigCreator.publicKey,
          multisigPda,
          configAuthority,
          timeLock: 0,
          members: [
            { key: members.almighty.publicKey, permissions: Permissions.all() },
          ],
          threshold: 1,
        };

        const createMultisigTxWithoutMemo =
          multisig.transactions.multisigCreate(multisigCreateArgs);

        const availableMemoSize = multisig.utils.getAvailableMemoSize(
          createMultisigTxWithoutMemo
        );

        const memo = "a".repeat(availableMemoSize);

        const createMultisigTxWithMemo = multisig.transactions.multisigCreate({
          ...multisigCreateArgs,
          memo,
        });
        // The transaction with memo should have the maximum allowed size.
        assert.strictEqual(createMultisigTxWithMemo.serialize().length, 1232);
        // The transaction should work.
        createMultisigTxWithMemo.sign([multisigCreator, createKey]);
        const signature = await connection.sendTransaction(
          createMultisigTxWithMemo
        );
        await connection.confirmTransaction(signature);
      });
    });
  });

  describe("end-to-end scenarios", () => {
    it('vault transaction with "ephemeral" signers', async () => {
      const [multisigPda] = multisig.getMultisigPda({
        createKey: autonomousMultisigCreateKey.publicKey,
      });
      let multisigAccount = await Multisig.fromAccountAddress(
        connection,
        multisigPda
      );

      const transactionIndex =
        multisig.utils.toBigInt(multisigAccount.transactionIndex) + 1n;

      const [transactionPda] = multisig.getTransactionPda({
        multisigPda,
        index: transactionIndex,
      });

      // Default vault, index 0.
      const [vaultPda] = multisig.getVaultPda({
        multisigPda,
        index: 0,
      });

      const lamportsForMintRent = await getMinimumBalanceForRentExemptMint(
        connection
      );

      // Vault will pay for the mint account rent, airdrop this amount.
      const airdropSig = await connection.requestAirdrop(
        vaultPda,
        lamportsForMintRent
      );
      await connection.confirmTransaction(airdropSig);

      // Test create Mint transaction.
      const [mintPda, mintBump] = multisig.getEphemeralSignerPda({
        transactionPda,
        ephemeralSignerIndex: 0,
      });

      const testTransactionMessage = new TransactionMessage({
        payerKey: vaultPda,
        recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
        instructions: [
          SystemProgram.createAccount({
            fromPubkey: vaultPda,
            newAccountPubkey: mintPda,
            space: MINT_SIZE,
            lamports: lamportsForMintRent,
            programId: TOKEN_2022_PROGRAM_ID,
          }),
          createInitializeMint2Instruction(
            mintPda,
            9,
            vaultPda,
            vaultPda,
            TOKEN_2022_PROGRAM_ID
          ),
        ],
      });

      // Create
      let signature = await multisig.rpc.vaultTransactionCreate({
        connection,
        feePayer: members.proposer,
        multisigPda,
        transactionIndex,
        creator: members.proposer.publicKey,
        vaultIndex: 0,
        ephemeralSigners: 1,
        transactionMessage: testTransactionMessage,
        memo: "Create new mint",
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

      // Verify the transaction account
      let transactionAccount = await VaultTransaction.fromAccountAddress(
        connection,
        transactionPda
      );
      assert.deepEqual(
        transactionAccount.ephemeralSignerBumps,
        new Uint8Array([mintBump])
      );

      // Create Proposal
      signature = await multisig.rpc.proposalCreate({
        connection,
        feePayer: members.voter,
        multisigPda,
        transactionIndex,
        rentPayer: members.voter,
      });
      await connection.confirmTransaction(signature);

      // Approve 1
      signature = await multisig.rpc.proposalApprove({
        connection,
        feePayer: members.voter,
        multisigPda,
        transactionIndex,
        member: members.voter,
        memo: "LGTM",
      });
      await connection.confirmTransaction(signature);

      // Approve 2
      signature = await multisig.rpc.proposalApprove({
        connection,
        feePayer: members.almighty,
        multisigPda,
        transactionIndex,
        member: members.almighty,
        memo: "LGTM too",
      });
      await connection.confirmTransaction(signature);

      // Execute
      signature = await multisig.rpc.vaultTransactionExecute({
        connection,
        feePayer: members.executor,
        multisigPda,
        transactionIndex,
        member: members.executor.publicKey,
        signers: [members.executor],
        sendOptions: { skipPreflight: true },
      });
      await connection.confirmTransaction(signature);

      // Assert the mint account is initialized.
      const mintAccount = await getMint(
        connection,
        mintPda,
        undefined,
        TOKEN_2022_PROGRAM_ID
      );
      assert.ok(mintAccount.isInitialized);
      assert.strictEqual(
        mintAccount.mintAuthority?.toBase58(),
        vaultPda.toBase58()
      );
      assert.strictEqual(mintAccount.decimals, 9);
      assert.strictEqual(mintAccount.supply, 0n);
    });

    it("create and execute batch", async () => {
      // Use a different fee payer for the batch execution to isolate member balance changes.
      const feePayer = await generateFundedKeypair(connection);

      const [multisigPda] = multisig.getMultisigPda({
        createKey: autonomousMultisigCreateKey.publicKey,
      });
      let multisigAccount = await Multisig.fromAccountAddress(
        connection,
        multisigPda
      );

      const vaultIndex = 0;
      const batchIndex =
        multisig.utils.toBigInt(multisigAccount.transactionIndex) + 1n;

      const [proposalPda] = multisig.getProposalPda({
        multisigPda,
        transactionIndex: batchIndex,
      });

      // Default vault, index 0.
      const [vaultPda] = multisig.getVaultPda({
        multisigPda,
        index: 0,
      });

      // Prepare transactions for the batch.
      // We are going to make a payout of 1 SOL to every member of the multisig
      // first as a separate transaction per member, then in a single transaction
      // that also uses an Account Lookup Table containing all member addresses.
      // Airdrop SOL amount required for the payout to the Vault.
      const airdropSig = await connection.requestAirdrop(
        vaultPda,
        // Each member will be paid 2 x 1 SOL.
        Object.keys(members).length * 2 * LAMPORTS_PER_SOL
      );
      await connection.confirmTransaction(airdropSig);
      const {
        value: { blockhash },
        context: { slot },
      } = await connection.getLatestBlockhashAndContext("finalized");

      const testTransactionMessages = [] as {
        message: TransactionMessage;
        addressLookupTableAccounts: AddressLookupTableAccount[];
      }[];
      for (const member of Object.values(members)) {
        const ix = createTestTransferInstruction(
          vaultPda,
          member.publicKey,
          LAMPORTS_PER_SOL
        );
        testTransactionMessages.push({
          message: new TransactionMessage({
            payerKey: vaultPda,
            recentBlockhash: blockhash,
            instructions: [ix],
          }),
          addressLookupTableAccounts: [],
        });
      }

      // Create a lookup table with all member addresses.
      const memberAddresses = Object.values(members).map((m) => m.publicKey);
      const [lookupTableIx, lookupTableAddress] =
        AddressLookupTableProgram.createLookupTable({
          authority: feePayer.publicKey,
          payer: feePayer.publicKey,
          recentSlot: slot,
        });
      const extendTableIx = AddressLookupTableProgram.extendLookupTable({
        payer: feePayer.publicKey,
        authority: feePayer.publicKey,
        lookupTable: lookupTableAddress,
        addresses: [SystemProgram.programId, ...memberAddresses],
      });

      const createLookupTableTx = new VersionedTransaction(
        new TransactionMessage({
          payerKey: feePayer.publicKey,
          recentBlockhash: blockhash,
          instructions: [lookupTableIx, extendTableIx],
        }).compileToV0Message()
      );
      createLookupTableTx.sign([feePayer]);
      let signature = await connection
        .sendRawTransaction(createLookupTableTx.serialize())
        .catch((err: any) => {
          console.error(err.logs);
          throw err;
        });
      await connection.confirmTransaction(signature);

      const lookupTableAccount = await connection
        .getAddressLookupTable(lookupTableAddress)
        .then((res) => res.value);
      assert.ok(lookupTableAccount);

      const batchTransferIxs = Object.values(members).map((member) =>
        createTestTransferInstruction(
          vaultPda,
          member.publicKey,
          LAMPORTS_PER_SOL
        )
      );
      testTransactionMessages.push({
        message: new TransactionMessage({
          payerKey: vaultPda,
          recentBlockhash: blockhash,
          instructions: batchTransferIxs,
        }),
        addressLookupTableAccounts: [lookupTableAccount],
      });

      // Create a batch account.
      signature = await multisig.rpc.batchCreate({
        connection,
        feePayer: members.proposer,
        multisigPda,
        creator: members.proposer,
        batchIndex,
        vaultIndex,
        memo: "Distribute funds to members",
      });
      await connection.confirmTransaction(signature);

      // Initialize the proposal for the batch.
      signature = await multisig.rpc.proposalCreate({
        connection,
        feePayer: members.proposer,
        multisigPda,
        transactionIndex: batchIndex,
        rentPayer: members.proposer,
        isDraft: true,
      });
      await connection.confirmTransaction(signature);

      // Add transactions to the batch.
      for (const [
        index,
        { message, addressLookupTableAccounts },
      ] of testTransactionMessages.entries()) {
        signature = await multisig.rpc.batchAddTransaction({
          connection,
          feePayer: members.proposer,
          multisigPda,
          member: members.proposer,
          batchIndex,
          // Batch transaction indices start at 1.
          transactionIndex: index + 1,
          ephemeralSigners: 0,
          transactionMessage: message,
          addressLookupTableAccounts,
        });
        await connection.confirmTransaction(signature);
      }

      // Activate the proposal (finalize the batch).
      signature = await multisig.rpc.proposalActivate({
        connection,
        feePayer: members.proposer,
        multisigPda,
        member: members.proposer,
        transactionIndex: batchIndex,
      });
      await connection.confirmTransaction(signature);

      // First approval for the batch proposal.
      signature = await multisig.rpc.proposalApprove({
        connection,
        feePayer: members.voter,
        multisigPda,
        member: members.voter,
        transactionIndex: batchIndex,
        memo: "LGTM",
      });
      await connection.confirmTransaction(signature);

      // Second approval for the batch proposal.
      signature = await multisig.rpc.proposalApprove({
        connection,
        feePayer: members.almighty,
        multisigPda,
        member: members.almighty,
        transactionIndex: batchIndex,
        memo: "LGTM too",
      });
      await connection.confirmTransaction(signature);

      // Fetch the member balances before the batch execution.
      const preBalances = [] as number[];
      for (const member of Object.values(members)) {
        const balance = await connection.getBalance(member.publicKey);
        preBalances.push(balance);
      }

      // Execute the transactions from the batch sequentially one-by-one.
      for (const transactionIndex of range(1, testTransactionMessages.length)) {
        signature = await multisig.rpc.batchExecuteTransaction({
          connection,
          feePayer: feePayer,
          multisigPda,
          member: members.executor,
          batchIndex,
          transactionIndex,
        });
        await connection.confirmTransaction(signature);
      }

      // Proposal status must be "Executed".
      const proposalAccount = await Proposal.fromAccountAddress(
        connection,
        proposalPda
      );
      assert.ok(
        multisig.types.isProposalStatusExecuted(proposalAccount.status)
      );

      // Verify that the members received the funds.
      for (const [index, preBalance] of preBalances.entries()) {
        const postBalance = await connection.getBalance(
          Object.values(members)[index].publicKey
        );
        assert.strictEqual(postBalance, preBalance + 2 * LAMPORTS_PER_SOL);
      }
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

function createTestTransferInstruction(
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

/** Returns true if the given unix epoch is within a couple of seconds of now. */
function isCloseToNow(unixEpoch: number | bigint) {
  const timestamp = Number(unixEpoch) * 1000;
  return Math.abs(timestamp - Date.now()) < 2000;
}

/** Returns an array of numbers from min to max (inclusive) with the given step. */
function range(min: number, max: number, step: number = 1) {
  const result = [];
  for (let i = min; i <= max; i += step) {
    result.push(i);
  }
  return result;
}
