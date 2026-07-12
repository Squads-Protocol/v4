import {
  Connection,
  Keypair,
  PublicKey,
  SendOptions,
  Signer,
  TransactionInstruction,
  VersionedTransaction,
} from "@solana/web3.js";
import { Multisig, PROGRAM_ID } from "../generated";
import { createMultisigCore } from "./common/multisig";
import {
  BuildTransactionSettings,
  CreateMultisigActionArgs,
  CreateMultisigResult,
  SendSettings,
} from "./common/types";
import { BaseBuilder } from "./common/base";

/**
 * Builds an instruction to create a new {@link Multisig},
 * with the option to chain additional methods for building transactions, and sending.
 *
 * @args  {@link CreateMultisigActionArgs}
 * @returns - {@link MultisigBuilder} or if awaited {@link CreateMultisigResult}
 *
 * @example
 * const builder = createMultisig({
 *   connection,
 *   creator: creator,
 *   threshold: 1,
 *   members: createMembers([
 *     {
 *        key: creator, permissions: SquadPermissions.All
 *     },
 *   ]),
 *   // Can also include timeLock, configAuthority, rentCollector, and programId.
 * });
 *
 * // Get the built instructions and the generated createKey.
 * const instructions = builder.getInstructions();
 * const createKey = builder.getCreateKey();
 *
 * @example
 * // Run the builder async to get the result immediately.
 * const result = await createMultisig({
 *   connection,
 *   creator: creator,
 *   threshold: 1,
 *   members: createMembers([
 *     {
 *        key: creator, permissions: SquadPermissions.All
 *     },
 *   ]),
 * });
 *
 * @example
 * // Using the `transaction()` method:
 * const transaction = await createMultisig({
 *   // ... args
 * }).transaction();
 *
 * @example
 * // Using the `send()` or `sendAndConfirm()` methods:
 * const signature = await createMultisig({
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
export function createMultisig(
  args: CreateMultisigActionArgs
): MultisigBuilder {
  return new MultisigBuilder(args);
}

class MultisigBuilder extends BaseBuilder<
  CreateMultisigResult,
  CreateMultisigActionArgs
> {
  public instructions: TransactionInstruction[] = [];
  public multisigKey: PublicKey = PublicKey.default;

  constructor(args: CreateMultisigActionArgs) {
    super(args, { generateCreateKey: true });
  }

  protected async build(): Promise<void> {
    const {
      threshold,
      members,
      timeLock = 0,
      configAuthority,
      rentCollector,
      programId = PROGRAM_ID,
    } = this.args;
    const result = await createMultisigCore(
      {
        connection: this.connection,
        creator: this.creator,
        threshold,
        members,
        timeLock,
        configAuthority,
        rentCollector,
        programId,
      },
      this.createKey!
    );

    this.instructions = [...result.instructions];
    this.multisigKey = result.multisigKey;
  }

  /**
   * Fetches the generated `createKey` used to generate the {@link Multisig} PDA.
   * @returns `Keypair`
   */
  async getCreateKey(): Promise<Keypair> {
    await this.ensureBuilt();
    return this.createKey!;
  }

  /**
   * Fetches the generated {@link Multisig} PDA.
   * @returns `PublicKey`
   */
  async getMultisigKey(): Promise<PublicKey> {
    await this.ensureBuilt();
    return this.multisigKey;
  }

  /**
   * Fetches deserialized account data for the corresponding {@link Multisig} account after it is built and sent.
   * @returns `Multisig`
   */
  async getMultisigAccount(key: PublicKey) {
    await this.ensureBuilt();
    const multisigAccount = await Multisig.fromAccountAddress(
      this.connection,
      key
    );

    return multisigAccount;
  }

  /**
   * Creates a `VersionedTransaction` containing the corresponding instruction(s), and signs it with the generated `createKey`.
   *
   * @args  {@link BuildTransactionSettings} - **(Optional)** Address Lookup Table accounts, signers, a custom fee-payer to add to the transaction.
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
    if (settings?.signers) {
      settings.signers.push(this.createKey!);
    } else {
      settings = {
        signers: [this.createKey!],
        ...settings,
      };
    }
    return await super.transaction(settings);
  }

  /**
   * Builds a transaction with the corresponding instruction(s), signs it with the generated `createKey`, and sends it.
   *
   * **NOTE: Not wallet-adapter compatible.**
   *
   * @args  {@link SendSettings} - Optional pre/post instructions, fee payer, and send options.
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
  async send(settings?: SendSettings): Promise<string> {
    await this.ensureBuilt();
    if (settings?.signers) {
      settings.signers.push(this.createKey!);
    } else {
      settings = {
        signers: [this.createKey!],
        ...settings,
      };
    }
    return await super.send(settings);
  }

  /**
   * Builds a transaction with the corresponding instruction(s), signs it with the generated `createKey`, sends it, and confirms the transaction.
   *
   * **NOTE: Not wallet-adapter compatible.**
   *
   * @args  {@link SendSettings} - Optional pre/post instructions, fee payer keypair, and send options.
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
  async sendAndConfirm(settings?: SendSettings): Promise<string> {
    await this.ensureBuilt();
    if (settings?.signers) {
      settings.signers.push(this.createKey!);
    } else {
      settings = {
        signers: [this.createKey!],
        ...settings,
      };
    }
    return await super.sendAndConfirm(settings);
  }
}

/**
 * Attempts to fetch and deserialize the {@link Multisig} account, and returns a boolean indicating if it was successful.
 * @args `connection: Connection, key: PublicKey` - Specify a cluster connection, and the `PublicKey` of the `Multisig` account.
 */
export async function isMultisig(connection: Connection, key: PublicKey) {
  try {
    await Multisig.fromAccountAddress(connection, key);
    return true;
  } catch (err) {
    return false;
  }
}
