import {
  Connection,
  Keypair,
  PublicKey,
  TransactionInstruction,
} from "@solana/web3.js";
import { Member, Multisig, PROGRAM_ID, ProgramConfig } from "../generated";
import { getMultisigPda, getProgramConfigPda, instructions } from "..";
import { BaseBuilder } from "./common";
import { SquadPermissions, createMembers } from "./members";

interface CreateMultisigActionArgs {
  /** The connection to an SVM network cluster */
  connection: Connection;
  /** The public key of the creator */
  creator: PublicKey;
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

interface CreateMultisigResult {
  /** `multisigCreateV2` instruction */
  instructions: TransactionInstruction[];
  /** Keypair seed that is required to sign the transaction */
  createKey: Keypair;
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
 * const result = await createMultisig({
 *   connection,
 *   creator: creatorPublicKey,
 *   threshold: 2,
 *   members: membersList,
 * });
 * console.log(result.instruction);
 * console.log(result.createKey);
 *
 * @example
 * // Using the transaction() method:
 * const transaction = await createMultisig({
 *   // ... args
 * }).transaction();
 *
 * @example
 * // Using the rpc() method:
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
  public createKey: Keypair = Keypair.generate();

  constructor(args: CreateMultisigActionArgs) {
    super(args);
  }

  async build() {
    const {
      threshold,
      members,
      timeLock = 0,
      configAuthority,
      rentCollector,
      programId = PROGRAM_ID,
    } = this.args;
    const result = await createMultisigCore({
      connection: this.connection,
      creator: this.creator,
      threshold,
      members,
      timeLock,
      configAuthority,
      rentCollector,
      programId,
    });

    this.instructions = [...result.instructions];
    this.createKey = result.createKey;
    return this;
  }

  getInstructions(): TransactionInstruction[] {
    return this.instructions;
  }

  getCreateKey(): Keypair {
    return this.createKey;
  }

  getMultisigKey(): PublicKey {
    const [multisigPda] = getMultisigPda({
      createKey: this.createKey.publicKey,
    });

    return multisigPda;
  }

  getMultisigAccount(key: PublicKey) {
    return this.buildPromise.then(async () => {
      const multisigAccount = await Multisig.fromAccountAddress(
        this.connection,
        key
      );

      return multisigAccount;
    });
  }
}

export async function createMultisigCore(
  args: CreateMultisigActionArgs
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

  const createKey = Keypair.generate();
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
    createKey: createKey,
  };
}

/*
async function Example() {
  const connection = new Connection("https://api.mainnet-beta.solana.com");
  const feePayer = Keypair.generate();
  const signature = await createMultisig({
    connection,
    members: createMembers([
      { key: PublicKey.default, permissions: SquadPermissions.All },
    ]),
    creator: PublicKey.default,
    threshold: 2,
  }).sendAndConfirm(feePayer);
}
*/
