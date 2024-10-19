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
