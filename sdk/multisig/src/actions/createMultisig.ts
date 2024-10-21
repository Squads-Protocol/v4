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
 * Builds an instruction to create a new Multisig, and returns the instruction and `createKey`
 * with the option to chain additional methods for building transactions, and sending.
 *
 * @param args - Object of type `CreateMultisigActionArgs` that contains the necessary information to create a new multisig.
 * @returns `{ instruction: TransactionInstruction, createKey: Keypair }` - object with the `multisigCreateV2` instruction and the `createKey` that is required to sign the transaction.
 *
 * @example
 * // Basic usage (no chaining):
 * const builder = await createMultisig({
 *   connection,
 *   creator: creatorPublicKey,
 *   threshold: 2,
 *   members: membersList,
 * });
 *
 * const instructions = result.instructions;
 * const createKey = result.createKey;
 *
 * const signature = await builder.sendAndConfirm();
 *
 * @example
 * // Using the transaction() method:
 * const transaction = await createMultisig({
 *   // ... args
 * }).transaction();
 *
 * @example
 * // Using the send() method:
 * const signature = await createMultisig({
 *   // ... args
 * }).send();
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

  async getCreateKey(): Promise<Keypair> {
    await this.ensureBuilt();
    return this.createKey!;
  }

  async getMultisigKey(): Promise<PublicKey> {
    await this.ensureBuilt();
    return this.multisigKey;
  }

  async getMultisigAccount(key: PublicKey) {
    await this.ensureBuilt();
    const multisigAccount = await Multisig.fromAccountAddress(
      this.connection,
      key
    );

    return multisigAccount;
  }

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

export async function isMultisig(connection: Connection, key: PublicKey) {
  try {
    await Multisig.fromAccountAddress(connection, key);
    return true;
  } catch (err) {
    return false;
  }
}
