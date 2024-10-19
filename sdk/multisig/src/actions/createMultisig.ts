import {
  Connection,
  Keypair,
  PublicKey,
  SendOptions,
  Signer,
  TransactionInstruction,
} from "@solana/web3.js";
import { Member, Multisig, PROGRAM_ID, ProgramConfig } from "../generated";
import { getMultisigPda, getProgramConfigPda, instructions } from "..";
import { BaseBuilder, BaseBuilderArgs, BuildResult } from "./common";
import { SquadPermissions, createMembers } from "./members";

interface CreateMultisigActionArgs extends BaseBuilderArgs {
  /** The number of approvals required to approve transactions */
  threshold: number;
  /** The list of members in the multisig, with their associated permissions */
  members: Member[];
  /** Optional time lock in seconds */
  timeLock?: number;
  /** Optional config authority key that can override consensus for ConfigTransactions */
  configAuthority?: PublicKey;
  /** Optional rent collector where completed transaction rent will go after reclaim */
  rentCollector?: PublicKey;
  /** Optional program ID (defaults to Solana mainnet-beta/devnet Program ID) */
  programId?: PublicKey;
}

interface CreateMultisigResult extends BuildResult {
  multisigKey: PublicKey;
}

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
    super(args);
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
      this.createKey
    );

    this.instructions = [...result.instructions];
    this.multisigKey = result.multisigKey;
  }

  async getCreateKey(): Promise<Keypair> {
    await this.ensureBuilt();
    return this.createKey;
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

  async sendAndConfirm(settings?: {
    preInstructions?: TransactionInstruction[] | undefined;
    postInstructions?: TransactionInstruction[] | undefined;
    feePayer?: Signer | undefined;
    signers?: Signer[] | undefined;
    options?: SendOptions | undefined;
  }): Promise<string> {
    await this.ensureBuilt();
    if (settings?.signers) {
      settings.signers.push(this.createKey);
    } else {
      settings = {
        signers: [this.createKey],
        ...settings,
      };
    }
    return await super.sendAndConfirm(settings);
  }
}

export async function createMultisigCore(
  args: CreateMultisigActionArgs,
  createKey: Keypair
): Promise<CreateMultisigResult> {
  const {
    connection,
    creator,
    threshold,
    members,
    timeLock = 0,
    configAuthority,
    rentCollector,
    programId = PROGRAM_ID,
  } = args;

  const [multisigPda] = getMultisigPda({
    createKey: createKey.publicKey,
    programId,
  });
  const programConfigPda = getProgramConfigPda({ programId })[0];

  const programConfig = await ProgramConfig.fromAccountAddress(
    connection,
    programConfigPda
  );

  const ix = instructions.multisigCreateV2({
    creator,
    threshold,
    members,
    multisigPda: multisigPda,
    treasury: programConfig.treasury,
    createKey: createKey.publicKey,
    timeLock: timeLock ?? 0,
    rentCollector: rentCollector ?? null,
    configAuthority: configAuthority ?? null,
    programId: programId ?? PROGRAM_ID,
  });

  return {
    instructions: [ix],
    multisigKey: multisigPda,
  };
}

export async function isMultisig(connection: Connection, key: PublicKey) {
  try {
    await Multisig.fromAccountAddress(connection, key);
    return true;
  } catch (err) {
    return false;
  }
}

async function Example() {
  const connection = new Connection("https://api.mainnet-beta.solana.com");
  const feePayer = Keypair.generate();
  const signature = createMultisig({
    connection,
    members: createMembers([
      { key: PublicKey.default, permissions: SquadPermissions.All },
    ]),
    creator: PublicKey.default,
    threshold: 2,
  });
}
