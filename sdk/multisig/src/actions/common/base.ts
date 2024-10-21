import {
  Connection,
  Keypair,
  PublicKey,
  TransactionInstruction,
  TransactionMessage,
  TransactionSignature,
  VersionedTransaction,
} from "@solana/web3.js";
import {
  BaseBuilderArgs,
  BuildResult,
  BuildTransactionSettings,
  SendSettings,
} from "./types";

export abstract class BaseBuilder<
  T extends BuildResult,
  U extends BaseBuilderArgs = BaseBuilderArgs
> {
  public createKey?: Keypair;
  protected connection: Connection;
  protected instructions: TransactionInstruction[] = [];
  protected creator: PublicKey = PublicKey.default;
  protected buildPromise: Promise<void>;
  protected args: Omit<U, keyof BaseBuilderArgs>;
  private built: boolean = false;
  // Use this as an indicator to clear all instructions?
  private sent: boolean = false;

  constructor(args: U, options: { generateCreateKey?: boolean } = {}) {
    this.connection = args.connection;
    this.creator = args.creator;
    this.args = this.extractAdditionalArgs(args);
    if (options.generateCreateKey) {
      this.createKey = Keypair.generate();
    }
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

  /**
   * Fetches built instructions. Will always contain at least one instruction corresponding to
   * the builder you are using, unless cleared after sending.
   * @returns `Promise<TransactionInstruction[]>` - An array of built instructions.
   */
  async getInstructions(): Promise<TransactionInstruction[]> {
    await this.ensureBuilt();
    return this.instructions;
  }

  /**
   * Creates a `VersionedTransaction` containing the corresponding instruction(s).
   *
   * @args `BuildTransactionSettings` - **(Optional)** Address Lookup Table accounts, signers, a custom fee-payer to add to the transaction.
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
   */
  async transaction(
    settings?: BuildTransactionSettings
  ): Promise<VersionedTransaction> {
    await this.ensureBuilt();
    const message = new TransactionMessage({
      payerKey: settings?.feePayer?.publicKey ?? this.creator,
      recentBlockhash: (await this.connection.getLatestBlockhash()).blockhash,
      instructions: [...this.instructions],
    }).compileToV0Message(settings?.addressLookupTableAccounts);

    const tx = new VersionedTransaction(message);
    if (settings?.feePayer) {
      tx.sign([settings?.feePayer]);
    }
    if (settings?.signers) {
      tx.sign([...settings?.signers]);
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
   * @example
   * const builder = createMultisig({
   *   // ... args
   * });
   * const signature = await builder.send();
   * @example
   * const builder = createMultisig({
   *   // ... args
   * });
   *
   * // With settings
   * const signature = await builder.send({
   *   preInstructions: [...preInstructions],
   *   postInstructions: [...postInstructions],
   *   feePayer: someKeypair,
   *   options: { skipPreflight: true },
   * });
   */
  async send(settings?: SendSettings): Promise<TransactionSignature> {
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
    }).compileToV0Message(settings?.addressLookupTableAccounts);

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

    if (settings?.clearInstructions) {
      this.instructions = [];
    }

    return signature;
  }

  /**
   * Builds a transaction with the corresponding instruction(s), sends it, and confirms the transaction.
   *
   * **NOTE: Not wallet-adapter compatible.**
   *
   * @args `settings` - Optional pre/post instructions, fee payer keypair, and send options.
   * @returns `TransactionSignature`
   * @example
   * const builder = createMultisig({
   *   // ... args
   * });
   * const signature = await builder.sendAndConfirm();
   * @example
   * const builder = createMultisig({
   *   // ... args
   * });
   *
   * // With settings
   * const signature = await builder.sendAndConfirm({
   *   preInstructions: [...preInstructions],
   *   postInstructions: [...postInstructions],
   *   feePayer: someKeypair,
   *   options: { skipPreflight: true },
   * });
   */
  async sendAndConfirm(settings?: SendSettings): Promise<TransactionSignature> {
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
    }).compileToV0Message(settings?.addressLookupTableAccounts);

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
    const maxAttempts = 10;
    const delayMs = 1000;
    for (let attempt = 0; attempt < maxAttempts && !sent; attempt++) {
      const status = await this.connection.getSignatureStatus(signature);
      if (status?.value?.confirmationStatus === commitment || "confirmed") {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        sent = true;
      } else {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    if (!sent) {
      throw new Error(
        "Transaction was not confirmed within the expected timeframe"
      );
    }

    if (settings?.clearInstructions) {
      this.instructions = [];
    }

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
}
