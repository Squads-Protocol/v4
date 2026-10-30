import * as multisig from "@sqds/multisig";
import {
  ComputeBudgetProgram,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  Signer,
  SystemProgram,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import assert from "assert";
import {
  createAutonomousMultisig,
  createControlledMultisig,
  createLocalhostConnection,
  createTestTransferInstruction,
  generateFundedKeypair,
  generateMultisigMembers,
  getTestProgramId,
  TestMembers,
} from "../utils";

const { Permission, Permissions } = multisig.types;

const programId = getTestProgramId();

const LOG_EVENT = Buffer.from([5, 9, 90, 141, 223, 134, 57, 217]);

// Borsh tags of `MultisigEvent` and of the `kind` field that some variants start with.
const VARIANTS = [
  "ProgramConfig",
  "MultisigCreate",
  "MultisigConfig",
  "ConfigAuthorityChange",
  "SpendingLimit",
  "SpendingLimitUse",
  "Transaction",
  "BatchTransaction",
  "Proposal",
];
const KINDS: Record<string, string[]> = {
  SpendingLimit: ["Add", "Remove"],
  Transaction: ["Create", "Execute", "Close"],
  BatchTransaction: ["Add", "Execute", "Close"],
  Proposal: ["Create", "Activate", "Approve", "Reject", "Cancel", "Execute", "Close"],
};

const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function base58Decode(text: string): Buffer {
  const value = [...text].reduce((acc, c) => acc * 58n + BigInt(ALPHABET.indexOf(c)), 0n);
  const hex = value === 0n ? "" : value.toString(16);
  const zeros = text.length - text.replace(/^1+/, "").length;
  return Buffer.concat([Buffer.alloc(zeros), Buffer.from(hex.length % 2 ? `0${hex}` : hex, "hex")]);
}

/** Appends the program as a trailing read-only account, which enables events. */
function withEvents(ix: TransactionInstruction): TransactionInstruction {
  return new TransactionInstruction({
    programId: ix.programId,
    data: ix.data,
    keys: [...ix.keys, { pubkey: ix.programId, isSigner: false, isWritable: false }],
  });
}

type Emitted = { name: string; authority: PublicKey; multisig: PublicKey | null; event: Buffer };

describe("Events", () => {
  const connection = createLocalhostConnection();

  let members: TestMembers;
  before(async () => {
    members = await generateMultisigMembers(connection);
  });

  async function send(
    instructions: TransactionInstruction[],
    signers: Signer[],
    lookupTables: Parameters<TransactionMessage["compileToV0Message"]>[0] = []
  ) {
    const message = new TransactionMessage({
      payerKey: signers[0].publicKey,
      recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
      instructions,
    }).compileToV0Message(lookupTables);
    const tx = new VersionedTransaction(message);
    tx.sign(signers);
    const signature = await connection.sendTransaction(tx).catch((err: Error & { logs?: string[] }) => {
      // Keep the simulation logs in the message, so a failed test shows them.
      err.message = [err.message, ...(err.logs ?? [])].join("\n");
      throw err;
    });
    await connection.confirmTransaction(signature);
    return signature;
  }

  /** The decoded `log_event` inner instructions of a transaction, in order. */
  async function eventsOf(signature: string) {
    const tx = await connection.getTransaction(signature, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    });
    assert.ok(tx?.meta, "transaction not found");
    assert.strictEqual(tx.meta.err, null);
    const keys = tx.transaction.message.getAccountKeys({
      accountKeysFromLookups: tx.meta.loadedAddresses,
    });
    const events: Emitted[] = [...(tx.meta.innerInstructions ?? [])]
      .sort((a, b) => a.index - b.index)
      .flatMap((inner) => inner.instructions)
      .filter((ix) => keys.get(ix.programIdIndex)?.equals(programId))
      .map((ix) => ({ data: base58Decode(ix.data), authority: keys.get(ix.accounts[0]) }))
      .filter(({ data }) => data.subarray(0, 8).equals(LOG_EVENT))
      .map(({ data, authority }) => {
        assert.ok(authority);
        const event = data.subarray(12);
        assert.strictEqual(data.readUInt32LE(8), event.length);
        const variant = VARIANTS[event[0]];
        const kinds = KINDS[variant];
        // Kinded variants start with the kind, then the multisig; the others with the multisig.
        const multisigOffset = kinds ? 2 : variant === "ProgramConfig" ? null : 1;
        return {
          name: kinds ? `${variant}:${kinds[event[1]]}` : variant,
          authority,
          event,
          multisig:
            multisigOffset === null
              ? null
              : new PublicKey(event.subarray(multisigOffset, multisigOffset + 32)),
        };
      });
    return { events, computeUnits: tx.meta.computeUnitsConsumed ?? 0 };
  }

  function assertEvents(events: Emitted[], names: string[], multisigPda: PublicKey) {
    assert.deepStrictEqual(
      events.map((e) => e.name),
      names
    );
    events.forEach((e) => {
      assert.ok(e.authority.equals(multisigPda), `${e.name} signed by ${e.authority}`);
      if (e.multisig) assert.ok(e.multisig.equals(multisigPda), `${e.name} multisig`);
    });
  }

  function configTransactionFlow(multisigPda: PublicKey, transactionIndex: bigint) {
    const member = members.almighty.publicKey;
    return [
      multisig.instructions.configTransactionCreate({
        multisigPda,
        transactionIndex,
        creator: member,
        actions: [{ __kind: "ChangeThreshold", newThreshold: 1 }],
        programId,
      }),
      multisig.instructions.proposalCreate({ multisigPda, transactionIndex, creator: member, programId }),
      multisig.instructions.proposalApprove({ multisigPda, transactionIndex, member, programId }),
      multisig.instructions.configTransactionExecute({
        multisigPda,
        transactionIndex,
        member,
        rentPayer: member,
        programId,
      }),
    ];
  }

  it("emits nothing without the event account", async () => {
    // Arrange
    const [multisigPda] = await createAutonomousMultisig({
      connection,
      members,
      threshold: 1,
      timeLock: 0,
      programId,
    });

    // Act
    const signature = await send(configTransactionFlow(multisigPda, 1n), [members.almighty]);

    // Assert
    const { events } = await eventsOf(signature);
    assert.deepStrictEqual(events, []);
  });

  it("emits create, vote and execute events of a config transaction", async () => {
    // Arrange
    const [multisigPda] = await createAutonomousMultisig({
      connection,
      members,
      threshold: 1,
      timeLock: 0,
      programId,
    });

    // Act
    const signature = await send(configTransactionFlow(multisigPda, 1n).map(withEvents), [members.almighty]);

    // Assert
    const { events } = await eventsOf(signature);
    assertEvents(
      events,
      [
        "Transaction:Create",
        "Proposal:Create",
        "Proposal:Approve",
        "MultisigConfig",
        "Transaction:Execute",
        "Proposal:Execute",
      ],
      multisigPda
    );
  });

  it("emits MultisigCreate signed by the new multisig", async () => {
    // Arrange
    const creator = await generateFundedKeypair(connection);
    const createKey = Keypair.generate();
    const [multisigPda] = multisig.getMultisigPda({ createKey: createKey.publicKey, programId });
    const programConfig = await multisig.accounts.ProgramConfig.fromAccountAddress(
      connection,
      multisig.getProgramConfigPda({ programId })[0]
    );
    const create = multisig.instructions.multisigCreateV2({
      treasury: programConfig.treasury,
      creator: creator.publicKey,
      multisigPda,
      configAuthority: null,
      threshold: 1,
      members: [{ key: members.almighty.publicKey, permissions: Permissions.all() }],
      timeLock: 0,
      createKey: createKey.publicKey,
      rentCollector: null,
      programId,
    });

    // Act
    const signature = await send([withEvents(create)], [creator, createKey]);

    // Assert
    const { events } = await eventsOf(signature);
    assertEvents(events, ["MultisigCreate"], multisigPda);
  });

  it("emits vault execute events with the event account after the remaining accounts", async () => {
    // Arrange: two approved vault transactions that each send 1 SOL.
    const [multisigPda] = await createAutonomousMultisig({
      connection,
      members,
      threshold: 1,
      timeLock: 0,
      programId,
    });
    const [vaultPda] = multisig.getVaultPda({ multisigPda, index: 0, programId });
    const recipient = Keypair.generate().publicKey;
    await connection.confirmTransaction(await connection.requestAirdrop(vaultPda, 3 * LAMPORTS_PER_SOL));
    const member = members.almighty.publicKey;
    const blockhash = (await connection.getLatestBlockhash()).blockhash;
    for (const transactionIndex of [1n, 2n]) {
      await send(
        [
          multisig.instructions.vaultTransactionCreate({
            multisigPda,
            transactionIndex,
            creator: member,
            vaultIndex: 0,
            ephemeralSigners: 0,
            transactionMessage: new TransactionMessage({
              payerKey: vaultPda,
              recentBlockhash: blockhash,
              instructions: [createTestTransferInstruction(vaultPda, recipient, LAMPORTS_PER_SOL)],
            }),
            programId,
          }),
          multisig.instructions.proposalCreate({ multisigPda, transactionIndex, creator: member, programId }),
          multisig.instructions.proposalApprove({ multisigPda, transactionIndex, member, programId }),
        ],
        [members.almighty]
      );
    }
    const execute = async (transactionIndex: bigint) =>
      (await multisig.instructions.vaultTransactionExecute({ connection, multisigPda, transactionIndex, member, programId }))
        .instruction;

    // Act
    const plain = await eventsOf(await send([await execute(1n)], [members.almighty]));
    const logged = await eventsOf(await send([withEvents(await execute(2n))], [members.almighty]));

    // Assert
    assert.deepStrictEqual(plain.events, []);
    assertEvents(logged.events, ["Transaction:Execute", "Proposal:Execute"], multisigPda);
    assert.strictEqual(await connection.getBalance(recipient), 2 * LAMPORTS_PER_SOL);
    assert.ok(logged.computeUnits > plain.computeUnits);
    console.log(`      vault_transaction_execute CU: ${plain.computeUnits} without events, ${logged.computeUnits} with events`);
  });

  it("emits batch events, including the proposal execute after the last transaction", async () => {
    // Arrange
    const [multisigPda] = await createAutonomousMultisig({
      connection,
      members,
      threshold: 1,
      timeLock: 0,
      programId,
    });
    const [vaultPda] = multisig.getVaultPda({ multisigPda, index: 0, programId });
    await connection.confirmTransaction(await connection.requestAirdrop(vaultPda, 2 * LAMPORTS_PER_SOL));
    const member = members.almighty.publicKey;
    const batchIndex = 1n;
    const blockhash = (await connection.getLatestBlockhash()).blockhash;
    const setup = await send(
      [
        multisig.instructions.batchCreate({ multisigPda, creator: member, batchIndex, vaultIndex: 0, programId }),
        multisig.instructions.proposalCreate({
          multisigPda,
          transactionIndex: batchIndex,
          creator: member,
          isDraft: true,
          programId,
        }),
        multisig.instructions.batchAddTransaction({
          multisigPda,
          member,
          batchIndex,
          vaultIndex: 0,
          transactionIndex: 1,
          ephemeralSigners: 0,
          transactionMessage: new TransactionMessage({
            payerKey: vaultPda,
            recentBlockhash: blockhash,
            instructions: [createTestTransferInstruction(vaultPda, member, LAMPORTS_PER_SOL / 2)],
          }),
          programId,
        }),
        multisig.instructions.proposalActivate({ multisigPda, transactionIndex: batchIndex, member, programId }),
        multisig.instructions.proposalApprove({ multisigPda, transactionIndex: batchIndex, member, programId }),
      ].map(withEvents),
      [members.almighty]
    );
    const { instruction } = await multisig.instructions.batchExecuteTransaction({
      connection,
      multisigPda,
      member,
      batchIndex,
      transactionIndex: 1,
      programId,
    });

    // Act
    const execute = await send([withEvents(instruction)], [members.almighty]);

    // Assert
    assertEvents(
      (await eventsOf(setup)).events,
      ["Transaction:Create", "Proposal:Create", "BatchTransaction:Add", "Proposal:Activate", "Proposal:Approve"],
      multisigPda
    );
    assertEvents((await eventsOf(execute)).events, ["BatchTransaction:Execute", "Proposal:Execute"], multisigPda);
  });

  it("emits spending limit add and use events", async () => {
    // Arrange: a controlled multisig whose config authority adds a SOL spending limit.
    const authority = members.almighty;
    const [multisigPda] = await createControlledMultisig({
      connection,
      configAuthority: authority.publicKey,
      members,
      threshold: 1,
      timeLock: 0,
      programId,
    });
    const [vaultPda] = multisig.getVaultPda({ multisigPda, index: 0, programId });
    await connection.confirmTransaction(await connection.requestAirdrop(vaultPda, 2 * LAMPORTS_PER_SOL));
    const createKey = Keypair.generate().publicKey;
    const [spendingLimit] = multisig.getSpendingLimitPda({ multisigPda, createKey, programId });
    const destination = Keypair.generate().publicKey;

    // Act
    const add = await send(
      [
        withEvents(
          multisig.instructions.multisigAddSpendingLimit({
            multisigPda,
            spendingLimit,
            configAuthority: authority.publicKey,
            rentPayer: authority.publicKey,
            createKey,
            vaultIndex: 0,
            mint: PublicKey.default,
            amount: BigInt(LAMPORTS_PER_SOL),
            period: multisig.types.Period.OneTime,
            members: [authority.publicKey],
            destinations: [destination],
            programId,
          })
        ),
      ],
      [authority]
    );
    const use = await send(
      [
        withEvents(
          multisig.instructions.spendingLimitUse({
            multisigPda,
            member: authority.publicKey,
            spendingLimit,
            vaultIndex: 0,
            amount: LAMPORTS_PER_SOL / 2,
            decimals: 9,
            destination,
            programId,
          })
        ),
      ],
      [authority]
    );

    // Assert
    assertEvents((await eventsOf(add)).events, ["SpendingLimit:Add"], multisigPda);
    assertEvents((await eventsOf(use)).events, ["SpendingLimitUse"], multisigPda);
    assert.strictEqual(await connection.getBalance(destination), LAMPORTS_PER_SOL / 2);
  });

  it("drops the snapshot of an event over 10 KiB and still emits it", async () => {
    // Arrange: a controlled multisig with 315 members, so its snapshot is about 10.5 KB.
    const authority = members.almighty;
    const [multisigPda] = await createControlledMultisig({
      connection,
      configAuthority: authority.publicKey,
      members,
      threshold: 1,
      timeLock: 0,
      programId,
    });
    const addMember = () =>
      multisig.instructions.multisigAddMember({
        multisigPda,
        configAuthority: authority.publicKey,
        rentPayer: authority.publicKey,
        newMember: { key: Keypair.generate().publicKey, permissions: Permissions.fromPermissions([Permission.Vote]) },
        programId,
      });
    // Above about 250 members, add_member needs more than the default 32 KiB heap, events or not.
    const budget = [
      ComputeBudgetProgram.setComputeUnitLimit({ units: 1_400_000 }),
      ComputeBudgetProgram.requestHeapFrame({ bytes: 256 * 1024 }),
    ];
    for (let batch = 0; batch < 31; batch++) {
      await send([...budget, ...Array.from({ length: 10 }, addMember)], [authority]);
    }

    // Act
    const signature = await send([...budget, withEvents(addMember())], [authority]);

    // Assert: the event goes out; its snapshot, the last field, is None.
    const { events } = await eventsOf(signature);
    assertEvents(events, ["MultisigConfig"], multisigPda);
    const [{ event }] = events;
    assert.ok(event.length < 200, `event is ${event.length} bytes`);
    assert.strictEqual(event[event.length - 1], 0);
  });

  it("rejects a program-owned keypair without account data as log authority", async () => {
    // Arrange: the smart-account attack. A keypair gets data space and the program as owner.
    const payer = await generateFundedKeypair(connection);
    const fake = Keypair.generate();
    const space = 200;
    await send(
      [
        SystemProgram.createAccount({
          fromPubkey: payer.publicKey,
          newAccountPubkey: fake.publicKey,
          lamports: await connection.getMinimumBalanceForRentExemption(space),
          space,
          programId,
        }),
      ],
      [payer, fake]
    );
    const logEvent = new TransactionInstruction({
      programId,
      keys: [{ pubkey: fake.publicKey, isSigner: true, isWritable: false }],
      data: Buffer.concat([LOG_EVENT, Buffer.alloc(4)]),
    });

    // Act + Assert: the account check rejects it, before the stack-height check.
    await assert.rejects(
      () => send([logEvent], [payer, fake]),
      (err: unknown) =>
        ((err as { logs?: string[] }).logs ?? []).some(
          (line) => line.includes("caused by account: log_authority") && line.includes("ProtectedInstruction")
        )
    );
  });

  it("rejects a top-level log_event call", async () => {
    // Arrange
    const payer = await generateFundedKeypair(connection);
    const logEvent = new TransactionInstruction({
      programId,
      keys: [{ pubkey: payer.publicKey, isSigner: true, isWritable: false }],
      data: Buffer.concat([LOG_EVENT, Buffer.alloc(4)]),
    });

    // Act + Assert: 6045 = ProtectedInstruction.
    await assert.rejects(() => send([logEvent], [payer]), /0x179d/);
  });

  it("rejects a vault transaction that calls log_event", async () => {
    // Arrange
    const [multisigPda] = await createAutonomousMultisig({
      connection,
      members,
      threshold: 1,
      timeLock: 0,
      programId,
    });
    const [vaultPda] = multisig.getVaultPda({ multisigPda, index: 0, programId });
    const member = members.almighty.publicKey;
    const transactionIndex = 1n;
    const logEvent = new TransactionInstruction({
      programId,
      keys: [{ pubkey: multisigPda, isSigner: false, isWritable: false }],
      data: Buffer.concat([LOG_EVENT, Buffer.alloc(4)]),
    });
    await send(
      [
        multisig.instructions.vaultTransactionCreate({
          multisigPda,
          transactionIndex,
          creator: member,
          vaultIndex: 0,
          ephemeralSigners: 0,
          transactionMessage: new TransactionMessage({
            payerKey: vaultPda,
            recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
            instructions: [logEvent],
          }),
          programId,
        }),
        multisig.instructions.proposalCreate({ multisigPda, transactionIndex, creator: member, programId }),
        multisig.instructions.proposalApprove({ multisigPda, transactionIndex, member, programId }),
      ],
      [members.almighty]
    );
    const { instruction } = await multisig.instructions.vaultTransactionExecute({
      connection,
      multisigPda,
      transactionIndex,
      member,
      programId,
    });

    // Act + Assert
    await assert.rejects(() => send([instruction], [members.almighty]), /0x179d/);
  });
});
