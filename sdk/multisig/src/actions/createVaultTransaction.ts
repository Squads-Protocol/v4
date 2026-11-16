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
 * Builds an instruction to create a new {@link VaultTransaction},
 * with the option to chain additional methods for adding proposals, voting, building transactions, and sending.
 *
 * @args  {@link CreateVaultTransactionActionArgs}
 * @returns - {@link VaultTransactionBuilder} or if awaited {@link CreateVaultTransactionResult}
 *
 * @example
 * const txBuilder = createVaultTransaction({
 *   connection,
 *   multisig: multisigPda,
 *   creator: creator,
 *   message: message,
 *   // Can also include ephemeral signers, vaultIndex,
 *   // rentPayer, programId, and memo.
 * });
 *
 * // Chain proposal creations, and votes
 * await txBuilder.withProposal();
 * await txBuilder.withApproval();
 *
 * // Get the built instructions and the computed transaction index.
 * const instructions = txBuilder.getInstructions();
 * const index = txBuilder.getIndex();
 *
 * @example
 * // Run the builder async to get the result immediately.
 * const result = await createVaultTransaction({
 *   connection,
 *   multisig: multisigPda,
 *   creator: creator,
 *   message: message,
 * });
 *
 * @example
 * // Using the `transaction()` method:
 * const transaction = await createVaultTransaction({
 *   // ... args
 * }).transaction();
 *
 * @example
 * // Using the `send()` or `sendAndConfirm()` methods:
 * const signature = await createVaultTransaction({
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
   * Fetches deserialized account data for the corresponding {@link VaultTransaction} account after it is built and sent.
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

/**
 * Attempts to fetch and deserialize the {@link VaultTransaction} account, and returns a boolean indicating if it was successful.
 * @args `connection: Connection, key: PublicKey` - Specify a cluster connection, and the `PublicKey` of the `VaultTransaction` account.
 */
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
