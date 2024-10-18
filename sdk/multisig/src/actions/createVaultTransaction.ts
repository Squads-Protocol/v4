import {
  Connection,
  PublicKey,
  TransactionInstruction,
  TransactionMessage,
  AddressLookupTableAccount,
} from "@solana/web3.js";
import { instructions, accounts } from "..";
import { PROGRAM_ID, VaultTransaction } from "../generated";
import {
  createApprovalCore,
  createRejectionCore,
  createProposalCore,
  BaseTransactionBuilder,
} from "./common";
import { Methods } from "./actionTypes";

interface CreateVaultTransactionActionArgs {
  /** The connection to an SVM network cluster */
  connection: Connection;
  /** The public key of the multisig config account */
  multisig: PublicKey;
  /** The public key of the creator */
  creator: PublicKey;
  /** Transaction message containing the instructions to execute */
  message: TransactionMessage;
  /** Index of the vault to target. Defaults to 0 */
  vaultIndex?: number;
  /** Specify a number of ephemeral signers to include.
   * Useful if the underlying transaction requires more than one signer.
   */
  ephemeralSigners?: number;
  /** The public key of the fee payer, defaults to the creator */
  rentPayer?: PublicKey;
  /** Optional memo for indexing purposes */
  memo?: string;
  /** Optional program ID (defaults to Solana mainnet-beta/devnet Program ID) */
  programId?: PublicKey;
}

interface CreateVaultTransactionResult {
  /** `vaultTransactionCreate` instruction */
  instructions: TransactionInstruction[];
  /** Transaction index of the resulting VaultTransaction */
  index: number;
}

interface ExecuteVaultTransactionActionArgs {
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

interface ExecuteVaultTransactionResult {
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
  public index: number = 1;

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
    const result = await createVaultTransactionCore({
      connection: this.connection,
      multisig,
      creator: this.creator,
      message,
      vaultIndex,
      ephemeralSigners,
      rentPayer,
      memo,
      programId,
    });

    this.instructions = [...result.instructions];
    this.index = result.index;
    return this as VaultTransactionBuilder;
  }

  /**
   * Creates a transaction containing the VaultTransaction creation instruction.
   * @args feePayer - Optional signer to pay the transaction fee.
   * @returns `VersionedTransaction` with the `vaultTransactionCreate` instruction.
   */
  withProposal(
    isDraft?: boolean
  ): Pick<VaultTransactionBuilder, Methods<"withProposal">> {
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
  ): Pick<VaultTransactionBuilder, Methods<"withApproval">> {
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
  ): Pick<VaultTransactionBuilder, Methods<"withRejection">> {
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
  ): Promise<Pick<VaultTransactionBuilder, Methods<"withExecute">>> {
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

async function createVaultTransactionCore(
  args: CreateVaultTransactionActionArgs
): Promise<CreateVaultTransactionResult> {
  const {
    connection,
    multisig,
    creator,
    message,
    vaultIndex = 0,
    ephemeralSigners = 0,
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

  const ix = instructions.vaultTransactionCreate({
    multisigPda: multisig,
    transactionIndex: index,
    creator: creator,
    vaultIndex: vaultIndex,
    ephemeralSigners: ephemeralSigners,
    transactionMessage: message,
    memo: memo,
    rentPayer,
    programId: programId,
  });

  return { instructions: [ix], index: Number(index) };
}

async function executeVaultTransactionCore(
  args: ExecuteVaultTransactionActionArgs
): Promise<ExecuteVaultTransactionResult> {
  const { connection, multisig, index, member, programId = PROGRAM_ID } = args;
  const ix = await instructions.vaultTransactionExecute({
    connection,
    multisigPda: multisig,
    member: member,
    transactionIndex: BigInt(index),
    programId: programId,
  });

  return {
    ...ix,
  };
}

/*
async function Example() {
  const connection = new Connection("https://api.mainnet-beta.solana.com");
  const feePayer = Keypair.generate();
  const txBuilder = createVaultTransaction({
    connection,
    creator: PublicKey.default,
    message: new TransactionMessage({
      payerKey: PublicKey.default,
      recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
      instructions: [
        ComputeBudgetProgram.setComputeUnitLimit({
          units: 200_000,
        }),
      ],
    }),
    multisig: PublicKey.default,
    vaultIndex: 0,
    ephemeralSigners: 0,
    memo: "Transfer 2 SOL to a test account",
    programId: PROGRAM_ID,
  });

  txBuilder.withProposal().withApproval()
  const proposalKey = txBuilder.getProposalKey();
  await txBuilder.withProposal();

  const signature = await txBuilder.customSend(
    async (msg) => await customSender(msg, connection)
  );
  /*
    .sendAndConfirm({
      preInstructions: [
        ComputeBudgetProgram.setComputeUnitLimit({
          units: 200_000,
        }),
      ],
      options: { skipPreflight: true },
    });
}

const customSender = async (
  msg: TransactionMessage,
  connection: Connection
) => {
  const transaction = new VersionedTransaction(msg.compileToV0Message());
  const signature = await connection.sendTransaction(transaction);
  await connection.getSignatureStatuses([signature]);

  return signature;
};
*/
