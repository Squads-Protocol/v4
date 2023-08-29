import {
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  TransactionMessage,
} from "@solana/web3.js";
import * as multisig from "@sqds/multisig";
import * as assert from "assert";
import {
  createAutonomousMultisig,
  createControlledMultisig,
  createLocalhostConnection,
  createTestTransferInstruction,
  generateFundedKeypair,
  generateMultisigMembers,
  isCloseToNow,
  TestMembers,
} from "../utils";

const { toBigInt } = multisig.utils;
const { Multisig, VaultTransaction, ConfigTransaction, Proposal, Batch } =
  multisig.accounts;
const { Permission, Permissions } = multisig.types;

describe("Multisig SDK", () => {
  const connection = createLocalhostConnection();

  let members: TestMembers;

  before(async () => {
    members = await generateMultisigMembers(connection);
  });

  describe("multisig_create", () => {
    it("error: duplicate member", async () => {
      const creator = await generateFundedKeypair(connection);

      const createKey = Keypair.generate().publicKey;
      const [multisigPda] = multisig.getMultisigPda({
        createKey,
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
          }),
        /Members don't include any proposers/
      );
    });

    it("error: member has unknown permission", async () => {
      const creator = await generateFundedKeypair(connection);
      const member = Keypair.generate();

      const createKey = Keypair.generate().publicKey;
      const [multisigPda] = multisig.getMultisigPda({
        createKey,
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
          }),
        /Member has unknown permission/
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
          }),
        /Invalid threshold, must be between 1 and number of members/
      );
    });

    it("error: invalid threshold (> members with permission to Vote)", async () => {
      const creator = await generateFundedKeypair(connection);

      const createKey = Keypair.generate().publicKey;
      const [multisigPda] = multisig.getMultisigPda({
        createKey: createKey,
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
          }),
        /Invalid threshold, must be between 1 and number of members with Vote permission/
      );
    });

    it("create a new autonomous multisig", async () => {
      const createKey = Keypair.generate().publicKey;

      const [multisigPda, multisigBump] = await createAutonomousMultisig({
        connection,
        createKey,
        members,
        threshold: 2,
        timeLock: 0,
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
      assert.strictEqual(multisigAccount.reserved, 0);
      assert.strictEqual(multisigAccount.transactionIndex.toString(), "0");
      assert.strictEqual(multisigAccount.staleTransactionIndex.toString(), "0");
      assert.strictEqual(
        multisigAccount.createKey.toBase58(),
        createKey.toBase58()
      );
      assert.strictEqual(multisigAccount.bump, multisigBump);
    });

    it("create a new controlled multisig", async () => {
      const createKey = Keypair.generate().publicKey;
      const configAuthority = await generateFundedKeypair(connection);

      const [multisigPda] = await createControlledMultisig({
        connection,
        createKey,
        configAuthority: configAuthority.publicKey,
        members,
        threshold: 2,
        timeLock: 0,
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

  describe("multisig_add_member", () => {
    const newMember = {
      key: Keypair.generate().publicKey,
      permissions: Permissions.all(),
    } as const;
    const newMember2 = {
      key: Keypair.generate().publicKey,
      permissions: Permissions.all(),
    } as const;

    let multisigPda: PublicKey;
    let configAuthority: Keypair;

    before(async () => {
      configAuthority = await generateFundedKeypair(connection);

      // Create new controlled multisig.
      multisigPda = (
        await createControlledMultisig({
          connection,
          createKey: Keypair.generate().publicKey,
          configAuthority: configAuthority.publicKey,
          members,
          threshold: 2,
          timeLock: 0,
        })
      )[0];
    });

    it("error: adding an existing member", async () => {
      const feePayer = await generateFundedKeypair(connection);

      // Adding the same member again should fail.
      await assert.rejects(
        multisig.rpc.multisigAddMember({
          connection,
          feePayer,
          multisigPda,
          configAuthority: configAuthority.publicKey,
          rentPayer: configAuthority,
          newMember: {
            key: members.almighty.publicKey,
            permissions: Permissions.all(),
          },
          signers: [configAuthority],
          sendOptions: { skipPreflight: true },
        }),
        /Found multiple members with the same pubkey/
      );
    });

    it("error: missing authority signature", async () => {
      const feePayer = await generateFundedKeypair(connection);

      await assert.rejects(
        multisig.rpc.multisigAddMember({
          connection,
          feePayer,
          multisigPda,
          configAuthority: configAuthority.publicKey,
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

    it("add a new member to the controlled multisig", async () => {
      // feePayer can be anyone.
      const feePayer = await generateFundedKeypair(connection);

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
        configAuthority: configAuthority.publicKey,
        rentPayer: configAuthority,
        newMember,
        memo: "Adding my good friend to the multisig",
        signers: [configAuthority],
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
        configAuthority: configAuthority.publicKey,
        rentPayer: configAuthority,
        newMember: newMember2,
        signers: [configAuthority],
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

    it("set `time_lock` for the controlled multisig");
  });

  describe("multisig_set_config_authority", () => {
    it("error: invalid authority");

    it("set `config_authority` for the controlled multisig");
  });

  describe("multisig_add_spending_limit", () => {
    let autonomousMultisigPda: PublicKey;
    let feePayer: Keypair;
    let spendingLimitPda: PublicKey;
    let spendingLimitCreateKey: PublicKey;

    before(async () => {
      // Create new autonomous multisig.
      autonomousMultisigPda = (
        await createControlledMultisig({
          connection,
          configAuthority: members.almighty.publicKey,
          members,
          threshold: 2,
          timeLock: 0,
        })
      )[0];

      feePayer = await generateFundedKeypair(connection);

      spendingLimitCreateKey = Keypair.generate().publicKey;

      spendingLimitPda = multisig.getSpendingLimitPda({
        multisigPda: autonomousMultisigPda,
        createKey: spendingLimitCreateKey,
      })[0];
    });

    it("error: invalid authority", async () => {
      await assert.rejects(
        multisig.rpc.multisigAddSpendingLimit({
          connection,
          feePayer: feePayer,
          multisigPda: autonomousMultisigPda,
          spendingLimit: spendingLimitPda,
          createKey: spendingLimitCreateKey,
          rentPayer: feePayer,
          amount: BigInt(1000000000),
          configAuthority: members.voter.publicKey,
          period: multisig.generated.Period.Day,
          mint: Keypair.generate().publicKey,
          destinations: [Keypair.generate().publicKey],
          members: [members.almighty.publicKey],
          vaultIndex: 1,
          signers: [feePayer, members.voter],
        }),
        /Attempted to perform an unauthorized action/
      );
    });

    it("create a new Spending Limit for the controlled multisig", async () => {
      await multisig.rpc.multisigAddSpendingLimit({
        connection,
        feePayer: feePayer,
        multisigPda: autonomousMultisigPda,
        spendingLimit: spendingLimitPda,
        createKey: spendingLimitCreateKey,
        rentPayer: feePayer,
        amount: BigInt(1000000000),
        configAuthority: members.almighty.publicKey,
        period: multisig.generated.Period.Day,
        mint: Keypair.generate().publicKey,
        destinations: [Keypair.generate().publicKey],
        members: [members.almighty.publicKey],
        vaultIndex: 1,
        signers: [feePayer, members.almighty],
      });
    });
  });

  describe("multisig_remove_spending_limit", () => {
    let autonomousMultisigPda: PublicKey;
    let feePayer: Keypair;
    let spendingLimitPda: PublicKey;
    let spendingLimitCreateKey: PublicKey;

    before(async () => {
      // Create new autonomous multisig.
      autonomousMultisigPda = (
        await createControlledMultisig({
          connection,
          configAuthority: members.almighty.publicKey,
          members,
          threshold: 2,
          timeLock: 0,
        })
      )[0];

      feePayer = await generateFundedKeypair(connection);

      spendingLimitCreateKey = Keypair.generate().publicKey;

      spendingLimitPda = multisig.getSpendingLimitPda({
        multisigPda: autonomousMultisigPda,
        createKey: spendingLimitCreateKey,
      })[0];

      await multisig.rpc.multisigAddSpendingLimit({
        connection,
        feePayer: feePayer,
        multisigPda: autonomousMultisigPda,
        spendingLimit: spendingLimitPda,
        createKey: spendingLimitCreateKey,
        rentPayer: feePayer,
        amount: BigInt(1000000000),
        configAuthority: members.almighty.publicKey,
        period: multisig.generated.Period.Day,
        mint: Keypair.generate().publicKey,
        destinations: [Keypair.generate().publicKey],
        members: [members.almighty.publicKey],
        vaultIndex: 1,
        signers: [feePayer, members.almighty],
        sendOptions: { skipPreflight: true, preflightCommitment: "confirmed" },
      });
    });

    it("error: invalid authority", async () => {
      await assert.rejects(
        multisig.rpc.multisigRemoveSpendingLimit({
          connection,
          multisigPda: autonomousMultisigPda,
          spendingLimit: spendingLimitPda,
          configAuthority: members.voter.publicKey,
          feePayer: feePayer,
          rentCollector: members.voter.publicKey,
          signers: [feePayer, members.voter],
          sendOptions: {
            skipPreflight: true,
            preflightCommitment: "confirmed",
          },
        }),
        /Attempted to perform an unauthorized action/
      );
    });
    it("error: Spending Limit doesn't belong to the multisig");

    it("remove the Spending Limit from the controlled multisig", async () => {
      await multisig.rpc.multisigRemoveSpendingLimit({
        connection,
        multisigPda: autonomousMultisigPda,
        spendingLimit: spendingLimitPda,
        configAuthority: members.almighty.publicKey,
        feePayer: feePayer,
        rentCollector: members.almighty.publicKey,
        sendOptions: { skipPreflight: true },
        signers: [feePayer, members.almighty],
      });
    });
  });

  describe("config_transaction_create", () => {
    let autonomousMultisigPda: PublicKey;
    let controlledMultisigPda: PublicKey;

    before(async () => {
      // Create new autonomous multisig.
      autonomousMultisigPda = (
        await createAutonomousMultisig({
          connection,
          members,
          threshold: 2,
          timeLock: 0,
        })
      )[0];

      // Create new controlled multisig.
      controlledMultisigPda = (
        await createControlledMultisig({
          connection,
          configAuthority: Keypair.generate().publicKey,
          members,
          threshold: 2,
          timeLock: 0,
        })
      )[0];
    });

    it("error: not supported for controlled multisig", async () => {
      await assert.rejects(
        () =>
          multisig.rpc.configTransactionCreate({
            connection,
            feePayer: members.proposer,
            multisigPda: controlledMultisigPda,
            transactionIndex: 1n,
            creator: members.proposer.publicKey,
            actions: [{ __kind: "ChangeThreshold", newThreshold: 3 }],
          }),
        /Instruction not supported for controlled multisig/
      );
    });

    it("error: empty actions", async () => {
      await assert.rejects(
        () =>
          multisig.rpc.configTransactionCreate({
            connection,
            feePayer: members.proposer,
            multisigPda: autonomousMultisigPda,
            transactionIndex: 1n,
            creator: members.proposer.publicKey,
            actions: [],
          }),
        /Config transaction must have at least one action/
      );
    });

    it("error: not a member", async () => {
      const nonMember = await generateFundedKeypair(connection);

      await assert.rejects(
        () =>
          multisig.rpc.configTransactionCreate({
            connection,
            feePayer: nonMember,
            multisigPda: autonomousMultisigPda,
            transactionIndex: 1n,
            creator: nonMember.publicKey,
            actions: [{ __kind: "ChangeThreshold", newThreshold: 3 }],
          }),
        /Provided pubkey is not a member of multisig/
      );
    });

    it("error: unauthorized", async () => {
      await assert.rejects(
        () =>
          multisig.rpc.configTransactionCreate({
            connection,
            feePayer: members.voter,
            multisigPda: autonomousMultisigPda,
            transactionIndex: 1n,
            // Voter is not authorized to initialize config transactions.
            creator: members.voter.publicKey,
            actions: [{ __kind: "ChangeThreshold", newThreshold: 3 }],
          }),
        /Attempted to perform an unauthorized action/
      );
    });

    it("create a config transaction", async () => {
      const transactionIndex = 1n;

      const signature = await multisig.rpc.configTransactionCreate({
        connection,
        feePayer: members.proposer,
        multisigPda: autonomousMultisigPda,
        transactionIndex,
        creator: members.proposer.publicKey,
        actions: [{ __kind: "ChangeThreshold", newThreshold: 1 }],
      });
      await connection.confirmTransaction(signature);

      // Fetch the multisig account.
      const multisigAccount = await Multisig.fromAccountAddress(
        connection,
        autonomousMultisigPda
      );
      const lastTransactionIndex = multisig.utils.toBigInt(
        multisigAccount.transactionIndex
      );
      assert.strictEqual(lastTransactionIndex, transactionIndex);

      // Fetch the newly created ConfigTransaction account.
      const [transactionPda, transactionBump] = multisig.getTransactionPda({
        multisigPda: autonomousMultisigPda,
        index: transactionIndex,
      });
      const configTransactionAccount =
        await ConfigTransaction.fromAccountAddress(connection, transactionPda);

      // Assertions.
      assert.strictEqual(
        configTransactionAccount.multisig.toBase58(),
        autonomousMultisigPda.toBase58()
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
  });

  describe("vault_transaction_create", () => {
    let multisigPda: PublicKey;

    before(async () => {
      const msCreateKey = Keypair.generate().publicKey;

      // Create new autonomous multisig.
      multisigPda = (
        await createAutonomousMultisig({
          connection,
          createKey: msCreateKey,
          members,
          threshold: 2,
          timeLock: 0,
        })
      )[0];
    });

    it("error: not a member", async () => {
      const nonMember = await generateFundedKeypair(connection);

      // Default vault.
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
            transactionIndex: 1n,
            creator: nonMember.publicKey,
            vaultIndex: 0,
            ephemeralSigners: 0,
            transactionMessage: testTransferMessage,
          }),
        /Provided pubkey is not a member of multisig/
      );
    });

    it("error: unauthorized", async () => {
      // Default vault.
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
            feePayer: members.voter,
            multisigPda,
            transactionIndex: 1n,
            creator: members.voter.publicKey,
            vaultIndex: 0,
            ephemeralSigners: 0,
            transactionMessage: testTransferMessage,
          }),
        /Attempted to perform an unauthorized action/
      );
    });

    it("create a new vault transaction", async () => {
      const transactionIndex = 1n;

      // Default vault.
      const [vaultPda, vaultBump] = multisig.getVaultPda({
        multisigPda,
        index: 0,
      });

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

      const multisigAccount = await Multisig.fromAccountAddress(
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
  });

  describe("proposal_create", () => {
    let multisigPda: PublicKey;

    before(async () => {
      const msCreateKey = Keypair.generate().publicKey;

      // Create new autonomous multisig.
      multisigPda = (
        await createAutonomousMultisig({
          connection,
          createKey: msCreateKey,
          members,
          threshold: 2,
          timeLock: 0,
        })
      )[0];

      // Create a config transaction.
      const newMember = {
        key: Keypair.generate().publicKey,
        permissions: Permissions.all(),
      } as const;

      let signature = await multisig.rpc.configTransactionCreate({
        connection,
        feePayer: members.proposer,
        multisigPda,
        transactionIndex: 1n,
        creator: members.proposer.publicKey,
        actions: [{ __kind: "AddMember", newMember }],
      });
      await connection.confirmTransaction(signature);
    });

    it("error: invalid transaction index", async () => {
      // Attempt to create a proposal for a transaction that doesn't exist.
      const transactionIndex = 2n;
      await assert.rejects(
        () =>
          multisig.rpc.proposalCreate({
            connection,
            feePayer: members.almighty,
            multisigPda,
            transactionIndex,
            creator: members.almighty,
          }),
        /Invalid transaction index/
      );
    });

    it("error: non-members can't create a proposal", async () => {
      const nonMember = await generateFundedKeypair(connection);

      const transactionIndex = 2n;

      // Create a config transaction.
      let signature = await multisig.rpc.configTransactionCreate({
        connection,
        feePayer: members.proposer,
        multisigPda,
        transactionIndex,
        creator: members.proposer.publicKey,
        actions: [{ __kind: "ChangeThreshold", newThreshold: 1 }],
      });
      await connection.confirmTransaction(signature);

      await assert.rejects(
        () =>
          multisig.rpc.proposalCreate({
            connection,
            feePayer: nonMember,
            multisigPda,
            transactionIndex,
            creator: nonMember,
          }),
        /Provided pubkey is not a member of multisig/
      );
    });

    it("error: members without Initiate or Vote permissions can't create a proposal", async () => {
      const transactionIndex = 2n;

      await assert.rejects(
        () =>
          multisig.rpc.proposalCreate({
            connection,
            feePayer: members.executor,
            multisigPda,
            transactionIndex,
            creator: members.executor,
          }),
        /Attempted to perform an unauthorized action/
      );
    });

    it("member with Initiate or Vote permissions can create proposal", async () => {
      const nonMember = await generateFundedKeypair(connection);

      const transactionIndex = 2n;

      // Create a proposal for the config transaction.
      let signature = await multisig.rpc.proposalCreate({
        connection,
        feePayer: members.voter,
        multisigPda,
        transactionIndex,
        creator: members.voter,
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
    });

    it("error: cannot create proposal for stale transaction", async () => {
      // Approve the second config transaction.
      let signature = await multisig.rpc.proposalApprove({
        connection,
        feePayer: members.voter,
        multisigPda,
        transactionIndex: 2n,
        member: members.voter,
      });
      await connection.confirmTransaction(signature);

      signature = await multisig.rpc.proposalApprove({
        connection,
        feePayer: members.almighty,
        multisigPda,
        transactionIndex: 2n,
        member: members.almighty,
      });
      await connection.confirmTransaction(signature);

      // Execute the second config transaction.
      signature = await multisig.rpc.configTransactionExecute({
        connection,
        feePayer: members.almighty,
        multisigPda,
        transactionIndex: 2n,
        member: members.almighty,
        rentPayer: members.almighty,
      });
      await connection.confirmTransaction(signature);

      const feePayer = await generateFundedKeypair(connection);

      // At this point the first transaction should become stale.
      // Attempt to create a proposal for it should fail.
      await assert.rejects(
        () =>
          multisig.rpc.proposalCreate({
            connection,
            feePayer,
            multisigPda,
            transactionIndex: 1n,
            creator: members.almighty,
          }),
        /Proposal is stale/
      );
    });
  });

  describe("proposal_approve", () => {
    let multisigPda: PublicKey;

    before(async () => {
      const feePayer = await generateFundedKeypair(connection);
      const msCreateKey = Keypair.generate().publicKey;

      // Create new autonomous multisig.
      multisigPda = (
        await createAutonomousMultisig({
          connection,
          createKey: msCreateKey,
          members,
          threshold: 2,
          timeLock: 0,
        })
      )[0];

      const transactionIndex = 1n;

      // Create a config transaction.
      let signature = await multisig.rpc.configTransactionCreate({
        connection,
        feePayer: members.proposer,
        multisigPda,
        transactionIndex,
        creator: members.proposer.publicKey,
        actions: [{ __kind: "ChangeThreshold", newThreshold: 1 }],
      });
      await connection.confirmTransaction(signature);

      // Create a proposal for the config transaction.
      signature = await multisig.rpc.proposalCreate({
        connection,
        feePayer,
        multisigPda,
        transactionIndex,
        creator: members.proposer,
      });
      await connection.confirmTransaction(signature);
    });

    it("error: not a member", async () => {
      const nonMember = await generateFundedKeypair(connection);

      const transactionIndex = 1n;

      // Non-member cannot approve the proposal.
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
      const transactionIndex = 1n;

      // Executor is not authorized to approve config transactions.
      await assert.rejects(
        () =>
          multisig.rpc.proposalApprove({
            connection,
            feePayer: members.executor,
            multisigPda,
            transactionIndex,
            member: members.executor,
          }),
        /Attempted to perform an unauthorized action/
      );
    });

    it("approve config transaction", async () => {
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
    let multisigPda: PublicKey;

    before(async () => {
      const feePayer = await generateFundedKeypair(connection);
      const msCreateKey = Keypair.generate().publicKey;

      // Create new autonomous multisig.
      multisigPda = (
        await createAutonomousMultisig({
          connection,
          createKey: msCreateKey,
          members,
          threshold: 2,
          timeLock: 0,
        })
      )[0];

      // Create first config transaction.
      let signature = await multisig.rpc.configTransactionCreate({
        connection,
        feePayer: members.proposer,
        multisigPda,
        transactionIndex: 1n,
        creator: members.proposer.publicKey,
        actions: [{ __kind: "ChangeThreshold", newThreshold: 1 }],
      });
      await connection.confirmTransaction(signature);

      // Create second config transaction.
      signature = await multisig.rpc.configTransactionCreate({
        connection,
        feePayer: members.proposer,
        multisigPda,
        transactionIndex: 2n,
        creator: members.proposer.publicKey,
        actions: [{ __kind: "SetTimeLock", newTimeLock: 60 }],
      });
      await connection.confirmTransaction(signature);

      // Create a proposal for the first config transaction.
      signature = await multisig.rpc.proposalCreate({
        connection,
        feePayer,
        multisigPda,
        transactionIndex: 1n,
        creator: members.proposer,
      });
      await connection.confirmTransaction(signature);

      // Create a proposal for the second config transaction.
      signature = await multisig.rpc.proposalCreate({
        connection,
        feePayer,
        multisigPda,
        transactionIndex: 2n,
        creator: members.proposer,
      });
      await connection.confirmTransaction(signature);

      // Approve the proposal for the first config transaction and reach the threshold.
      signature = await multisig.rpc.proposalApprove({
        connection,
        feePayer: members.voter,
        multisigPda,
        transactionIndex: 1n,
        member: members.voter,
      });
      await connection.confirmTransaction(signature);
      signature = await multisig.rpc.proposalApprove({
        connection,
        feePayer: members.almighty,
        multisigPda,
        transactionIndex: 1n,
        member: members.almighty,
      });
      await connection.confirmTransaction(signature);
    });

    it("error: try to reject an approved proposal", async () => {
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
      const proposalAccount = await Proposal.fromAccountAddress(
        connection,
        multisig.getProposalPda({
          multisigPda,
          transactionIndex,
        })[0]
      );
      assert.ok(
        multisig.types.isProposalStatusApproved(proposalAccount.status)
      );
    });

    it("error: not a member", async () => {
      const nonMember = await generateFundedKeypair(connection);

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

    it("error: already rejected", async () => {
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

      const proposalAccount = await Proposal.fromAccountAddress(
        connection,
        multisig.getProposalPda({
          multisigPda,
          transactionIndex,
        })[0]
      );
      assert.ok(
        multisig.types.isProposalStatusRejected(proposalAccount.status)
      );
    });

    it("error: stale transaction");

    it("error: transaction is not for multisig");
  });

  describe("proposal_cancel", () => {
    let multisigPda: PublicKey;

    before(async () => {
      const feePayer = await generateFundedKeypair(connection);
      const msCreateKey = Keypair.generate().publicKey;

      // Create new autonomous multisig.
      multisigPda = (
        await createAutonomousMultisig({
          connection,
          createKey: msCreateKey,
          members,
          threshold: 2,
          timeLock: 0,
        })
      )[0];

      // Create a config transaction.
      let signature = await multisig.rpc.configTransactionCreate({
        connection,
        feePayer: members.proposer,
        multisigPda,
        transactionIndex: 1n,
        creator: members.proposer.publicKey,
        actions: [{ __kind: "ChangeThreshold", newThreshold: 1 }],
      });
      await connection.confirmTransaction(signature);

      // Create a proposal for the config transaction.
      signature = await multisig.rpc.proposalCreate({
        connection,
        feePayer,
        multisigPda,
        transactionIndex: 1n,
        creator: members.proposer,
      });
      await connection.confirmTransaction(signature);

      // Approve the proposal for the config transaction and reach the threshold.
      signature = await multisig.rpc.proposalApprove({
        connection,
        feePayer: members.voter,
        multisigPda,
        transactionIndex: 1n,
        member: members.voter,
      });
      await connection.confirmTransaction(signature);
      signature = await multisig.rpc.proposalApprove({
        connection,
        feePayer: members.almighty,
        multisigPda,
        transactionIndex: 1n,
        member: members.almighty,
      });
      await connection.confirmTransaction(signature);

      // The proposal must be `Approved` now.
      const [proposalPda] = multisig.getProposalPda({
        multisigPda,
        transactionIndex: 1n,
      });
      let proposalAccount = await Proposal.fromAccountAddress(
        connection,
        proposalPda
      );
      assert.ok(
        multisig.types.isProposalStatusApproved(proposalAccount.status)
      );
    });

    it("cancel proposal", async () => {
      const transactionIndex = 1n;

      // Now cancel the proposal.
      let signature = await multisig.rpc.proposalCancel({
        connection,
        feePayer: members.voter,
        multisigPda,
        transactionIndex,
        member: members.voter,
      });
      await connection.confirmTransaction(signature);

      const proposalPda = multisig.getProposalPda({
        multisigPda,
        transactionIndex,
      })[0];
      let proposalAccount = await Proposal.fromAccountAddress(
        connection,
        proposalPda
      );
      // Our threshold is 2, so after the first cancel, the proposal is still `Approved`.
      assert.ok(
        multisig.types.isProposalStatusApproved(proposalAccount.status)
      );

      // Second member cancels the transaction.
      signature = await multisig.rpc.proposalCancel({
        connection,
        feePayer: members.almighty,
        multisigPda,
        transactionIndex,
        member: members.almighty,
      });
      await connection.confirmTransaction(signature);

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
    let multisigPda: PublicKey;

    before(async () => {
      // Create new autonomous multisig.
      multisigPda = (
        await createAutonomousMultisig({
          connection,
          members,
          threshold: 2,
          timeLock: 0,
        })
      )[0];

      // Default vault.
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

      const transactionIndex = 1n;

      // Create a vault transaction.
      let signature = await multisig.rpc.vaultTransactionCreate({
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

      // Create a proposal for the transaction.
      signature = await multisig.rpc.proposalCreate({
        connection,
        feePayer: members.proposer,
        multisigPda,
        transactionIndex,
        creator: members.proposer,
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
    });

    it("execute a vault transaction", async () => {
      // Execute the vault transaction.
      const transactionIndex = 1n;

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

      const [vaultPda] = multisig.getVaultPda({
        multisigPda,
        index: transactionAccount.vaultIndex,
      });
      const preVaultBalance = await connection.getBalance(vaultPda);
      assert.strictEqual(preVaultBalance, 2 * LAMPORTS_PER_SOL);

      // Execute the transaction.
      const signature = await multisig.rpc.vaultTransactionExecute({
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
    let multisigPda: PublicKey;
    const approvedTransactionIndex = 1n;
    const rejectedTransactionIndex = 2n;

    before(async () => {
      // Create new autonomous multisig.
      multisigPda = (
        await createAutonomousMultisig({
          connection,
          members,
          threshold: 2,
          timeLock: 0,
        })
      )[0];

      // Create a config transaction (Approved).
      let signature = await multisig.rpc.configTransactionCreate({
        connection,
        feePayer: members.proposer,
        multisigPda,
        transactionIndex: approvedTransactionIndex,
        creator: members.proposer.publicKey,
        actions: [{ __kind: "ChangeThreshold", newThreshold: 1 }],
      });
      await connection.confirmTransaction(signature);

      // Create a proposal for the transaction (Approved).
      signature = await multisig.rpc.proposalCreate({
        connection,
        feePayer: members.proposer,
        multisigPda,
        transactionIndex: approvedTransactionIndex,
        creator: members.proposer,
      });
      await connection.confirmTransaction(signature);

      // Approve the proposal by the first member.
      signature = await multisig.rpc.proposalApprove({
        connection,
        feePayer: members.voter,
        multisigPda,
        transactionIndex: approvedTransactionIndex,
        member: members.voter,
      });
      await connection.confirmTransaction(signature);

      // Approve the proposal by the second member.
      signature = await multisig.rpc.proposalApprove({
        connection,
        feePayer: members.almighty,
        multisigPda,
        transactionIndex: approvedTransactionIndex,
        member: members.almighty,
      });
      await connection.confirmTransaction(signature);

      // Create a config transaction (Rejected).
      signature = await multisig.rpc.configTransactionCreate({
        connection,
        feePayer: members.proposer,
        multisigPda,
        transactionIndex: rejectedTransactionIndex,
        creator: members.proposer.publicKey,
        actions: [{ __kind: "ChangeThreshold", newThreshold: 3 }],
      });
      await connection.confirmTransaction(signature);

      // Create a proposal for the transaction (Rejected).
      signature = await multisig.rpc.proposalCreate({
        connection,
        feePayer: members.proposer,
        multisigPda,
        transactionIndex: rejectedTransactionIndex,
        creator: members.proposer,
      });
      await connection.confirmTransaction(signature);

      // Reject the proposal by a member.
      // Our threshold is 2 out of 2 voting members, so the cutoff is 1.
      signature = await multisig.rpc.proposalReject({
        connection,
        feePayer: members.voter,
        multisigPda,
        transactionIndex: rejectedTransactionIndex,
        member: members.voter,
      });
      await connection.confirmTransaction(signature);
    });

    it("execute a config transaction", async () => {
      // Execute the approved config transaction.
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

      // Verify the proposal account.
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

    it("error: invalid proposal status (Rejected)", async () => {
      // Attempt to execute a transaction with a rejected proposal.
      await assert.rejects(
        () =>
          multisig.rpc.configTransactionExecute({
            connection,
            feePayer: members.almighty,
            multisigPda,
            transactionIndex: rejectedTransactionIndex,
            rentPayer: members.almighty,
            member: members.almighty,
          }),
        /Invalid proposal status/
      );
    });
  });

  describe("utils", () => {
    describe("getAvailableMemoSize", () => {
      it("provides estimates for available size to use for memo", async () => {
        const multisigCreator = await generateFundedKeypair(connection);
        const createKey = Keypair.generate().publicKey;
        const [multisigPda] = multisig.getMultisigPda({
          createKey,
        });
        const [configAuthority] = multisig.getVaultPda({
          multisigPda,
          index: 0,
        });

        const multisigCreateArgs: Parameters<
          typeof multisig.transactions.multisigCreate
        >[0] = {
          blockhash: (await connection.getLatestBlockhash()).blockhash,
          createKey,
          creator: multisigCreator.publicKey,
          multisigPda,
          configAuthority,
          timeLock: 0,
          members: [
            {
              key: members.almighty.publicKey,
              permissions: Permissions.all(),
            },
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
        createMultisigTxWithMemo.sign([multisigCreator]);
        const signature = await connection.sendTransaction(
          createMultisigTxWithMemo
        );
        await connection.confirmTransaction(signature);
      });
    });
  });
});

function comparePubkeys(a: PublicKey, b: PublicKey) {
  return a.toBuffer().compare(b.toBuffer());
}
