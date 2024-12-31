import {
  BlockhashWithExpiryBlockHeight,
  Connection,
  PublicKey,
  SendOptions,
  Signer,
  TransactionSignature,
  VersionedTransaction,
} from "@solana/web3.js";
import { translateAndThrowAnchorError } from "../errors";
import * as transactions from "../transactions";

/** Remove a member/key from the multisig. */
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
}): Promise<[TransactionSignature, BlockhashWithExpiryBlockHeight]> {
  const blockhash = (await connection.getLatestBlockhash());

  const tx = transactions.multisigRemoveMember({
    blockhash: blockhash.blockhash,
    feePayer: feePayer.publicKey,
    multisigPda,
    configAuthority,
    oldMember,
    programId,
  });

  const transaction = new VersionedTransaction(tx);

  transaction.sign([feePayer, ...(signers ?? [])]);

  try {
    return [await connection.sendTransaction(transaction, sendOptions), blockhash];
  } catch (err) {
    translateAndThrowAnchorError(err);
  }
}
