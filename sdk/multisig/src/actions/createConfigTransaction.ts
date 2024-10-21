import { Connection, PublicKey, TransactionInstruction } from "@solana/web3.js";
import { ConfigTransaction } from "../generated";
import {
  createConfigTransactionCore,
  executeConfigTransactionCore,
} from "./common/transaction";
import { BaseTransactionBuilder } from "./common/baseTransaction";
import {
  CreateConfigTransactionActionArgs,
  CreateConfigTransactionResult,
  Methods,
} from "./common/types";
import {
  createApprovalCore,
  createProposalCore,
  createRejectionCore,
} from "./common/proposal";

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
   * Pushes a `proposalCreate` instruction to the builder.
   * @args `isDraft` - **(Optional)** Whether the proposal is a draft or not, defaults to `false`.
   */
  async withProposal({ isDraft }: { isDraft?: boolean } = {}): Promise<
    Pick<ConfigTransactionBuilder, Methods<"withProposal">>
  > {
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
   * Pushes a `proposalApprove` instruction to the builder.
   * @args `member` - **(Optional)** Specify the approving member, will default to the creator.
   */
  withApproval({ member }: { member?: PublicKey } = {}): Pick<
    ConfigTransactionBuilder,
    Methods<"withApproval">
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
    ConfigTransactionBuilder,
    Methods<"withRejection">
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
    Pick<ConfigTransactionBuilder, Methods<"withExecute">>
  > {
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
