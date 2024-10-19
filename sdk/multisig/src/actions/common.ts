import {
  Connection,
  Keypair,
  PublicKey,
  SendOptions,
  Signer,
  TransactionInstruction,
  TransactionMessage,
  TransactionSignature,
  VersionedTransaction,
} from "@solana/web3.js";
import {
  PROGRAM_ID,
  getProposalPda,
  getTransactionPda,
  instructions,
} from "..";
import { Proposal, VaultTransaction } from "../accounts";

export interface BaseBuilderArgs {
  /** The connection to an SVM network cluster */
  connection: Connection;
  /** The public key of the creator */
  creator: PublicKey;
}

export interface BuildResult {
  instructions: TransactionInstruction[];
}

export abstract class BaseBuilder<
  T extends BuildResult,
  U extends BaseBuilderArgs = BaseBuilderArgs
> {
  public createKey: Keypair;
  protected connection: Connection;
  protected instructions: TransactionInstruction[] = [];
  protected creator: PublicKey = PublicKey.default;
  protected buildPromise: Promise<void>;
  protected args: Omit<U, keyof BaseBuilderArgs>;
  private built: boolean = false;
  // Use this as an indicator to clear all instructions?
  private sent: boolean = false;

  constructor(args: U) {
    this.connection = args.connection;
    this.creator = args.creator;
    this.args = this.extractAdditionalArgs(args);
    this.createKey = Keypair.generate();
    this.buildPromise = this.initializeBuild();
  }

  private async initializeBuild(): Promise<void> {
    await this.build();
    this.built = true;
  }

  protected async ensureBuilt(): Promise<void> {
    if (!this.built) {
      await this.buildPromise;
    }
  }

  private extractAdditionalArgs(args: U): Omit<U, keyof BaseBuilderArgs> {
    const { connection, creator, ...additionalArgs } = args;
    return additionalArgs;
  }

  protected abstract build(): Promise<void>;

  getInstructions(): TransactionInstruction[] {
    return this.instructions;
  }

  /**
   * Creates a transaction containing the corresponding instruction(s).
   *
   * @args `feePayer` - Optional signer to pay the transaction fee.
   * @returns `VersionedTransaction`
   *
   * @example
   * // Get pre-built transaction from builder instance.
   * const builder = createMultisig({
   *   // ... args
   * });
   * const transaction = await builder.transaction();
   * @example
   * // Run chained async method to return the
   * // transaction all in one go.
   * const transaction = await createMultisig({
   *   // ... args
   * }).transaction();
   *
   */
  async transaction(feePayer?: Signer): Promise<VersionedTransaction> {
    await this.ensureBuilt();
    const message = new TransactionMessage({
      payerKey: feePayer?.publicKey ?? this.creator,
      recentBlockhash: (await this.connection.getLatestBlockhash()).blockhash,
      instructions: [...this.instructions],
    }).compileToV0Message();

    const tx = new VersionedTransaction(message);
    if (feePayer) {
      tx.sign([feePayer]);
    }
    return tx;
  }

  /**
   * Builds a transaction with the corresponding instruction(s), and sends it.
   *
   * **NOTE: Not wallet-adapter compatible.**
   *
   * @args `settings` - Optional pre/post instructions, fee payer keypair, and send options.
   * @returns `TransactionSignature`
   */
  async send(settings?: {
    preInstructions?: TransactionInstruction[];
    postInstructions?: TransactionInstruction[];
    feePayer?: Signer;
    signers?: Signer[];
    options?: SendOptions;
  }): Promise<TransactionSignature> {
    await this.ensureBuilt();
    const instructions = [...this.instructions];
    if (settings?.preInstructions) {
      instructions.unshift(...settings.preInstructions);
    }
    if (settings?.postInstructions) {
      instructions.push(...settings.postInstructions);
    }
    const message = new TransactionMessage({
      payerKey: settings?.feePayer?.publicKey ?? this.creator,
      recentBlockhash: (await this.connection.getLatestBlockhash()).blockhash,
      instructions: [...instructions],
    }).compileToV0Message();

    const tx = new VersionedTransaction(message);
    if (settings?.feePayer) {
      tx.sign([settings.feePayer]);
    }
    if (settings?.signers) {
      tx.sign([...settings.signers]);
    }
    const signature = await this.connection.sendTransaction(
      tx,
      settings?.options
    );
    this.sent = true;

    return signature;
  }

  /**
   * Builds a transaction with the corresponding instruction(s), sends it, and confirms the transaction.
   *
   * **NOTE: Not wallet-adapter compatible.**
   *
   * @args `settings` - Optional pre/post instructions, fee payer keypair, and send options.
   * @returns `TransactionSignature`
   */
  async sendAndConfirm(settings?: {
    preInstructions?: TransactionInstruction[];
    postInstructions?: TransactionInstruction[];
    feePayer?: Signer;
    signers?: Signer[];
    options?: SendOptions;
  }): Promise<TransactionSignature> {
    await this.ensureBuilt();
    const instructions = [...this.instructions];
    if (settings?.preInstructions) {
      instructions.unshift(...settings.preInstructions);
    }
    if (settings?.postInstructions) {
      instructions.push(...settings.postInstructions);
    }
    const message = new TransactionMessage({
      payerKey: settings?.feePayer?.publicKey ?? this.creator,
      recentBlockhash: (await this.connection.getLatestBlockhash()).blockhash,
      instructions: [...instructions],
    }).compileToV0Message();

    const tx = new VersionedTransaction(message);
    if (settings?.feePayer) {
      tx.sign([settings.feePayer]);
    }
    if (settings?.signers) {
      tx.sign([...settings.signers]);
    }
    const signature = await this.connection.sendTransaction(
      tx,
      settings?.options
    );

    let commitment = settings?.options?.preflightCommitment;

    let sent = false;
    while (sent === false) {
      const status = await this.connection.getSignatureStatuses([signature]);
      if (
        commitment
          ? status.value[0]?.confirmationStatus === commitment
          : status.value[0]?.confirmationStatus === "finalized"
      ) {
        sent = true;
      }
    }
    this.sent = true;

    return signature;
  }

  /**
   * We build a message with the corresponding instruction(s), you give us a callback
   * for post-processing, sending, and confirming.
   *
   * @args `callback` - Async function with `TransactionMessage` as argument, and `TransactionSignature` as return value.
   * @returns `TransactionSignature`
   *
   * @example
   * const txBuilder = createVaultTransaction({
   *     connection,
   *     creator: creator,
   *     message: message
   *     multisig: multisig,
   *     vaultIndex: 0,
   * });
   *
   * await txBuilder
   *     .withProposal()
   *     .withApproval()
   *     .withExecute();
   *
   * const signature = await txBuilder.customSend(
   *     // Callback with transaction message, and your function.
   *     async (msg) => await customSender(msg, connection)
   * );
   */
  async customSend(
    callback: (args: TransactionMessage) => Promise<TransactionSignature>
  ): Promise<TransactionSignature> {
    await this.ensureBuilt();
    const message = new TransactionMessage({
      payerKey: this.creator,
      recentBlockhash: (await this.connection.getLatestBlockhash()).blockhash,
      instructions: [...this.instructions],
    });

    const signature = await callback(message);
    this.sent = true;

    return signature;
  }

  /*
  protected then<TResult1 = T, TResult2 = never>(
    onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this.buildPromise.then(onfulfilled, onrejected);
  }
  */
}

export interface TransactionBuilderArgs extends BaseBuilderArgs {
  multisig: PublicKey;
}

export interface TransactionBuildResult extends BuildResult {
  index: number;
}

export abstract class BaseTransactionBuilder<
  T extends TransactionBuildResult,
  U extends TransactionBuilderArgs
> extends BaseBuilder<T, U> {
  public index: number = 1;

  constructor(args: U) {
    super(args);
  }

  getIndex(): number {
    return this.index;
  }

  /**
   * Fetches the `PublicKey` of the corresponding account for the transaction being built.
   *
   * @returns `PublicKey`
   */
  getTransactionKey(): PublicKey {
    const index = this.index;
    const [transactionPda] = getTransactionPda({
      multisigPda: this.args.multisig,
      index: BigInt(index ?? 1),
    });

    return transactionPda;
  }

  /**
   * Fetches the `PublicKey` of the corresponding proposal account for the transaction being built.
   *
   * @returns `PublicKey`
   */
  getProposalKey(): PublicKey {
    const index = this.index;
    const [proposalPda] = getProposalPda({
      multisigPda: this.args.multisig,
      transactionIndex: BigInt(index ?? 1),
    });

    return proposalPda;
  }

  /**
   * Fetches the `PublicKey` of the corresponding proposal account for the transaction being built.
   *
   * @returns `PublicKey`
   */
  async getTransactionAccount(key: PublicKey) {
    return this.buildPromise.then(async () => {
      const txAccount = await VaultTransaction.fromAccountAddress(
        this.connection,
        key
      );

      return txAccount;
    });
  }

  async getProposalAccount(key: PublicKey) {
    return this.buildPromise.then(async () => {
      const propAccount = await Proposal.fromAccountAddress(
        this.connection,
        key
      );

      return propAccount;
    });
  }
}

export interface CreateProposalActionArgs {
  /** The public key of the multisig config account */
  multisig: PublicKey;
  /** The public key of the creator */
  creator: PublicKey;
  /** Transaction index of the resulting Proposal */
  transactionIndex: number;
  /** The public key of the fee payer, defaults to the creator */
  rentPayer?: PublicKey;
  /** Whether the proposal should be initialized with status `Draft`. */
  isDraft?: boolean;
  /** Optional program ID (defaults to Solana mainnet-beta/devnet Program ID) */
  programId?: PublicKey;
}

export interface VoteActionArgs {
  /** The public key of the multisig config account */
  multisig: PublicKey;
  /** The public key of the approving member */
  member: PublicKey;
  /** Transaction index of the resulting Proposal */
  transactionIndex: number;
  /** Optional program ID (defaults to Solana mainnet-beta/devnet Program ID) */
  programId?: PublicKey;
}

export interface ProposalResult {
  /** `proposalCreate` instruction */
  instruction: TransactionInstruction;
}

export function createProposalCore(
  args: CreateProposalActionArgs
): ProposalResult {
  const {
    multisig,
    creator,
    transactionIndex,
    rentPayer,
    isDraft = false,
    programId = PROGRAM_ID,
  } = args;

  const ix = instructions.proposalCreate({
    multisigPda: multisig,
    transactionIndex: BigInt(transactionIndex),
    creator: creator,
    isDraft,
    rentPayer,
    programId: programId,
  });

  return {
    instruction: ix,
  };
}

export function createApprovalCore(args: VoteActionArgs): ProposalResult {
  const { multisig, member, transactionIndex, programId = PROGRAM_ID } = args;

  const ix = instructions.proposalApprove({
    multisigPda: multisig,
    member: member,
    transactionIndex: BigInt(transactionIndex),
    programId: programId,
  });

  return {
    instruction: ix,
  };
}

export function createRejectionCore(args: VoteActionArgs): ProposalResult {
  const { multisig, member, transactionIndex, programId = PROGRAM_ID } = args;

  const ix = instructions.proposalReject({
    multisigPda: multisig,
    member: member,
    transactionIndex: BigInt(transactionIndex),
    programId: programId,
  });

  return {
    instruction: ix,
  };
}
