import {
  AddressLookupTableAccount,
  
  BlockhashWithExpiryBlockHeight,
  
  Connection,
  PublicKey,
  SendOptions,
  Signer,
  TransactionMessage,
  TransactionSignature,
  VersionedTransaction,
} from "@solana/web3.js";
import * as transactions from "../transactions";
import { translateAndThrowAnchorError } from "../errors";

/** Create a new vault transaction. */
export async function vaultTransactionCreate({
  connection,
  feePayer,
  multisigPda,
  transactionIndex,
  creator,
  rentPayer,
  vaultIndex,
  ephemeralSigners,
  transactionMessage,
  addressLookupTableAccounts,
  memo,
  signers,
  sendOptions,
  programId,
}: {
  connection: Connection;
  feePayer: Signer;
  multisigPda: PublicKey;
  transactionIndex: bigint;
  /** Member of the multisig that is creating the transaction. */
  creator: PublicKey;
  /** Payer for the transaction account rent. If not provided, `creator` is used. */
  rentPayer?: PublicKey;
  vaultIndex: number;
  /** Number of ephemeral signing PDAs required by the transaction. */
  ephemeralSigners: number;
  /** Transaction message to wrap into a multisig transaction. */
  transactionMessage: TransactionMessage;
  /** `AddressLookupTableAccount`s referenced in `transaction_message`. */
  addressLookupTableAccounts?: AddressLookupTableAccount[];
  memo?: string;
  signers?: Signer[];
  sendOptions?: SendOptions;
  programId?: PublicKey;
}): Promise<[TransactionSignature, BlockhashWithExpiryBlockHeight]> {
  const blockhash = (await connection.getLatestBlockhash());

  const tx = transactions.vaultTransactionCreate({
    blockhash: blockhash.blockhash,
    feePayer: feePayer.publicKey,
    multisigPda,
    transactionIndex,
    creator,
    rentPayer,
    vaultIndex,
    ephemeralSigners,
    transactionMessage,
    addressLookupTableAccounts,
    memo,
    programId,
  });

  const transaction = new VersionedTransaction(tx); 

  transaction.sign([feePayer, ...(signers ?? [])]);

  try {
    const res = await connection.sendTransaction(transaction, sendOptions);
    return [res, blockhash];
  } catch (err) {
    translateAndThrowAnchorError(err);
  }
}
