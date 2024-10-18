import {
  Connection,
  PublicKey,
  TransactionInstruction,
  TransactionMessage,
  AddressLookupTableAccount,
} from "@solana/web3.js";
import {
  instructions,
  accounts,
  getBatchTransactionPda,
  getTransactionPda,
} from "..";
import { Batch, PROGRAM_ID, VaultBatchTransaction } from "../generated";
import {
  BaseBuilder,
  createApprovalCore,
  createRejectionCore,
  createProposalCore,
  BaseBuilderArgs,
  BuildResult,
} from "./common";
import { BatchMethods } from "./actionTypes";

interface CreateBatchActionArgs extends BaseBuilderArgs {
  /** The public key of the multisig config account */
  multisig: PublicKey;
  /** Index of the vault to target. Defaults to 0 */
  vaultIndex?: number;
  /** The public key of the fee payer, defaults to the creator */
  rentPayer?: PublicKey;
  /** Optional memo for indexing purposes */
  memo?: string;
  /** Optional program ID (defaults to Solana mainnet-beta/devnet Program ID) */
  programId?: PublicKey;
}

interface CreateBatchResult extends BuildResult {
  /** Transaction index of the resulting VaultTransaction */
  index: number;
}

interface BatchAddTransactionActionArgs {
  /** The public key of the multisig config account */
  multisig: PublicKey;
  /** Member who is executing the transaction */
  member: PublicKey;
  /** Transaction index of the Batch created. */
  globalIndex: number;
  /** Local transaction index of a transaction inside of the Batch. */
  innerIndex: number;
  /** Transaction message containing the instructions to execute */
  message: TransactionMessage;
  /** Index of the vault to target. Defaults to 0 */
  vaultIndex?: number;
  /** Specify a number of ephemeral signers to include.
   * Useful if the underlying transaction requires more than one signer.
   */
  ephemeralSigners?: number;
  /** Optional memo for indexing purposes */
  memo?: string;
  /** Optional program ID (defaults to Solana mainnet-beta/devnet Program ID) */
  programId?: PublicKey;
}

interface BatchAddTransactionResult {
  /** `batchAddTransaction` instruction */
  instruction: TransactionInstruction;
}

interface ExecuteBatchActionArgs {
  /** The connection to an SVM network cluster */
  connection: Connection;
  /** The public key of the multisig config account */
  multisig: PublicKey;
  /** Member who is executing the transaction */
  member: PublicKey;
  /** Transaction index of the VaultTransaction to execute */
  index: number;
  /** Optional memo for indexing purposes */
  memo?: string;
  /** Optional program ID (defaults to Solana mainnet-beta/devnet Program ID) */
  programId?: PublicKey;
}

interface ExecuteBatchResult {
  /** `vaultTransactionExecute` instruction */
  instruction: TransactionInstruction;
  /** AddressLookupTableAccounts for the transaction */
  lookupTableAccounts: AddressLookupTableAccount[];
}

/**
 * Builds an instruction to create a new VaultTransaction and returns the instruction with the corresponding transaction index.
 * Can optionally chain additional methods for transactions, and sending.
 *
 * @param args - Object of type `CreateVaultTransactionActionArgs` that contains the necessary information to create a new VaultTransaction.
 * @returns `{ instruction: TransactionInstruction, index: number }` - object with the `vaultTransactionCreate` instruction and the transaction index of the resulting VaultTransaction.
 *
 * @example
 * // Basic usage (no chaining):
 * const result = await createVaultTransaction({
 *   connection,
 *   creator: creatorPublicKey,
 *   threshold: 2,
 *   members: membersList,
 *   timeLock: 3600,
 * });
 * console.log(result.instruction);
 * console.log(result.createKey);
 *
 * @example
 * // Using the transaction() method:
 * const transaction = await createVaultTransaction({
 *   // ... args
 * }).transaction();
 *
 * @example
 * // Using the send() method:
 * const signature = await createVaultTransaction({
 *   // ... args
 * }).send();
 *
 * @throws Will throw an error if required parameters are missing or invalid.
 *
 * @since 2.1.4
 */
export function createBatch(args: CreateBatchActionArgs): BatchBuilder {
  return new BatchBuilder(args);
}

class BatchBuilder extends BaseBuilder<
  CreateBatchResult,
  CreateBatchActionArgs
> {
  public instructions: TransactionInstruction[] = [];
  public index: number = 1;
  public innerIndex: number = 0;

  constructor(args: CreateBatchActionArgs) {
    super(args);
  }

  async build() {
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
    return this;
  }

  getInstructions(): TransactionInstruction[] {
    return this.instructions;
  }

  getIndex(): number {
    return this.index;
  }

  getBatchKey(): PublicKey | null {
    const index = this.index;
    const [batchPda] = getTransactionPda({
      multisigPda: this.args.multisig,
      index: BigInt(index ?? 1),
    });

    return batchPda;
  }

  getBatchTransactionKey(innerIndex: number): PublicKey | null {
    const index = this.index;
    const [batchPda] = getBatchTransactionPda({
      multisigPda: this.args.multisig,
      batchIndex: BigInt(index ?? 1),
      transactionIndex: this.innerIndex ?? 1,
    });

    return batchPda;
  }

  getAllBatchTransactionKeys(localIndex: number): PublicKey[] | null {
    const index = this.index;
    const transactions = [];
    for (let i = 1; i <= localIndex; i++) {
      const [batchPda] = getBatchTransactionPda({
        multisigPda: this.args.multisig,
        batchIndex: BigInt(index ?? 1),
        transactionIndex: i,
      });

      transactions.push(batchPda);
    }

    return transactions;
  }

  async getBatchAccount(
    key: PublicKey
  ): Promise<Pick<BatchBuilder, BatchMethods<"getBatchAccount">>> {
    return this.buildPromise.then(async () => {
      const batchAccount = await Batch.fromAccountAddress(this.connection, key);

      return batchAccount;
    });
  }

  /**
   * Creates a transaction containing the VaultTransaction creation instruction.
   * @args feePayer - Optional signer to pay the transaction fee.
   * @returns `VersionedTransaction` with the `vaultTransactionCreate` instruction.
   */
  async addTransaction(
    message: TransactionMessage,
    member?: PublicKey
  ): Promise<Pick<BatchBuilder, BatchMethods<"addTransaction">>> {
    this.innerIndex++;
    const { instruction } = await addBatchTransactionCore({
      multisig: this.args.multisig,
      member: member ?? this.creator,
      globalIndex: this.index,
      innerIndex: this.innerIndex,
      message,
      // vaultIndex: this.vaultIndex,
      // ephemeralSigners: this.ephemeralSigners,
      programId: this.args.programId,
    });

    this.instructions.push(instruction);

    return this;
  }

  /**
   * Creates a transaction containing the VaultTransaction creation instruction.
   * @args feePayer - Optional signer to pay the transaction fee.
   * @returns `VersionedTransaction` with the `vaultTransactionCreate` instruction.
   */
  withProposal(
    isDraft?: boolean
  ): Pick<BatchBuilder, BatchMethods<"withProposal">> {
    const { instruction } = createProposalCore({
      multisig: this.args.multisig,
      creator: this.creator,
      transactionIndex: this.index,
      programId: this.args.programId,
      isDraft,
    });

    this.instructions.push(instruction);

    return this;
  }

  /**
   * Creates a transaction containing the VaultTransaction creation instruction.
   * @args feePayer - Optional signer to pay the transaction fee.
   * @returns `VersionedTransaction` with the `vaultTransactionCreate` instruction.
   */
  withApproval(
    member?: PublicKey
  ): Pick<BatchBuilder, BatchMethods<"withApproval">> {
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
   * Creates a transaction containing the VaultTransaction creation instruction.
   * @args feePayer - Optional signer to pay the transaction fee.
   * @returns `VersionedTransaction` with the `vaultTransactionCreate` instruction.
   */
  withRejection(
    member?: PublicKey
  ): Pick<BatchBuilder, BatchMethods<"withRejection">> {
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
   * Creates a transaction containing the VaultTransaction creation instruction.
   * @args feePayer - Optional signer to pay the transaction fee.
   * @returns `VersionedTransaction` with the `vaultTransactionCreate` instruction.
   */
  async withExecute(
    member?: PublicKey
  ): Promise<Pick<BatchBuilder, BatchMethods<"withExecute">>> {
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

export async function isBatch(connection: Connection, key: PublicKey) {
  try {
    await Batch.fromAccountAddress(connection, key);
    return true;
  } catch (err) {
    return false;
  }
}

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

async function createBatchCore(
  args: CreateBatchActionArgs
): Promise<CreateBatchResult> {
  const {
    connection,
    multisig,
    creator,
    vaultIndex = 0,
    rentPayer = creator,
    memo,
    programId = PROGRAM_ID,
  } = args;

  const multisigInfo = await accounts.Multisig.fromAccountAddress(
    connection,
    multisig
  );

  const currentTransactionIndex = Number(multisigInfo.transactionIndex);
  const index = BigInt(currentTransactionIndex + 1);

  const ix = instructions.batchCreate({
    multisigPda: multisig,
    batchIndex: index,
    creator: creator,
    vaultIndex: vaultIndex,
    memo: memo,
    rentPayer,
    programId: programId,
  });

  return { instructions: [ix], index: Number(index) };
}

async function addBatchTransactionCore(
  args: BatchAddTransactionActionArgs
): Promise<BatchAddTransactionResult> {
  const {
    multisig,
    globalIndex,
    innerIndex,
    message,
    vaultIndex,
    ephemeralSigners,
    member,
    programId = PROGRAM_ID,
  } = args;
  const ix = instructions.batchAddTransaction({
    multisigPda: multisig,
    member: member,
    batchIndex: BigInt(globalIndex),
    transactionIndex: innerIndex,
    transactionMessage: message,
    vaultIndex: vaultIndex ?? 0,
    ephemeralSigners: ephemeralSigners ?? 0,
    programId: programId,
  });

  return { instruction: ix };
}

async function executeBatchTransactionCore(
  args: ExecuteBatchActionArgs
): Promise<ExecuteBatchResult> {
  const { connection, multisig, index, member, programId = PROGRAM_ID } = args;
  const ix = instructions.batchExecuteTransaction({
    connection,
    multisigPda: multisig,
    member: member,
    batchIndex: BigInt(index),
    transactionIndex: index,
    programId: programId,
  });

  return { ...ix };
}
