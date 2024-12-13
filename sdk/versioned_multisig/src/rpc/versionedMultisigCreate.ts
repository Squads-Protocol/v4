import {
    Connection,
    PublicKey,
    SendOptions,
    Signer,
    TransactionSignature,
    VersionedTransaction,
  } from "@solana/web3.js";
  import { PROGRAM_ID, VersionedMember } from "../generated";
  import * as transactions from "../transactions";
  import { translateAndThrowAnchorError } from "../errors";
  
  /** Creates a new versioned multisig. */
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
  }): Promise<TransactionSignature> {
    const blockhash = (await connection.getLatestBlockhash()).blockhash;
  
    const message = transactions.versionedMultisigCreate({
      blockhash,
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
    return await connection.sendTransaction(transaction, sendOptions);
  } catch (err) {
    translateAndThrowAnchorError(err);
  }
  }
  