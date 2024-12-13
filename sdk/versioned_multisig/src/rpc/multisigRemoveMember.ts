import {
  Connection,
  PublicKey,
  SendOptions,
  Signer,
  TransactionSignature,
  VersionedTransaction,
} from "@solana/web3.js";
import { translateAndThrowAnchorError } from "../errors";
import * as transactions from "../transactions";

/** Add a member/key to the multisig and reallocate space if necessary. */
export async function versionedMultisigRemoveMember({
  connection,
  feePayer,
  multisigPda,
  configAuthority,
  oldMember,
  signers,
  sendOptions,
  programId,
}: {
  connection: Connection;
  feePayer: Signer;
  multisigPda: PublicKey;
  configAuthority: PublicKey;
  oldMember: PublicKey;
  signers?: Signer[];
  sendOptions?: SendOptions;
  programId?: PublicKey;
}): Promise<TransactionSignature> {
  const blockhash = (await connection.getLatestBlockhash()).blockhash;

  const tx = transactions.multisigRemoveMember({
    blockhash,
    feePayer: feePayer.publicKey,
    multisigPda,
    configAuthority,
    oldMember,
    programId,
  });

  const transaction = new VersionedTransaction(tx);

  transaction.sign([feePayer, ...(signers ?? [])]);

  try {
    return await connection.sendTransaction(transaction, sendOptions);
  } catch (err) {
    translateAndThrowAnchorError(err);
  }
}
