import {
  Connection,
  PublicKey,
  TransactionInstruction,
  TransactionMessage,
} from "@solana/web3.js";
import { getBatchTransactionPda, getTransactionPda } from "..";
import { Batch, PROGRAM_ID, VaultBatchTransaction } from "../generated";
import {
  addBatchTransactionCore,
  createBatchCore,
  executeBatchTransactionCore,
} from "./common/transaction";
import {
  BatchMethods,
  CreateBatchActionArgs,
  CreateBatchResult,
} from "./common/types";
import { BaseTransactionBuilder } from "./common/baseTransaction";
import {
  createApprovalCore,
  createProposalCore,
  createRejectionCore,
} from "./common/proposal";

/**
 * Builds an instruction to create a new {@link Batch},
 * with the option to chain additional methods for adding transactions, adding proposals, voting, building transactions, and sending.
 *
 * @args  {@link CreateBatchActionArgs}
 * @returns - {@link BatchBuilder} or if awaited {@link CreateBatchResult}
 *
 * @example
 * const batchBuilder = createBatch({
 *   connection,
 *   creator: creator,
 *   multisig: multisigPda,
 *   // Can also include vaultIndex, rentPayer, programId, and memo.
 * });
 *
 * // Chain proposal creations, and votes
 * await batchBuilder.withProposal({ isDraft: true });
 * await batchBuilder.withApproval();
 *
 * // Get instructions and the computed transaction indexes.
 * const instructions = batchBuilder.getInstructions();
 * const index = batchBuilder.getIndex();
 * const innerIndex = batchBuilder.getInnerIndex();
 *
 * @example
 * // Run the builder async to get the result immediately.
 * const result = await createBatch({
 *   connection,
 *   creator: creator,
 *   multisig: multisigPda,
 * });
 *
 * @example
 * // Using the `transaction()` method:
 * const transaction = await createBatch({
 *   // ... args
 * }).transaction();
 *
 * @example
 * // Using the `send()` or `sendAndConfirm()` methods:
 * const signature = await createBatch({
 *   // ... args
 * }).sendAndConfirm({
 *   // Options for fee-payer, pre/post instructions, and signers.
 *   signers: [signer1, signer2],
 *   options: { skipPreflight: true },
 * });
 *
 * @throws Will throw an error if required parameters are missing or invalid.
 *
 * @since 2.1.4
 */
export function createBatch(args: CreateBatchActionArgs): BatchBuilder {
  return new BatchBuilder(args);
}

class BatchBuilder extends BaseTransactionBuilder<
  CreateBatchResult,
  CreateBatchActionArgs
> {
  public instructions: TransactionInstruction[] = [];
  public index: number = 1;
  public innerIndex: number = 1;

  constructor(args: CreateBatchActionArgs) {
    super(args);
  }

  protected async build() {
    const {
      multisig,
      vaultIndex = 0,
      rentPayer = this.creator,
      memo,
      programId = PROGRAM_ID,
    } = this.args;
    const result = await createBatchCore({
      connection: this.connection,
      multisig,
      creator: this.creator,
      vaultIndex,
      rentPayer,
      memo,
      programId,
    });

    this.instructions = [...result.instructions];
    this.index = result.index;
  }

  /**
   * Fetches the current index of transactions inside of the {@link Batch} account.
   * @returns `Promise<number>`
   */
  async getInnerIndex(): Promise<number> {
    this.ensureBuilt();

    return this.innerIndex;
  }

  /**
   * Fetches the PublicKey of the built {@link Batch} account.
   * @returns `Promise<PublicKey>` - PublicKey of the `Batch` account.
   */
  async getBatchKey(): Promise<PublicKey> {
    this.ensureBuilt();
    const index = this.index;
    const [batchPda] = getTransactionPda({
      multisigPda: this.args.multisig,
      index: BigInt(index ?? 1),
      programId: this.args.programId ?? PROGRAM_ID,
    });

    return batchPda;
  }

  /**
   * Fetches the PublicKey of a transaction inside of the built {@link Batch} account.
   * @args `innerIndex` - Number denoting the index of the transaction inside of the batch.
   * @returns `Promise<PublicKey>` - PublicKey of the `VaultBatchTransaction` account.
   */
  async getBatchTransactionKey(innerIndex?: number): Promise<PublicKey> {
    this.ensureBuilt();
    const index = this.index;
    const [batchPda] = getBatchTransactionPda({
      multisigPda: this.args.multisig,
      batchIndex: BigInt(index ?? 1),
      transactionIndex: innerIndex ?? this.innerIndex,
      programId: this.args.programId ?? PROGRAM_ID,
    });

    return batchPda;
  }

  /**
   * Fetches and returns an array of PublicKeys for all transactions added to the batch.
   * @returns `Promise<PublicKey[]>`
   */
  async getAllBatchTransactionKeys(): Promise<PublicKey[]> {
    this.ensureBuilt();
    const index = this.index;
    const transactions = [];
    for (let i = 1; i <= this.innerIndex; i++) {
      const [batchPda] = getBatchTransactionPda({
        multisigPda: this.args.multisig,
        batchIndex: BigInt(index ?? 1),
        transactionIndex: i,
        programId: this.args.programId ?? PROGRAM_ID,
      });

      transactions.push(batchPda);
    }

    return transactions;
  }

  /**
   * Fetches and deserializes the {@link Batch} account after it is built and sent.
   * @args `key` - The public key of the `Batch` account.
   * @returns `Batch` - Deserialized `Batch` account data.
   */
  async getBatchAccount(
    key: PublicKey
  ): Promise<Pick<BatchBuilder, BatchMethods<"getBatchAccount">>> {
    this.ensureBuilt();
    const batchAccount = await Batch.fromAccountAddress(this.connection, key);

    return batchAccount;
  }

  /**
   * Fetches and deserializes a {@link VaultBatchTransaction} account after it is added to the `Batch`.
   * @args `key` - The public key of the `Batch` account.
   * @returns `VaultBatchTransaction` - Deserialized `VaultBatchTransaction` account data.
   */
  async getBatchTransactionAccount(
    key: PublicKey
  ): Promise<Pick<BatchBuilder, BatchMethods<"getBatchAccount">>> {
    this.ensureBuilt();
    const batchTxAccount = await VaultBatchTransaction.fromAccountAddress(
      this.connection,
      key
    );

    return batchTxAccount;
  }

  /**
   * Pushes a `batchAddTransaction` instruction to the builder. Increments the batch's inner index.
   * @args `{ message: TransactionMessage, member?: PublicKey, ephemeralSigners?: number }` - Specify the `TransactionMessage` to add to the batch, the member conducting the action, and the number of ephemeral signers to include.
   * @returns `VersionedTransaction` with the `vaultTransactionCreate` instruction.
   */
  async addTransaction({
    message,
    member,
    ephemeralSigners,
  }: {
    message: TransactionMessage;
    member?: PublicKey;
    ephemeralSigners?: number;
  }): Promise<Pick<BatchBuilder, BatchMethods<"addTransaction">>> {
    this.ensureBuilt();
    const { instruction } = await addBatchTransactionCore({
      multisig: this.args.multisig,
      member: member ?? this.creator,
      globalIndex: this.index,
      innerIndex: this.innerIndex,
      message,
      vaultIndex: this.vaultIndex,
      ephemeralSigners: ephemeralSigners ?? 0,
      programId: this.args.programId,
    });

    this.instructions.push(instruction);

    this.innerIndex++;

    return this;
  }

  /**
   * Pushes a `proposalCreate` instruction to the builder.
   * @args `isDraft` - **(Optional)** Whether the proposal is a draft or not, defaults to `false`.
   */
  async withProposal({ isDraft }: { isDraft?: boolean } = {}): Promise<
    Pick<BatchBuilder, BatchMethods<"withProposal">>
  > {
    this.ensureBuilt();
    const { instruction } = createProposalCore({
      multisig: this.args.multisig,
      creator: this.creator,
      transactionIndex: this.index,
      programId: this.args.programId,
      isDraft: isDraft ?? false,
    });

    this.instructions.push(instruction);

    return this;
  }

  /**
   * Pushes a `proposalApprove` instruction to the builder.
   * @args `member` - **(Optional)** Specify the approving member, will default to the creator.
   */
  withApproval({ member }: { member?: PublicKey } = {}): Pick<
    BatchBuilder,
    BatchMethods<"withApproval">
  > {
    const { instruction } = createApprovalCore({
      multisig: this.args.multisig,
      member: member ?? this.creator,
      transactionIndex: this.index,
      programId: this.args.programId,
    });

    this.instructions.push(instruction);

    return this;
  }

  /**
   * Pushes a `proposalReject` instruction to the builder.
   * @args `member` - **(Optional)** Specify the rejecting member, will default to the creator.
   */
  withRejection({ member }: { member?: PublicKey } = {}): Pick<
    BatchBuilder,
    BatchMethods<"withRejection">
  > {
    const { instruction } = createRejectionCore({
      multisig: this.args.multisig,
      member: member ?? this.creator,
      transactionIndex: this.index,
      programId: this.args.programId,
    });

    this.instructions.push(instruction);

    return this;
  }

  /**
   * Pushes a `vaultTransactionExecute` instruction to the builder.
   * @args `member` - **(Optional)** Specify the executing member, will default to the creator.
   */
  async withExecute({ member }: { member?: PublicKey } = {}): Promise<
    Pick<BatchBuilder, BatchMethods<"withExecute">>
  > {
    await this.ensureBuilt();
    const { instruction } = await executeBatchTransactionCore({
      connection: this.connection,
      multisig: this.args.multisig,
      member: member ?? this.creator,
      index: this.index,
      programId: this.args.programId,
    });

    this.instructions.push(instruction);

    return this;
  }
}

/**
 * Attempts to fetch and deserialize the {@link Batch} account, and returns a boolean indicating if it was successful.
 * @args `connection: Connection, key: PublicKey` - Specify a cluster connection, and the `PublicKey` of the `Batch` account.
 */
export async function isBatch(connection: Connection, key: PublicKey) {
  try {
    await Batch.fromAccountAddress(connection, key);
    return true;
  } catch (err) {
    return false;
  }
}

/**
 * Attempts to fetch and deserialize the {@link VaultBatchTransaction} account, and returns a boolean indicating if it was successful.
 * @args `connection: Connection, key: PublicKey` - Specify a cluster connection, and the `PublicKey` of the `VaultBatchTransaction` account.
 */
export async function isBatchTransaction(
  connection: Connection,
  key: PublicKey
) {
  try {
    await VaultBatchTransaction.fromAccountAddress(connection, key);
    return true;
  } catch (err) {
    return false;
  }
}
