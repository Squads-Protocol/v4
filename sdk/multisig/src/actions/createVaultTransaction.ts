import {
  Connection,
  PublicKey,
  TransactionInstruction,
  AddressLookupTableAccount,
} from "@solana/web3.js";
import { PROGRAM_ID, VaultTransaction } from "../generated";
import {
  createVaultTransactionCore,
  executeVaultTransactionCore,
  reclaimRentCore,
} from "./common/transaction";
import {
  CreateVaultTransactionActionArgs,
  CreateVaultTransactionResult,
  Methods,
} from "./common/types";
import { BaseTransactionBuilder } from "./common/baseTransaction";
import {
  createApprovalCore,
  createProposalCore,
  createRejectionCore,
} from "./common/proposal";

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
export function createVaultTransaction(
  args: CreateVaultTransactionActionArgs
): VaultTransactionBuilder {
  return new VaultTransactionBuilder(args);
}

class VaultTransactionBuilder extends BaseTransactionBuilder<
  CreateVaultTransactionResult,
  CreateVaultTransactionActionArgs
> {
  public instructions: TransactionInstruction[] = [];
  public addressLookupTableAccounts: AddressLookupTableAccount[] = [];
  static index: number;

  constructor(args: CreateVaultTransactionActionArgs) {
    super(args);
  }

  protected async build() {
    const {
      multisig,
      message,
      vaultIndex = 0,
      ephemeralSigners = 0,
      rentPayer = this.creator,
      memo,
      programId = PROGRAM_ID,
    } = this.args;
    const result = await createVaultTransactionCore(
      {
        connection: this.connection,
        multisig,
        creator: this.creator,
        message,
        vaultIndex,
        ephemeralSigners,
        rentPayer,
        memo,
        programId,
      },
      this.index
    );

    this.instructions = [...result.instructions];
    this.index = result.index;
  }

  /**
   * Fetches deserialized account data for the corresponding `VaultTransaction` account after it is built and sent.
   *
   * @returns `VaultTransaction`
   */
  async getTransactionAccount(key: PublicKey) {
    this.ensureBuilt();
    const txAccount = await VaultTransaction.fromAccountAddress(
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
    Pick<VaultTransactionBuilder, Methods<"withProposal">>
  > {
    await this.ensureBuilt();
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
   * Pushes a `proposalApprove` instruction to the builder.
   * @args `member` - **(Optional)** Specify the approving member, will default to the creator.
   */
  withApproval({ member }: { member?: PublicKey } = {}): Pick<
    VaultTransactionBuilder,
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
    VaultTransactionBuilder,
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
    Pick<VaultTransactionBuilder, Methods<"withExecute">>
  > {
    await this.ensureBuilt();
    const { instruction, lookupTableAccounts } =
      await executeVaultTransactionCore({
        connection: this.connection,
        multisig: this.args.multisig,
        member: member ?? this.creator,
        index: this.index,
        programId: this.args.programId,
      });

    this.instructions.push(instruction);
    this.addressLookupTableAccounts.push(...lookupTableAccounts);

    return this;
  }

  async reclaimRent(): Promise<
    Pick<VaultTransactionBuilder, Methods<"reclaimRent">>
  > {
    const { instruction } = await reclaimRentCore({
      connection: this.connection,
      multisig: this.args.multisig,
      index: this.index,
      programId: this.args.programId,
    });

    this.instructions.push(instruction);
    return this;
  }
}

export async function isVaultTransaction(
  connection: Connection,
  key: PublicKey
) {
  try {
    await VaultTransaction.fromAccountAddress(connection, key);
    return true;
  } catch (err) {
    return false;
  }
}
