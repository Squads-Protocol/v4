import {
  Connection,
  PublicKey,
  SendOptions,
  Signer,
  TransactionInstruction,
  TransactionMessage,
  TransactionSignature,
  VersionedTransaction,
} from "@solana/web3.js";
import { PROGRAM_ID, instructions } from "..";

export interface BaseBuilderArgs {
  connection: Connection;
  creator: PublicKey;
}

export interface BuildResult {
  instructions: TransactionInstruction[];
}

export abstract class BaseBuilder<
  T extends BuildResult,
  U extends BaseBuilderArgs = BaseBuilderArgs
> {
  protected connection: Connection;
  protected instructions: TransactionInstruction[] = [];
  protected creator: PublicKey = PublicKey.default;
  protected buildPromise: Promise<T>;
  protected args: Omit<U, keyof BaseBuilderArgs>;

  constructor(args: U) {
    this.connection = args.connection;
    this.creator = args.creator;
    this.args = this.extractAdditionalArgs(args);
    this.buildPromise = this.build();
  }

  private extractAdditionalArgs(args: U): Omit<U, keyof BaseBuilderArgs> {
    const { connection, creator, ...additionalArgs } = args;
    return additionalArgs;
  }

  protected abstract build(): Promise<T>;

  /**
   * Creates a transaction containing the corresponding instruction(s).
   * @args feePayer - Optional signer to pay the transaction fee.
   * @returns `VersionedTransaction`.
   */
  async transaction(feePayer?: Signer): Promise<VersionedTransaction> {
    return this.buildPromise.then(async () => {
      const message = new TransactionMessage({
        payerKey: feePayer?.publicKey ?? this.creator!,
        recentBlockhash: (await this.connection.getLatestBlockhash()).blockhash,
        instructions: [...this.instructions!],
      }).compileToV0Message();

      const tx = new VersionedTransaction(message);
      if (feePayer) {
        tx.sign([feePayer]);
      }
      return tx;
    });
  }

  /**
   * Builds a transaction with the corresponding instruction(s), and sends it.
   * @args feePayer - Optional signer to pay the transaction fee.
   * @returns `TransactionSignature`
   */
  async send(
    feePayer?: Signer,
    options?: SendOptions
  ): Promise<TransactionSignature> {
    return this.buildPromise.then(async () => {
      const message = new TransactionMessage({
        payerKey: feePayer?.publicKey ?? this.creator!,
        recentBlockhash: (await this.connection.getLatestBlockhash()).blockhash,
        instructions: [...this.instructions],
      }).compileToV0Message();

      const tx = new VersionedTransaction(message);
      if (feePayer) {
        tx.sign([feePayer]);
      }
      const signature = await this.connection.sendTransaction(tx, options);
      return signature;
    });
  }

  /**
   * Builds a transaction with the corresponding instruction(s), sends it, and confirms the transaction.
   * @args feePayer - Optional signer to pay the transaction fee.
   * @returns `TransactionSignature`
   */
  async sendAndConfirm(
    feePayer?: Signer,
    options?: SendOptions
  ): Promise<TransactionSignature> {
    return this.buildPromise.then(async () => {
      const message = new TransactionMessage({
        payerKey: feePayer?.publicKey ?? this.creator!,
        recentBlockhash: (await this.connection.getLatestBlockhash()).blockhash,
        instructions: [...this.instructions],
      }).compileToV0Message();

      const tx = new VersionedTransaction(message);
      if (feePayer) {
        tx.sign([feePayer]);
      }
      const signature = await this.connection.sendTransaction(tx, options);
      await this.connection.getSignatureStatuses([signature]);
      return signature;
    });
  }

  then<TResult1 = T, TResult2 = never>(
    onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this.buildPromise.then(onfulfilled, onrejected);
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

export async function createProposalCore(
  args: CreateProposalActionArgs
): Promise<ProposalResult> {
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

export async function createApprovalCore(
  args: VoteActionArgs
): Promise<ProposalResult> {
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

export async function createRejectionCore(
  args: VoteActionArgs
): Promise<ProposalResult> {
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
