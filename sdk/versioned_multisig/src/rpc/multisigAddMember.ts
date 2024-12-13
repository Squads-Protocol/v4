import {
  Connection,
  PublicKey,
  SendOptions,
  Signer,
  TransactionSignature,
  VersionedTransaction,
} from "@solana/web3.js";
import { VersionedMember } from "../generated";
import * as transactions from "../transactions";
import { translateAndThrowAnchorError } from "../errors";

/** Add a member/key to the multisig and reallocate space if necessary. */
export async function versionedMultisigAddMember({
  connection,
  feePayer,
  multisigPda,
  configAuthority,
  rentPayer,
  newMember,
  signers,
  sendOptions,
  programId,
}: {
  connection: Connection;
  feePayer: Signer;
  multisigPda: PublicKey;
  configAuthority: PublicKey;
  rentPayer: Signer;
  newMember: VersionedMember;
  signers?: Signer[];
  sendOptions?: SendOptions;
  programId?: PublicKey;
}): Promise<TransactionSignature> {
  const blockhash = (await connection.getLatestBlockhash()).blockhash;

  const tx = transactions.versionedMultisigAddMember({
    blockhash,
    feePayer: feePayer.publicKey,
    multisigPda,
    configAuthority,
    rentPayer: rentPayer.publicKey,
    newMember,
    programId,
  });

  const transaction = new VersionedTransaction(tx);

  transaction.sign([feePayer, rentPayer, ...(signers ?? [])]);

  try {
    return await connection.sendTransaction(transaction, sendOptions);
  } catch (err) {
    translateAndThrowAnchorError(err);
  }
}
