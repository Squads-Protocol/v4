import { Connection, PublicKey, TransactionInstruction } from "@solana/web3.js";
import { instructions, accounts } from "..";
import { ConfigAction, ConfigTransaction, PROGRAM_ID } from "../generated";
import {
  BaseTransactionBuilder,
  createApprovalCore,
  createProposalCore,
  createRejectionCore,
} from "./common";
import { Methods } from "./actionTypes";
import { Member } from "../types";

interface CreateConfigTransactionActionArgs {
  /** The connection to an SVM network cluster */
  connection: Connection;
  /** The public key of the multisig config account */
  multisig: PublicKey;
  /** The public key of the creator */
  creator: PublicKey;
  /** Transaction message containing the instructions to execute */
  actions: ConfigAction[];
  /** The public key of the fee payer, defaults to the creator */
  rentPayer?: PublicKey;
  /** Optional memo for indexing purposes */
  memo?: string;
  /** Optional program ID (defaults to Solana mainnet-beta/devnet Program ID) */
  programId?: PublicKey;
}

interface CreateConfigTransactionResult {
  /** `configTransactionCreate` instruction */
  instructions: TransactionInstruction[];
  /** Transaction index of the resulting ConfigTransaction */
  index: number;
}

interface ExecuteConfigTransactionActionArgs {
  /** The public key of the multisig config account */
  multisig: PublicKey;
  /** Member who is executing the transaction */
  member: PublicKey;
  /** Transaction index of the ConfigTransaction to execute */
  index: number;
  /** Optional memo for indexing purposes */
  memo?: string;
  /** Optional program ID (defaults to Solana mainnet-beta/devnet Program ID) */
  programId?: PublicKey;
}

interface ExecuteConfigTransactionResult {
  /** `configTransactionExecute` instruction */
  instruction: TransactionInstruction;
}

/**
 * Builds an instruction to create a new ConfigTransaction and returns the instruction with the corresponding transaction index.
 * Can optionally chain additional methods for transactions, and sending.
 *
 * @param args - Object of type `CreateConfigTransactionActionArgs` that contains the necessary information to create a new ConfigTransaction.
 * @returns `{ instruction: TransactionInstruction, index: number }` - object with the `configTransactionCreate` instruction and the transaction index of the resulting ConfigTransaction.
 *
 * @example
 * // Basic usage (no chaining):
 * const result = await createConfigTransaction({
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
 * const transaction = await createConfigTransaction({
 *   // ... args
 * }).transaction();
 *
 * @example
 * // Using the rpc() method:
 * const signature = await createConfigTransaction({
 *   // ... args
 * }).send();
 *
 * @throws Will throw an error if required parameters are missing or invalid.
 *
 * @since 2.1.4
 */
export function createConfigTransaction(
  args: CreateConfigTransactionActionArgs
): ConfigTransactionBuilder {
  return new ConfigTransactionBuilder(args);
}

class ConfigTransactionBuilder extends BaseTransactionBuilder<
  CreateConfigTransactionResult,
  CreateConfigTransactionActionArgs
> {
  public instructions: TransactionInstruction[] = [];
  public index: number = 1;

  constructor(args: CreateConfigTransactionActionArgs) {
    super(args);
  }

  protected async build() {
    const { multisig, actions, rentPayer, memo, programId } = this.args;
    const result = await createConfigTransactionCore({
      connection: this.connection,
      multisig,
      creator: this.creator,
      actions,
      rentPayer,
      memo,
      programId,
    });

    this.instructions = [...result.instructions];
    this.index = result.index;
  }

  /**
   * Fetches deserialized account data for the corresponding `ConfigTransaction` account after it is built and sent.
   *
   * @returns `ConfigTransaction`
   */
  async getTransactionAccount(key: PublicKey): Promise<ConfigTransaction> {
    this.ensureBuilt();
    const txAccount = await ConfigTransaction.fromAccountAddress(
      this.connection,
      key
    );

    return txAccount;
  }

  /**
   * Creates a transaction containing the ConfigTransaction creation instruction.
   * @args feePayer - Optional signer to pay the transaction fee.
   * @returns `VersionedTransaction` with the `vaultTransactionCreate` instruction.
   */
  async withProposal(
    isDraft?: boolean
  ): Promise<Pick<ConfigTransactionBuilder, Methods<"withProposal">>> {
    await this.ensureBuilt();
    const { instruction } = createProposalCore({
      multisig: this.args.multisig,
      creator: this.creator,
      transactionIndex: this.index,
      isDraft,
      programId: this.args.programId,
    });

    this.instructions.push(instruction);

    return this;
  }

  /**
   * Creates a transaction containing the ConfigTransaction creation instruction.
   * @args feePayer - Optional signer to pay the transaction fee.
   * @returns `VersionedTransaction` with the `vaultTransactionCreate` instruction.
   */
  withApproval(
    member?: PublicKey
  ): Pick<ConfigTransactionBuilder, Methods<"withApproval">> {
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
   * Creates a transaction containing the ConfigTransaction creation instruction.
   * @args feePayer - Optional signer to pay the transaction fee.
   * @returns `VersionedTransaction` with the `vaultTransactionCreate` instruction.
   */
  withRejection(
    member?: PublicKey
  ): Pick<ConfigTransactionBuilder, Methods<"withRejection">> {
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
   * Creates a transaction containing the ConfigTransaction creation instruction.
   * @args feePayer - Optional signer to pay the transaction fee.
   * @returns `VersionedTransaction` with the `vaultTransactionCreate` instruction.
   */
  async withExecute(
    member?: PublicKey
  ): Promise<Pick<ConfigTransactionBuilder, Methods<"withExecute">>> {
    const { instruction } = await executeConfigTransactionCore({
      multisig: this.args.multisig,
      member: member ?? this.creator,
      index: this.index,
      programId: this.args.programId,
    });

    this.instructions.push(instruction);

    return this;
  }

  async reclaimRent() {
    // TODO
  }
}

export async function isConfigTransaction(
  connection: Connection,
  key: PublicKey
) {
  try {
    await ConfigTransaction.fromAccountAddress(connection, key);
    return true;
  } catch (err) {
    return false;
  }
}

export const ConfigActions = {
  AddMember: (newMember: Member) => [
    {
      __kind: "AddMember",
      newMember,
    },
  ],
  RemoveMember: (oldMember: PublicKey) => {
    return {
      __kind: "RemoveMember",
      oldMember,
    } as ConfigAction;
  },
  ChangeThreshold: (newThreshold: number) => {
    return {
      __kind: "ChangeThreshold",
      newThreshold,
    } as ConfigAction;
  },
  SetTimeLock: (newTimeLock: number) => {
    return {
      __kind: "SetTimeLock",
      newTimeLock,
    } as ConfigAction;
  },
  AddSpendingLimit: (spendingLimit: SpendingLimit) => {
    return {
      __kind: "AddSpendingLimit",
      ...spendingLimit,
    } as ConfigAction;
  },
  RemoveSpendingLimit: (spendingLimit: PublicKey) => {
    return {
      __kind: "RemoveSpendingLimit",
      spendingLimit,
    } as ConfigAction;
  },
  SetRentCollector: (rentCollector: PublicKey) => {
    return {
      __kind: "SetRentCollector",
      newRentCollector: rentCollector,
    } as ConfigAction;
  },
} as const;

export interface SpendingLimit {
  createKey: PublicKey;
  vaultIndex: number;
  mint: PublicKey;
  amount: number;
  period: number;
  members: PublicKey[];
  destinations: PublicKey[];
}

async function createConfigTransactionCore(
  args: CreateConfigTransactionActionArgs
): Promise<CreateConfigTransactionResult> {
  const {
    connection,
    multisig,
    creator,
    actions,
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

  const ix = instructions.configTransactionCreate({
    multisigPda: multisig,
    transactionIndex: index,
    creator: creator,
    actions,
    memo: memo,
    rentPayer,
    programId: programId,
  });

  return { instructions: [ix], index: Number(index) };
}

async function executeConfigTransactionCore(
  args: ExecuteConfigTransactionActionArgs
): Promise<ExecuteConfigTransactionResult> {
  const { multisig, index, member, programId = PROGRAM_ID } = args;
  const ix = instructions.configTransactionExecute({
    multisigPda: multisig,
    member: member,
    transactionIndex: BigInt(index),
    programId: programId,
  });

  return { instruction: ix };
}
