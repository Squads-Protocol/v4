import {
  AddressLookupTableAccount,
  Connection,
  PublicKey,
  SendOptions,
  Signer,
  TransactionInstruction,
  TransactionMessage,
} from "@solana/web3.js";
import { ConfigAction, Member } from "../../generated";

//region BaseBuilder
export interface BaseBuilderArgs {
  /** The connection to an SVM network cluster */
  connection: Connection;
  /** The public key of the creator */
  creator: PublicKey;
}

export interface BuildResult {
  instructions: TransactionInstruction[];
}

export interface SendSettings {
  /** (Optional) Clear all current instructions after sending, so subsequent actions can be done with the same builder. */
  clearInstructions?: boolean;
  /** (Optional) Extra instructions to prepend before specified builder instructions. */
  preInstructions?: TransactionInstruction[];
  /** (Optional) Extra instructions to append after specified builder instructions. */
  postInstructions?: TransactionInstruction[];
  /** (Optional) Any address lookup table accounts to be added to the transaction. */
  addressLookupTableAccounts?: AddressLookupTableAccount[];
  /** (Optional) Fee paying signer keypair. Sufficient if only one signer is needed */
  feePayer?: Signer;
  /** (Optional) Array of multiple signing keypairs. Used for if multiple signers are needed. */
  signers?: Signer[];
  /** (Optional) `SendOptions` object from web3.js. Defaults to `{ preflightCommitment: "finalized" }` */
  options?: SendOptions;
}

export interface BuildTransactionSettings {
  /** **(Optional)** Any address lookup table accounts to be added to the transaction. */
  addressLookupTableAccounts?: AddressLookupTableAccount[];
  /** **(Optional)** Fee paying signer keypair. Sufficient if only one signer is needed */
  feePayer?: Signer;
  /** **(Optional)** Array of multiple signing keypairs. Used for if multiple signers are needed. */
  signers?: Signer[];
}
//endregion

//region BaseTransactionBuilder
export interface TransactionBuilderArgs extends BaseBuilderArgs {
  multisig: PublicKey;
  programId?: PublicKey;
}

export interface TransactionBuildResult extends BuildResult {
  index: number;
}
//endregion

//region Multisig
export interface CreateMultisigActionArgs extends BaseBuilderArgs {
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

export interface CreateMultisigResult extends BuildResult {
  multisigKey: PublicKey;
}
//endregion

//region Proposals
export interface CreateProposalActionArgs {
  /** The public key of the multisig config account */
  multisig: PublicKey;
  /** The public key of the creator */
  creator: PublicKey;
  /** Transaction index of the resulting Proposal */
  transactionIndex: number;
  /** The public key of the fee payer, defaults to the creator */
  rentPayer?: PublicKey;
  /** Whether the proposal should be initialized with status `Draft`. */
  isDraft?: boolean;
  /** Optional program ID (defaults to Solana mainnet-beta/devnet Program ID) */
  programId?: PublicKey;
}

export interface VoteActionArgs {
  /** The public key of the multisig config account */
  multisig: PublicKey;
  /** The public key of the approving member */
  member: PublicKey;
  /** Transaction index of the resulting Proposal */
  transactionIndex: number;
  /** Optional program ID (defaults to Solana mainnet-beta/devnet Program ID) */
  programId?: PublicKey;
}

export interface ProposalResult {
  /** `proposalCreate` instruction */
  instruction: TransactionInstruction;
}
//endregion

//region VaultTransaction
export interface CreateVaultTransactionActionArgs {
  /** The connection to an SVM network cluster */
  connection: Connection;
  /** The public key of the multisig config account */
  multisig: PublicKey;
  /** The public key of the creator */
  creator: PublicKey;
  /** Transaction message containing the instructions to execute */
  message: TransactionMessage;
  /** (Optional) Index of the transaction to build. If omitted, this will be fetched from the multisig account. */
  transactionIndex?: number;
  /** (Optional) Index of the vault to target. Defaults to 0 */
  vaultIndex?: number;
  /** (Optional) Specify a number of ephemeral signers to include.
   * Useful if the underlying transaction requires more than one signer.
   */
  ephemeralSigners?: number;
  /** (Optional) The public key of the fee payer, defaults to the creator */
  rentPayer?: PublicKey;
  /** (Optional) UTF-8 Memo for indexing purposes */
  memo?: string;
  /** (Optional) Squads Program ID (defaults to Solana mainnet-beta/devnet Program ID) */
  programId?: PublicKey;
}

export interface CreateVaultTransactionResult extends BuildResult {
  /** Transaction index of the resulting VaultTransaction */
  index: number;
}

export interface ExecuteVaultTransactionActionArgs {
  /** The connection to an SVM network cluster */
  connection: Connection;
  /** The public key of the multisig config account */
  multisig: PublicKey;
  /** Member who is executing the transaction */
  member: PublicKey;
  /** Transaction index of the VaultTransaction to execute */
  index: number;
  /** Optional memo for indexing purposes */
  memo?: string;
  /** Optional program ID (defaults to Solana mainnet-beta/devnet Program ID) */
  programId?: PublicKey;
}

export interface ExecuteVaultTransactionResult {
  /** `vaultTransactionExecute` instruction */
  instruction: TransactionInstruction;
  /** AddressLookupTableAccounts for the transaction */
  lookupTableAccounts: AddressLookupTableAccount[];
}

export interface ReclaimRentActionArgs {
  /** The connection to an SVM network cluster */
  connection: Connection;
  /** The public key of the multisig config account */
  multisig: PublicKey;
  /** Transaction index of the VaultTransaction to execute */
  index: number;
  /** Optional memo for indexing purposes */
  memo?: string;
  /** Optional program ID (defaults to Solana mainnet-beta/devnet Program ID) */
  programId?: PublicKey;
}
//endregion

//region ConfigTransaction
export interface CreateConfigTransactionActionArgs {
  /** The connection to an SVM network cluster */
  connection: Connection;
  /** The public key of the multisig config account */
  multisig: PublicKey;
  /** The public key of the creator */
  creator: PublicKey;
  /** Transaction message containing the instructions to execute */
  actions: ConfigAction[];
  /** The public key of the fee payer, defaults to the creator */
  rentPayer?: PublicKey;
  /** Optional memo for indexing purposes */
  memo?: string;
  /** Optional program ID (defaults to Solana mainnet-beta/devnet Program ID) */
  programId?: PublicKey;
}

export interface CreateConfigTransactionResult {
  /** `configTransactionCreate` instruction */
  instructions: TransactionInstruction[];
  /** Transaction index of the resulting ConfigTransaction */
  index: number;
}

export interface ExecuteConfigTransactionActionArgs {
  /** The public key of the multisig config account */
  multisig: PublicKey;
  /** Member who is executing the transaction */
  member: PublicKey;
  /** Transaction index of the ConfigTransaction to execute */
  index: number;
  /** Optional memo for indexing purposes */
  memo?: string;
  /** Optional program ID (defaults to Solana mainnet-beta/devnet Program ID) */
  programId?: PublicKey;
}

export interface ExecuteConfigTransactionResult {
  /** `configTransactionExecute` instruction */
  instruction: TransactionInstruction;
}

export const ConfigActions = {
  AddMember: (newMember: Member) => [
    {
      __kind: "AddMember",
      newMember,
    },
  ],
  RemoveMember: (oldMember: PublicKey) => {
    return {
      __kind: "RemoveMember",
      oldMember,
    } as ConfigAction;
  },
  ChangeThreshold: (newThreshold: number) => {
    return {
      __kind: "ChangeThreshold",
      newThreshold,
    } as ConfigAction;
  },
  SetTimeLock: (newTimeLock: number) => {
    return {
      __kind: "SetTimeLock",
      newTimeLock,
    } as ConfigAction;
  },
  AddSpendingLimit: (spendingLimit: SpendingLimit) => {
    return {
      __kind: "AddSpendingLimit",
      ...spendingLimit,
    } as ConfigAction;
  },
  RemoveSpendingLimit: (spendingLimit: PublicKey) => {
    return {
      __kind: "RemoveSpendingLimit",
      spendingLimit,
    } as ConfigAction;
  },
  SetRentCollector: (rentCollector: PublicKey) => {
    return {
      __kind: "SetRentCollector",
      newRentCollector: rentCollector,
    } as ConfigAction;
  },
} as const;

export interface SpendingLimit {
  createKey: PublicKey;
  vaultIndex: number;
  mint: PublicKey;
  amount: number;
  period: number;
  members: PublicKey[];
  destinations: PublicKey[];
}
//endregion

//region Batch
export interface CreateBatchActionArgs extends BaseBuilderArgs {
  /** The public key of the multisig config account */
  multisig: PublicKey;
  /** Index of the vault to target. Defaults to 0 */
  vaultIndex?: number;
  /** The public key of the fee payer, defaults to the creator */
  rentPayer?: PublicKey;
  /** Optional memo for indexing purposes */
  memo?: string;
  /** Optional program ID (defaults to Solana mainnet-beta/devnet Program ID) */
  programId?: PublicKey;
}

export interface CreateBatchResult extends BuildResult {
  /** Transaction index of the resulting VaultTransaction */
  index: number;
}

export interface BatchAddTransactionActionArgs {
  /** The public key of the multisig config account */
  multisig: PublicKey;
  /** Member who is executing the transaction */
  member: PublicKey;
  /** Transaction index of the Batch created. */
  globalIndex: number;
  /** Local transaction index of a transaction inside of the Batch. */
  innerIndex: number;
  /** Transaction message containing the instructions to execute */
  message: TransactionMessage;
  /** Index of the vault to target. Defaults to 0 */
  vaultIndex?: number;
  /** Specify a number of ephemeral signers to include.
   * Useful if the underlying transaction requires more than one signer.
   */
  ephemeralSigners?: number;
  /** Optional memo for indexing purposes */
  memo?: string;
  /** Optional program ID (defaults to Solana mainnet-beta/devnet Program ID) */
  programId?: PublicKey;
}

export interface BatchAddTransactionResult {
  /** `batchAddTransaction` instruction */
  instruction: TransactionInstruction;
}

export interface ExecuteBatchActionArgs {
  /** The connection to an SVM network cluster */
  connection: Connection;
  /** The public key of the multisig config account */
  multisig: PublicKey;
  /** Member who is executing the transaction */
  member: PublicKey;
  /** Transaction index of the VaultTransaction to execute */
  index: number;
  /** Optional memo for indexing purposes */
  memo?: string;
  /** Optional program ID (defaults to Solana mainnet-beta/devnet Program ID) */
  programId?: PublicKey;
}

export interface ExecuteBatchResult {
  /** `vaultTransactionExecute` instruction */
  instruction: TransactionInstruction;
  /** AddressLookupTableAccounts for the transaction */
  lookupTableAccounts: AddressLookupTableAccount[];
}
//endregion

//region Methods
export type Methods<T extends keyof MethodProgression> = {
  [K in keyof MethodProgression]: T extends K ? MethodProgression[K] : never;
}[keyof MethodProgression];

export type BatchMethods<T extends keyof BatchMethodProgression> = {
  [K in keyof BatchMethodProgression]: T extends K
    ? BatchMethodProgression[K]
    : never;
}[keyof BatchMethodProgression];

type BaseMethodKeys =
  | "getInstructions"
  | "transaction"
  | "send"
  | "sendAndConfirm"
  | "customSend";

type BaseSendKeys = "send" | "sendAndConfirm" | "customSend";

// TODO: Split between sync and async getters.
type TransactionGetKeys =
  | "getIndex"
  | "getInstructions"
  | "getTransactionKey"
  | "getProposalKey"
  | "getTransactionAccount"
  | "getProposalAccount";

type TransactionActionKeys =
  | "withProposal"
  | "withApproval"
  | "withRejection"
  | "withExecute";

// TODO: Split between sync and async getters.
type BatchGetKeys =
  | "getInstructions"
  | "getBatchKey"
  | "getBatchTransactionKey"
  | "getAllBatchTransactionKeys"
  | "getBatchAccount";

type BatchActionKeys = "addTransaction" | TransactionActionKeys;

type MethodProgression = {
  // Senders
  send: never;
  sendAndConfirm: never;
  customSend: never;
  // Transaction Actions
  withProposal:
    | "withApproval"
    | "withRejection"
    | BaseSendKeys
    | TransactionGetKeys;
  withApproval:
    | "withExecute"
    | "withRejection"
    | BaseSendKeys
    | TransactionGetKeys;
  withRejection:
    | "withExecute"
    | "withApproval"
    | BaseSendKeys
    | TransactionGetKeys;
  withExecute: BaseSendKeys | TransactionGetKeys;
  reclaimRent: BaseSendKeys | TransactionGetKeys;
  // Synchronous Getters
  getInstructions: BaseMethodKeys | BaseSendKeys;
  getIndex:
    | BaseMethodKeys
    | TransactionActionKeys
    | TransactionGetKeys
    | BatchActionKeys
    | BatchGetKeys;
  getTransactionKey:
    | BaseMethodKeys
    | TransactionActionKeys
    | TransactionGetKeys
    | BatchActionKeys
    | BatchGetKeys;
  getProposalKey:
    | BaseMethodKeys
    | TransactionActionKeys
    | TransactionGetKeys
    | BatchActionKeys
    | BatchGetKeys;
  // Asynchronous Getters
  getTransactionAccount: never;
  getProposalAccount: never;
};

type BatchMethodProgression = {
  send: never;
  sendAndConfirm: never;
  customSend: never;
  withProposal: "withApproval" | "withRejection" | BaseSendKeys;
  withApproval: "withExecute" | "withRejection" | BaseSendKeys | BatchGetKeys;
  withRejection: "withExecute" | "withApproval" | BaseSendKeys;
  withExecute: BaseSendKeys;
  getBatchKey:
    | BaseMethodKeys
    | TransactionActionKeys
    | TransactionGetKeys
    | BatchActionKeys
    | BatchGetKeys;
  getBatchTransactionKey: BatchActionKeys | BatchGetKeys;
  getBatchAccount: never;
  addTransaction: never;
};
//endregion
