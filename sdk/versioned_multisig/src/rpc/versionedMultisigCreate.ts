import {
  Blockhash,
  BlockhashWithExpiryBlockHeight,
  Connection,
  PublicKey,
  SendOptions,
  Signer,
  TransactionSignature,
  VersionedTransaction
} from "@solana/web3.js";
import { translateAndThrowAnchorError } from "../errors";
import { PROGRAM_ID, VersionedMember } from "../generated";
import * as transactions from "../transactions";

/** Creates a new versioned multisig. 2 */
export async function versionedMultisigCreate({
  connection,
  treasury,
  createKey,
  creator,
  multisigPda,
  configAuthority,
  threshold,
  members,
  timeLock,
  rentCollector,
  memo,
  sendOptions,
  programId,
}: {
  connection: Connection;
  treasury: PublicKey;
  createKey: Signer;
  creator: Signer;
  multisigPda: PublicKey;
  configAuthority: PublicKey | null;
  threshold: number;
  members: VersionedMember[];
  timeLock: number;
  rentCollector: PublicKey | null;
  memo?: string;
  sendOptions?: SendOptions;
  programId?: PublicKey;
}): Promise<[TransactionSignature, {
  readonly blockhash: Blockhash;
  readonly lastValidBlockHeight: number;
}]> {
  const blockhash = (await connection.getLatestBlockhash());

  const message = transactions.versionedMultisigCreate({
    blockhash: blockhash.blockhash,
    treasury,
    createKey: createKey.publicKey,
    creator: creator.publicKey,
    multisigPda,
    configAuthority,
    threshold,
    members,
    timeLock,
    rentCollector,
    memo,
    programId: programId ?? PROGRAM_ID,
  });

  const transaction = new VersionedTransaction(message);

  transaction.sign([creator, createKey]);

  try {
    const result = await connection.sendTransaction(transaction, sendOptions);
    return [result, blockhash];
  } catch (err) {
    console.log("versionedMultisigCreate - err", err);
    translateAndThrowAnchorError(err);
  }
}
