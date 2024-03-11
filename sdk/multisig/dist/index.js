"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var src_exports = {};
__export(src_exports, {
  PROGRAM_ADDRESS: () => PROGRAM_ADDRESS,
  PROGRAM_ID: () => PROGRAM_ID,
  accounts: () => accounts_exports,
  errors: () => errors_exports,
  generated: () => generated_exports,
  getBatchTransactionPda: () => getBatchTransactionPda,
  getEphemeralSignerPda: () => getEphemeralSignerPda,
  getMultisigPda: () => getMultisigPda,
  getProgramConfigPda: () => getProgramConfigPda,
  getProposalPda: () => getProposalPda,
  getSpendingLimitPda: () => getSpendingLimitPda,
  getTransactionPda: () => getTransactionPda,
  getVaultPda: () => getVaultPda,
  instructions: () => instructions_exports,
  rpc: () => rpc_exports,
  transactions: () => transactions_exports,
  types: () => types_exports,
  utils: () => utils_exports
});
module.exports = __toCommonJS(src_exports);

// src/generated/index.ts
var generated_exports = {};
__export(generated_exports, {
  AlreadyApprovedError: () => AlreadyApprovedError,
  AlreadyCancelledError: () => AlreadyCancelledError,
  AlreadyRejectedError: () => AlreadyRejectedError,
  Batch: () => Batch,
  BatchNotEmptyError: () => BatchNotEmptyError,
  ConfigTransaction: () => ConfigTransaction,
  DecimalsMismatchError: () => DecimalsMismatchError,
  DuplicateMemberError: () => DuplicateMemberError,
  EmptyMembersError: () => EmptyMembersError,
  IllegalAccountOwnerError: () => IllegalAccountOwnerError,
  InvalidAccountError: () => InvalidAccountError,
  InvalidDestinationError: () => InvalidDestinationError,
  InvalidMintError: () => InvalidMintError,
  InvalidNumberOfAccountsError: () => InvalidNumberOfAccountsError,
  InvalidProposalStatusError: () => InvalidProposalStatusError,
  InvalidRentCollectorError: () => InvalidRentCollectorError,
  InvalidStaleTransactionIndexError: () => InvalidStaleTransactionIndexError,
  InvalidThresholdError: () => InvalidThresholdError,
  InvalidTransactionIndexError: () => InvalidTransactionIndexError,
  InvalidTransactionMessageError: () => InvalidTransactionMessageError,
  MissingAccountError: () => MissingAccountError,
  Multisig: () => Multisig,
  NoActionsError: () => NoActionsError,
  NoExecutorsError: () => NoExecutorsError,
  NoProposersError: () => NoProposersError,
  NoVotersError: () => NoVotersError,
  NotAMemberError: () => NotAMemberError,
  NotSupportedForControlledError: () => NotSupportedForControlledError,
  PROGRAM_ADDRESS: () => PROGRAM_ADDRESS,
  PROGRAM_ID: () => PROGRAM_ID,
  Period: () => Period,
  ProgramConfig: () => ProgramConfig,
  Proposal: () => Proposal,
  ProposalForAnotherMultisigError: () => ProposalForAnotherMultisigError,
  ProtectedAccountError: () => ProtectedAccountError,
  RemoveLastMemberError: () => RemoveLastMemberError,
  RentReclamationDisabledError: () => RentReclamationDisabledError,
  SpendingLimit: () => SpendingLimit,
  SpendingLimitExceededError: () => SpendingLimitExceededError,
  SpendingLimitInvalidAmountError: () => SpendingLimitInvalidAmountError,
  StaleProposalError: () => StaleProposalError,
  TimeLockExceedsMaxAllowedError: () => TimeLockExceedsMaxAllowedError,
  TimeLockNotReleasedError: () => TimeLockNotReleasedError,
  TooManyMembersError: () => TooManyMembersError,
  TransactionForAnotherMultisigError: () => TransactionForAnotherMultisigError,
  TransactionNotLastInBatchError: () => TransactionNotLastInBatchError,
  TransactionNotMatchingProposalError: () => TransactionNotMatchingProposalError,
  UnauthorizedError: () => UnauthorizedError,
  UnknownPermissionError: () => UnknownPermissionError,
  VaultBatchTransaction: () => VaultBatchTransaction,
  VaultTransaction: () => VaultTransaction,
  Vote: () => Vote,
  accountProviders: () => accountProviders,
  batchAccountsCloseInstructionDiscriminator: () => batchAccountsCloseInstructionDiscriminator,
  batchAccountsCloseStruct: () => batchAccountsCloseStruct,
  batchAddTransactionArgsBeet: () => batchAddTransactionArgsBeet,
  batchAddTransactionInstructionDiscriminator: () => batchAddTransactionInstructionDiscriminator,
  batchAddTransactionStruct: () => batchAddTransactionStruct,
  batchBeet: () => batchBeet,
  batchCreateArgsBeet: () => batchCreateArgsBeet,
  batchCreateInstructionDiscriminator: () => batchCreateInstructionDiscriminator,
  batchCreateStruct: () => batchCreateStruct,
  batchDiscriminator: () => batchDiscriminator,
  batchExecuteTransactionInstructionDiscriminator: () => batchExecuteTransactionInstructionDiscriminator,
  batchExecuteTransactionStruct: () => batchExecuteTransactionStruct,
  configActionBeet: () => configActionBeet,
  configTransactionAccountsCloseInstructionDiscriminator: () => configTransactionAccountsCloseInstructionDiscriminator,
  configTransactionAccountsCloseStruct: () => configTransactionAccountsCloseStruct,
  configTransactionBeet: () => configTransactionBeet,
  configTransactionCreateArgsBeet: () => configTransactionCreateArgsBeet,
  configTransactionCreateInstructionDiscriminator: () => configTransactionCreateInstructionDiscriminator,
  configTransactionCreateStruct: () => configTransactionCreateStruct,
  configTransactionDiscriminator: () => configTransactionDiscriminator,
  configTransactionExecuteInstructionDiscriminator: () => configTransactionExecuteInstructionDiscriminator,
  configTransactionExecuteStruct: () => configTransactionExecuteStruct,
  createBatchAccountsCloseInstruction: () => createBatchAccountsCloseInstruction,
  createBatchAddTransactionInstruction: () => createBatchAddTransactionInstruction,
  createBatchCreateInstruction: () => createBatchCreateInstruction,
  createBatchExecuteTransactionInstruction: () => createBatchExecuteTransactionInstruction,
  createConfigTransactionAccountsCloseInstruction: () => createConfigTransactionAccountsCloseInstruction,
  createConfigTransactionCreateInstruction: () => createConfigTransactionCreateInstruction,
  createConfigTransactionExecuteInstruction: () => createConfigTransactionExecuteInstruction,
  createMultisigAddMemberInstruction: () => createMultisigAddMemberInstruction,
  createMultisigAddSpendingLimitInstruction: () => createMultisigAddSpendingLimitInstruction,
  createMultisigChangeThresholdInstruction: () => createMultisigChangeThresholdInstruction,
  createMultisigCreateInstruction: () => createMultisigCreateInstruction,
  createMultisigCreateV2Instruction: () => createMultisigCreateV2Instruction,
  createMultisigRemoveMemberInstruction: () => createMultisigRemoveMemberInstruction,
  createMultisigRemoveSpendingLimitInstruction: () => createMultisigRemoveSpendingLimitInstruction,
  createMultisigSetConfigAuthorityInstruction: () => createMultisigSetConfigAuthorityInstruction,
  createMultisigSetRentCollectorInstruction: () => createMultisigSetRentCollectorInstruction,
  createMultisigSetTimeLockInstruction: () => createMultisigSetTimeLockInstruction,
  createProgramConfigInitInstruction: () => createProgramConfigInitInstruction,
  createProgramConfigSetAuthorityInstruction: () => createProgramConfigSetAuthorityInstruction,
  createProgramConfigSetMultisigCreationFeeInstruction: () => createProgramConfigSetMultisigCreationFeeInstruction,
  createProgramConfigSetTreasuryInstruction: () => createProgramConfigSetTreasuryInstruction,
  createProposalActivateInstruction: () => createProposalActivateInstruction,
  createProposalApproveInstruction: () => createProposalApproveInstruction,
  createProposalCancelInstruction: () => createProposalCancelInstruction,
  createProposalCreateInstruction: () => createProposalCreateInstruction,
  createProposalRejectInstruction: () => createProposalRejectInstruction,
  createSpendingLimitUseInstruction: () => createSpendingLimitUseInstruction,
  createVaultBatchTransactionAccountCloseInstruction: () => createVaultBatchTransactionAccountCloseInstruction,
  createVaultTransactionAccountsCloseInstruction: () => createVaultTransactionAccountsCloseInstruction,
  createVaultTransactionCreateInstruction: () => createVaultTransactionCreateInstruction,
  createVaultTransactionExecuteInstruction: () => createVaultTransactionExecuteInstruction,
  errorFromCode: () => errorFromCode,
  errorFromName: () => errorFromName,
  isConfigActionAddMember: () => isConfigActionAddMember,
  isConfigActionAddSpendingLimit: () => isConfigActionAddSpendingLimit,
  isConfigActionChangeThreshold: () => isConfigActionChangeThreshold,
  isConfigActionRemoveMember: () => isConfigActionRemoveMember,
  isConfigActionRemoveSpendingLimit: () => isConfigActionRemoveSpendingLimit,
  isConfigActionSetRentCollector: () => isConfigActionSetRentCollector,
  isConfigActionSetTimeLock: () => isConfigActionSetTimeLock,
  isProposalStatusActive: () => isProposalStatusActive,
  isProposalStatusApproved: () => isProposalStatusApproved,
  isProposalStatusCancelled: () => isProposalStatusCancelled,
  isProposalStatusDraft: () => isProposalStatusDraft,
  isProposalStatusExecuted: () => isProposalStatusExecuted,
  isProposalStatusExecuting: () => isProposalStatusExecuting,
  isProposalStatusRejected: () => isProposalStatusRejected,
  memberBeet: () => memberBeet,
  multisigAddMemberArgsBeet: () => multisigAddMemberArgsBeet,
  multisigAddMemberInstructionDiscriminator: () => multisigAddMemberInstructionDiscriminator,
  multisigAddMemberStruct: () => multisigAddMemberStruct,
  multisigAddSpendingLimitArgsBeet: () => multisigAddSpendingLimitArgsBeet,
  multisigAddSpendingLimitInstructionDiscriminator: () => multisigAddSpendingLimitInstructionDiscriminator,
  multisigAddSpendingLimitStruct: () => multisigAddSpendingLimitStruct,
  multisigBeet: () => multisigBeet,
  multisigChangeThresholdArgsBeet: () => multisigChangeThresholdArgsBeet,
  multisigChangeThresholdInstructionDiscriminator: () => multisigChangeThresholdInstructionDiscriminator,
  multisigChangeThresholdStruct: () => multisigChangeThresholdStruct,
  multisigCompiledInstructionBeet: () => multisigCompiledInstructionBeet,
  multisigCreateArgsBeet: () => multisigCreateArgsBeet,
  multisigCreateArgsV2Beet: () => multisigCreateArgsV2Beet,
  multisigCreateInstructionDiscriminator: () => multisigCreateInstructionDiscriminator,
  multisigCreateStruct: () => multisigCreateStruct,
  multisigCreateV2InstructionDiscriminator: () => multisigCreateV2InstructionDiscriminator,
  multisigCreateV2Struct: () => multisigCreateV2Struct,
  multisigDiscriminator: () => multisigDiscriminator,
  multisigMessageAddressTableLookupBeet: () => multisigMessageAddressTableLookupBeet,
  multisigRemoveMemberArgsBeet: () => multisigRemoveMemberArgsBeet,
  multisigRemoveMemberInstructionDiscriminator: () => multisigRemoveMemberInstructionDiscriminator,
  multisigRemoveMemberStruct: () => multisigRemoveMemberStruct,
  multisigRemoveSpendingLimitArgsBeet: () => multisigRemoveSpendingLimitArgsBeet,
  multisigRemoveSpendingLimitInstructionDiscriminator: () => multisigRemoveSpendingLimitInstructionDiscriminator,
  multisigRemoveSpendingLimitStruct: () => multisigRemoveSpendingLimitStruct,
  multisigSetConfigAuthorityArgsBeet: () => multisigSetConfigAuthorityArgsBeet,
  multisigSetConfigAuthorityInstructionDiscriminator: () => multisigSetConfigAuthorityInstructionDiscriminator,
  multisigSetConfigAuthorityStruct: () => multisigSetConfigAuthorityStruct,
  multisigSetRentCollectorArgsBeet: () => multisigSetRentCollectorArgsBeet,
  multisigSetRentCollectorInstructionDiscriminator: () => multisigSetRentCollectorInstructionDiscriminator,
  multisigSetRentCollectorStruct: () => multisigSetRentCollectorStruct,
  multisigSetTimeLockArgsBeet: () => multisigSetTimeLockArgsBeet,
  multisigSetTimeLockInstructionDiscriminator: () => multisigSetTimeLockInstructionDiscriminator,
  multisigSetTimeLockStruct: () => multisigSetTimeLockStruct,
  periodBeet: () => periodBeet,
  permissionsBeet: () => permissionsBeet,
  programConfigBeet: () => programConfigBeet,
  programConfigDiscriminator: () => programConfigDiscriminator,
  programConfigInitArgsBeet: () => programConfigInitArgsBeet,
  programConfigInitInstructionDiscriminator: () => programConfigInitInstructionDiscriminator,
  programConfigInitStruct: () => programConfigInitStruct,
  programConfigSetAuthorityArgsBeet: () => programConfigSetAuthorityArgsBeet,
  programConfigSetAuthorityInstructionDiscriminator: () => programConfigSetAuthorityInstructionDiscriminator,
  programConfigSetAuthorityStruct: () => programConfigSetAuthorityStruct,
  programConfigSetMultisigCreationFeeArgsBeet: () => programConfigSetMultisigCreationFeeArgsBeet,
  programConfigSetMultisigCreationFeeInstructionDiscriminator: () => programConfigSetMultisigCreationFeeInstructionDiscriminator,
  programConfigSetMultisigCreationFeeStruct: () => programConfigSetMultisigCreationFeeStruct,
  programConfigSetTreasuryArgsBeet: () => programConfigSetTreasuryArgsBeet,
  programConfigSetTreasuryInstructionDiscriminator: () => programConfigSetTreasuryInstructionDiscriminator,
  programConfigSetTreasuryStruct: () => programConfigSetTreasuryStruct,
  proposalActivateInstructionDiscriminator: () => proposalActivateInstructionDiscriminator,
  proposalActivateStruct: () => proposalActivateStruct,
  proposalApproveInstructionDiscriminator: () => proposalApproveInstructionDiscriminator,
  proposalApproveStruct: () => proposalApproveStruct,
  proposalBeet: () => proposalBeet,
  proposalCancelInstructionDiscriminator: () => proposalCancelInstructionDiscriminator,
  proposalCancelStruct: () => proposalCancelStruct,
  proposalCreateArgsBeet: () => proposalCreateArgsBeet,
  proposalCreateInstructionDiscriminator: () => proposalCreateInstructionDiscriminator,
  proposalCreateStruct: () => proposalCreateStruct,
  proposalDiscriminator: () => proposalDiscriminator,
  proposalRejectInstructionDiscriminator: () => proposalRejectInstructionDiscriminator,
  proposalRejectStruct: () => proposalRejectStruct,
  proposalStatusBeet: () => proposalStatusBeet,
  proposalVoteArgsBeet: () => proposalVoteArgsBeet,
  spendingLimitBeet: () => spendingLimitBeet,
  spendingLimitDiscriminator: () => spendingLimitDiscriminator,
  spendingLimitUseArgsBeet: () => spendingLimitUseArgsBeet,
  spendingLimitUseInstructionDiscriminator: () => spendingLimitUseInstructionDiscriminator,
  spendingLimitUseStruct: () => spendingLimitUseStruct,
  vaultBatchTransactionAccountCloseInstructionDiscriminator: () => vaultBatchTransactionAccountCloseInstructionDiscriminator,
  vaultBatchTransactionAccountCloseStruct: () => vaultBatchTransactionAccountCloseStruct,
  vaultBatchTransactionBeet: () => vaultBatchTransactionBeet,
  vaultBatchTransactionDiscriminator: () => vaultBatchTransactionDiscriminator,
  vaultTransactionAccountsCloseInstructionDiscriminator: () => vaultTransactionAccountsCloseInstructionDiscriminator,
  vaultTransactionAccountsCloseStruct: () => vaultTransactionAccountsCloseStruct,
  vaultTransactionBeet: () => vaultTransactionBeet,
  vaultTransactionCreateArgsBeet: () => vaultTransactionCreateArgsBeet,
  vaultTransactionCreateInstructionDiscriminator: () => vaultTransactionCreateInstructionDiscriminator,
  vaultTransactionCreateStruct: () => vaultTransactionCreateStruct,
  vaultTransactionDiscriminator: () => vaultTransactionDiscriminator,
  vaultTransactionExecuteInstructionDiscriminator: () => vaultTransactionExecuteInstructionDiscriminator,
  vaultTransactionExecuteStruct: () => vaultTransactionExecuteStruct,
  vaultTransactionMessageBeet: () => vaultTransactionMessageBeet,
  voteBeet: () => voteBeet
});
var import_web3 = require("@solana/web3.js");

// src/generated/accounts/Batch.ts
var web3 = __toESM(require("@solana/web3.js"));
var beet = __toESM(require("@metaplex-foundation/beet"));
var beetSolana = __toESM(require("@metaplex-foundation/beet-solana"));
var batchDiscriminator = [156, 194, 70, 44, 22, 88, 137, 44];
var Batch = class _Batch {
  constructor(multisig, creator, index, bump, vaultIndex, vaultBump, size, executedTransactionIndex) {
    this.multisig = multisig;
    this.creator = creator;
    this.index = index;
    this.bump = bump;
    this.vaultIndex = vaultIndex;
    this.vaultBump = vaultBump;
    this.size = size;
    this.executedTransactionIndex = executedTransactionIndex;
  }
  /**
   * Creates a {@link Batch} instance from the provided args.
   */
  static fromArgs(args) {
    return new _Batch(
      args.multisig,
      args.creator,
      args.index,
      args.bump,
      args.vaultIndex,
      args.vaultBump,
      args.size,
      args.executedTransactionIndex
    );
  }
  /**
   * Deserializes the {@link Batch} from the data of the provided {@link web3.AccountInfo}.
   * @returns a tuple of the account data and the offset up to which the buffer was read to obtain it.
   */
  static fromAccountInfo(accountInfo, offset = 0) {
    return _Batch.deserialize(accountInfo.data, offset);
  }
  /**
   * Retrieves the account info from the provided address and deserializes
   * the {@link Batch} from its data.
   *
   * @throws Error if no account info is found at the address or if deserialization fails
   */
  static async fromAccountAddress(connection, address, commitmentOrConfig) {
    const accountInfo = await connection.getAccountInfo(
      address,
      commitmentOrConfig
    );
    if (accountInfo == null) {
      throw new Error(`Unable to find Batch account at ${address}`);
    }
    return _Batch.fromAccountInfo(accountInfo, 0)[0];
  }
  /**
   * Provides a {@link web3.Connection.getProgramAccounts} config builder,
   * to fetch accounts matching filters that can be specified via that builder.
   *
   * @param programId - the program that owns the accounts we are filtering
   */
  static gpaBuilder(programId = new web3.PublicKey(
    "SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf"
  )) {
    return beetSolana.GpaBuilder.fromStruct(programId, batchBeet);
  }
  /**
   * Deserializes the {@link Batch} from the provided data Buffer.
   * @returns a tuple of the account data and the offset up to which the buffer was read to obtain it.
   */
  static deserialize(buf, offset = 0) {
    return batchBeet.deserialize(buf, offset);
  }
  /**
   * Serializes the {@link Batch} into a Buffer.
   * @returns a tuple of the created Buffer and the offset up to which the buffer was written to store it.
   */
  serialize() {
    return batchBeet.serialize({
      accountDiscriminator: batchDiscriminator,
      ...this
    });
  }
  /**
   * Returns the byteSize of a {@link Buffer} holding the serialized data of
   * {@link Batch}
   */
  static get byteSize() {
    return batchBeet.byteSize;
  }
  /**
   * Fetches the minimum balance needed to exempt an account holding
   * {@link Batch} data from rent
   *
   * @param connection used to retrieve the rent exemption information
   */
  static async getMinimumBalanceForRentExemption(connection, commitment) {
    return connection.getMinimumBalanceForRentExemption(
      _Batch.byteSize,
      commitment
    );
  }
  /**
   * Determines if the provided {@link Buffer} has the correct byte size to
   * hold {@link Batch} data.
   */
  static hasCorrectByteSize(buf, offset = 0) {
    return buf.byteLength - offset === _Batch.byteSize;
  }
  /**
   * Returns a readable version of {@link Batch} properties
   * and can be used to convert to JSON and/or logging
   */
  pretty() {
    return {
      multisig: this.multisig.toBase58(),
      creator: this.creator.toBase58(),
      index: (() => {
        const x = this.index;
        if (typeof x.toNumber === "function") {
          try {
            return x.toNumber();
          } catch (_) {
            return x;
          }
        }
        return x;
      })(),
      bump: this.bump,
      vaultIndex: this.vaultIndex,
      vaultBump: this.vaultBump,
      size: this.size,
      executedTransactionIndex: this.executedTransactionIndex
    };
  }
};
var batchBeet = new beet.BeetStruct(
  [
    ["accountDiscriminator", beet.uniformFixedSizeArray(beet.u8, 8)],
    ["multisig", beetSolana.publicKey],
    ["creator", beetSolana.publicKey],
    ["index", beet.u64],
    ["bump", beet.u8],
    ["vaultIndex", beet.u8],
    ["vaultBump", beet.u8],
    ["size", beet.u32],
    ["executedTransactionIndex", beet.u32]
  ],
  Batch.fromArgs,
  "Batch"
);

// src/generated/accounts/ConfigTransaction.ts
var web32 = __toESM(require("@solana/web3.js"));
var beet6 = __toESM(require("@metaplex-foundation/beet"));
var beetSolana4 = __toESM(require("@metaplex-foundation/beet-solana"));

// src/generated/types/ConfigAction.ts
var beet5 = __toESM(require("@metaplex-foundation/beet"));
var beetSolana3 = __toESM(require("@metaplex-foundation/beet-solana"));

// src/generated/types/Member.ts
var beetSolana2 = __toESM(require("@metaplex-foundation/beet-solana"));
var beet3 = __toESM(require("@metaplex-foundation/beet"));

// src/generated/types/Permissions.ts
var beet2 = __toESM(require("@metaplex-foundation/beet"));
var permissionsBeet = new beet2.BeetArgsStruct(
  [["mask", beet2.u8]],
  "Permissions"
);

// src/generated/types/Member.ts
var memberBeet = new beet3.BeetArgsStruct(
  [
    ["key", beetSolana2.publicKey],
    ["permissions", permissionsBeet]
  ],
  "Member"
);

// src/generated/types/Period.ts
var beet4 = __toESM(require("@metaplex-foundation/beet"));
var Period = /* @__PURE__ */ ((Period6) => {
  Period6[Period6["OneTime"] = 0] = "OneTime";
  Period6[Period6["Day"] = 1] = "Day";
  Period6[Period6["Week"] = 2] = "Week";
  Period6[Period6["Month"] = 3] = "Month";
  return Period6;
})(Period || {});
var periodBeet = beet4.fixedScalarEnum(Period);

// src/generated/types/ConfigAction.ts
var isConfigActionAddMember = (x) => x.__kind === "AddMember";
var isConfigActionRemoveMember = (x) => x.__kind === "RemoveMember";
var isConfigActionChangeThreshold = (x) => x.__kind === "ChangeThreshold";
var isConfigActionSetTimeLock = (x) => x.__kind === "SetTimeLock";
var isConfigActionAddSpendingLimit = (x) => x.__kind === "AddSpendingLimit";
var isConfigActionRemoveSpendingLimit = (x) => x.__kind === "RemoveSpendingLimit";
var isConfigActionSetRentCollector = (x) => x.__kind === "SetRentCollector";
var configActionBeet = beet5.dataEnum([
  [
    "AddMember",
    new beet5.BeetArgsStruct(
      [["newMember", memberBeet]],
      'ConfigActionRecord["AddMember"]'
    )
  ],
  [
    "RemoveMember",
    new beet5.BeetArgsStruct(
      [["oldMember", beetSolana3.publicKey]],
      'ConfigActionRecord["RemoveMember"]'
    )
  ],
  [
    "ChangeThreshold",
    new beet5.BeetArgsStruct(
      [["newThreshold", beet5.u16]],
      'ConfigActionRecord["ChangeThreshold"]'
    )
  ],
  [
    "SetTimeLock",
    new beet5.BeetArgsStruct(
      [["newTimeLock", beet5.u32]],
      'ConfigActionRecord["SetTimeLock"]'
    )
  ],
  [
    "AddSpendingLimit",
    new beet5.FixableBeetArgsStruct(
      [
        ["createKey", beetSolana3.publicKey],
        ["vaultIndex", beet5.u8],
        ["mint", beetSolana3.publicKey],
        ["amount", beet5.u64],
        ["period", periodBeet],
        ["members", beet5.array(beetSolana3.publicKey)],
        ["destinations", beet5.array(beetSolana3.publicKey)]
      ],
      'ConfigActionRecord["AddSpendingLimit"]'
    )
  ],
  [
    "RemoveSpendingLimit",
    new beet5.BeetArgsStruct(
      [["spendingLimit", beetSolana3.publicKey]],
      'ConfigActionRecord["RemoveSpendingLimit"]'
    )
  ],
  [
    "SetRentCollector",
    new beet5.FixableBeetArgsStruct(
      [["newRentCollector", beet5.coption(beetSolana3.publicKey)]],
      'ConfigActionRecord["SetRentCollector"]'
    )
  ]
]);

// src/generated/accounts/ConfigTransaction.ts
var configTransactionDiscriminator = [94, 8, 4, 35, 113, 139, 139, 112];
var ConfigTransaction = class _ConfigTransaction {
  constructor(multisig, creator, index, bump, actions) {
    this.multisig = multisig;
    this.creator = creator;
    this.index = index;
    this.bump = bump;
    this.actions = actions;
  }
  /**
   * Creates a {@link ConfigTransaction} instance from the provided args.
   */
  static fromArgs(args) {
    return new _ConfigTransaction(
      args.multisig,
      args.creator,
      args.index,
      args.bump,
      args.actions
    );
  }
  /**
   * Deserializes the {@link ConfigTransaction} from the data of the provided {@link web3.AccountInfo}.
   * @returns a tuple of the account data and the offset up to which the buffer was read to obtain it.
   */
  static fromAccountInfo(accountInfo, offset = 0) {
    return _ConfigTransaction.deserialize(accountInfo.data, offset);
  }
  /**
   * Retrieves the account info from the provided address and deserializes
   * the {@link ConfigTransaction} from its data.
   *
   * @throws Error if no account info is found at the address or if deserialization fails
   */
  static async fromAccountAddress(connection, address, commitmentOrConfig) {
    const accountInfo = await connection.getAccountInfo(
      address,
      commitmentOrConfig
    );
    if (accountInfo == null) {
      throw new Error(`Unable to find ConfigTransaction account at ${address}`);
    }
    return _ConfigTransaction.fromAccountInfo(accountInfo, 0)[0];
  }
  /**
   * Provides a {@link web3.Connection.getProgramAccounts} config builder,
   * to fetch accounts matching filters that can be specified via that builder.
   *
   * @param programId - the program that owns the accounts we are filtering
   */
  static gpaBuilder(programId = new web32.PublicKey(
    "SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf"
  )) {
    return beetSolana4.GpaBuilder.fromStruct(programId, configTransactionBeet);
  }
  /**
   * Deserializes the {@link ConfigTransaction} from the provided data Buffer.
   * @returns a tuple of the account data and the offset up to which the buffer was read to obtain it.
   */
  static deserialize(buf, offset = 0) {
    return configTransactionBeet.deserialize(buf, offset);
  }
  /**
   * Serializes the {@link ConfigTransaction} into a Buffer.
   * @returns a tuple of the created Buffer and the offset up to which the buffer was written to store it.
   */
  serialize() {
    return configTransactionBeet.serialize({
      accountDiscriminator: configTransactionDiscriminator,
      ...this
    });
  }
  /**
   * Returns the byteSize of a {@link Buffer} holding the serialized data of
   * {@link ConfigTransaction} for the provided args.
   *
   * @param args need to be provided since the byte size for this account
   * depends on them
   */
  static byteSize(args) {
    const instance = _ConfigTransaction.fromArgs(args);
    return configTransactionBeet.toFixedFromValue({
      accountDiscriminator: configTransactionDiscriminator,
      ...instance
    }).byteSize;
  }
  /**
   * Fetches the minimum balance needed to exempt an account holding
   * {@link ConfigTransaction} data from rent
   *
   * @param args need to be provided since the byte size for this account
   * depends on them
   * @param connection used to retrieve the rent exemption information
   */
  static async getMinimumBalanceForRentExemption(args, connection, commitment) {
    return connection.getMinimumBalanceForRentExemption(
      _ConfigTransaction.byteSize(args),
      commitment
    );
  }
  /**
   * Returns a readable version of {@link ConfigTransaction} properties
   * and can be used to convert to JSON and/or logging
   */
  pretty() {
    return {
      multisig: this.multisig.toBase58(),
      creator: this.creator.toBase58(),
      index: (() => {
        const x = this.index;
        if (typeof x.toNumber === "function") {
          try {
            return x.toNumber();
          } catch (_) {
            return x;
          }
        }
        return x;
      })(),
      bump: this.bump,
      actions: this.actions
    };
  }
};
var configTransactionBeet = new beet6.FixableBeetStruct(
  [
    ["accountDiscriminator", beet6.uniformFixedSizeArray(beet6.u8, 8)],
    ["multisig", beetSolana4.publicKey],
    ["creator", beetSolana4.publicKey],
    ["index", beet6.u64],
    ["bump", beet6.u8],
    ["actions", beet6.array(configActionBeet)]
  ],
  ConfigTransaction.fromArgs,
  "ConfigTransaction"
);

// src/generated/accounts/Multisig.ts
var web33 = __toESM(require("@solana/web3.js"));
var beet7 = __toESM(require("@metaplex-foundation/beet"));
var beetSolana5 = __toESM(require("@metaplex-foundation/beet-solana"));
var multisigDiscriminator = [224, 116, 121, 186, 68, 161, 79, 236];
var Multisig = class _Multisig {
  constructor(createKey, configAuthority, threshold, timeLock, transactionIndex, staleTransactionIndex, rentCollector, bump, members) {
    this.createKey = createKey;
    this.configAuthority = configAuthority;
    this.threshold = threshold;
    this.timeLock = timeLock;
    this.transactionIndex = transactionIndex;
    this.staleTransactionIndex = staleTransactionIndex;
    this.rentCollector = rentCollector;
    this.bump = bump;
    this.members = members;
  }
  /**
   * Creates a {@link Multisig} instance from the provided args.
   */
  static fromArgs(args) {
    return new _Multisig(
      args.createKey,
      args.configAuthority,
      args.threshold,
      args.timeLock,
      args.transactionIndex,
      args.staleTransactionIndex,
      args.rentCollector,
      args.bump,
      args.members
    );
  }
  /**
   * Deserializes the {@link Multisig} from the data of the provided {@link web3.AccountInfo}.
   * @returns a tuple of the account data and the offset up to which the buffer was read to obtain it.
   */
  static fromAccountInfo(accountInfo, offset = 0) {
    return _Multisig.deserialize(accountInfo.data, offset);
  }
  /**
   * Retrieves the account info from the provided address and deserializes
   * the {@link Multisig} from its data.
   *
   * @throws Error if no account info is found at the address or if deserialization fails
   */
  static async fromAccountAddress(connection, address, commitmentOrConfig) {
    const accountInfo = await connection.getAccountInfo(
      address,
      commitmentOrConfig
    );
    if (accountInfo == null) {
      throw new Error(`Unable to find Multisig account at ${address}`);
    }
    return _Multisig.fromAccountInfo(accountInfo, 0)[0];
  }
  /**
   * Provides a {@link web3.Connection.getProgramAccounts} config builder,
   * to fetch accounts matching filters that can be specified via that builder.
   *
   * @param programId - the program that owns the accounts we are filtering
   */
  static gpaBuilder(programId = new web33.PublicKey(
    "SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf"
  )) {
    return beetSolana5.GpaBuilder.fromStruct(programId, multisigBeet);
  }
  /**
   * Deserializes the {@link Multisig} from the provided data Buffer.
   * @returns a tuple of the account data and the offset up to which the buffer was read to obtain it.
   */
  static deserialize(buf, offset = 0) {
    return multisigBeet.deserialize(buf, offset);
  }
  /**
   * Serializes the {@link Multisig} into a Buffer.
   * @returns a tuple of the created Buffer and the offset up to which the buffer was written to store it.
   */
  serialize() {
    return multisigBeet.serialize({
      accountDiscriminator: multisigDiscriminator,
      ...this
    });
  }
  /**
   * Returns the byteSize of a {@link Buffer} holding the serialized data of
   * {@link Multisig} for the provided args.
   *
   * @param args need to be provided since the byte size for this account
   * depends on them
   */
  static byteSize(args) {
    const instance = _Multisig.fromArgs(args);
    return multisigBeet.toFixedFromValue({
      accountDiscriminator: multisigDiscriminator,
      ...instance
    }).byteSize;
  }
  /**
   * Fetches the minimum balance needed to exempt an account holding
   * {@link Multisig} data from rent
   *
   * @param args need to be provided since the byte size for this account
   * depends on them
   * @param connection used to retrieve the rent exemption information
   */
  static async getMinimumBalanceForRentExemption(args, connection, commitment) {
    return connection.getMinimumBalanceForRentExemption(
      _Multisig.byteSize(args),
      commitment
    );
  }
  /**
   * Returns a readable version of {@link Multisig} properties
   * and can be used to convert to JSON and/or logging
   */
  pretty() {
    return {
      createKey: this.createKey.toBase58(),
      configAuthority: this.configAuthority.toBase58(),
      threshold: this.threshold,
      timeLock: this.timeLock,
      transactionIndex: (() => {
        const x = this.transactionIndex;
        if (typeof x.toNumber === "function") {
          try {
            return x.toNumber();
          } catch (_) {
            return x;
          }
        }
        return x;
      })(),
      staleTransactionIndex: (() => {
        const x = this.staleTransactionIndex;
        if (typeof x.toNumber === "function") {
          try {
            return x.toNumber();
          } catch (_) {
            return x;
          }
        }
        return x;
      })(),
      rentCollector: this.rentCollector,
      bump: this.bump,
      members: this.members
    };
  }
};
var multisigBeet = new beet7.FixableBeetStruct(
  [
    ["accountDiscriminator", beet7.uniformFixedSizeArray(beet7.u8, 8)],
    ["createKey", beetSolana5.publicKey],
    ["configAuthority", beetSolana5.publicKey],
    ["threshold", beet7.u16],
    ["timeLock", beet7.u32],
    ["transactionIndex", beet7.u64],
    ["staleTransactionIndex", beet7.u64],
    ["rentCollector", beet7.coption(beetSolana5.publicKey)],
    ["bump", beet7.u8],
    ["members", beet7.array(memberBeet)]
  ],
  Multisig.fromArgs,
  "Multisig"
);

// src/generated/accounts/ProgramConfig.ts
var web34 = __toESM(require("@solana/web3.js"));
var beet8 = __toESM(require("@metaplex-foundation/beet"));
var beetSolana6 = __toESM(require("@metaplex-foundation/beet-solana"));
var programConfigDiscriminator = [196, 210, 90, 231, 144, 149, 140, 63];
var ProgramConfig = class _ProgramConfig {
  constructor(authority, multisigCreationFee, treasury, reserved) {
    this.authority = authority;
    this.multisigCreationFee = multisigCreationFee;
    this.treasury = treasury;
    this.reserved = reserved;
  }
  /**
   * Creates a {@link ProgramConfig} instance from the provided args.
   */
  static fromArgs(args) {
    return new _ProgramConfig(
      args.authority,
      args.multisigCreationFee,
      args.treasury,
      args.reserved
    );
  }
  /**
   * Deserializes the {@link ProgramConfig} from the data of the provided {@link web3.AccountInfo}.
   * @returns a tuple of the account data and the offset up to which the buffer was read to obtain it.
   */
  static fromAccountInfo(accountInfo, offset = 0) {
    return _ProgramConfig.deserialize(accountInfo.data, offset);
  }
  /**
   * Retrieves the account info from the provided address and deserializes
   * the {@link ProgramConfig} from its data.
   *
   * @throws Error if no account info is found at the address or if deserialization fails
   */
  static async fromAccountAddress(connection, address, commitmentOrConfig) {
    const accountInfo = await connection.getAccountInfo(
      address,
      commitmentOrConfig
    );
    if (accountInfo == null) {
      throw new Error(`Unable to find ProgramConfig account at ${address}`);
    }
    return _ProgramConfig.fromAccountInfo(accountInfo, 0)[0];
  }
  /**
   * Provides a {@link web3.Connection.getProgramAccounts} config builder,
   * to fetch accounts matching filters that can be specified via that builder.
   *
   * @param programId - the program that owns the accounts we are filtering
   */
  static gpaBuilder(programId = new web34.PublicKey(
    "SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf"
  )) {
    return beetSolana6.GpaBuilder.fromStruct(programId, programConfigBeet);
  }
  /**
   * Deserializes the {@link ProgramConfig} from the provided data Buffer.
   * @returns a tuple of the account data and the offset up to which the buffer was read to obtain it.
   */
  static deserialize(buf, offset = 0) {
    return programConfigBeet.deserialize(buf, offset);
  }
  /**
   * Serializes the {@link ProgramConfig} into a Buffer.
   * @returns a tuple of the created Buffer and the offset up to which the buffer was written to store it.
   */
  serialize() {
    return programConfigBeet.serialize({
      accountDiscriminator: programConfigDiscriminator,
      ...this
    });
  }
  /**
   * Returns the byteSize of a {@link Buffer} holding the serialized data of
   * {@link ProgramConfig}
   */
  static get byteSize() {
    return programConfigBeet.byteSize;
  }
  /**
   * Fetches the minimum balance needed to exempt an account holding
   * {@link ProgramConfig} data from rent
   *
   * @param connection used to retrieve the rent exemption information
   */
  static async getMinimumBalanceForRentExemption(connection, commitment) {
    return connection.getMinimumBalanceForRentExemption(
      _ProgramConfig.byteSize,
      commitment
    );
  }
  /**
   * Determines if the provided {@link Buffer} has the correct byte size to
   * hold {@link ProgramConfig} data.
   */
  static hasCorrectByteSize(buf, offset = 0) {
    return buf.byteLength - offset === _ProgramConfig.byteSize;
  }
  /**
   * Returns a readable version of {@link ProgramConfig} properties
   * and can be used to convert to JSON and/or logging
   */
  pretty() {
    return {
      authority: this.authority.toBase58(),
      multisigCreationFee: (() => {
        const x = this.multisigCreationFee;
        if (typeof x.toNumber === "function") {
          try {
            return x.toNumber();
          } catch (_) {
            return x;
          }
        }
        return x;
      })(),
      treasury: this.treasury.toBase58(),
      reserved: this.reserved
    };
  }
};
var programConfigBeet = new beet8.BeetStruct(
  [
    ["accountDiscriminator", beet8.uniformFixedSizeArray(beet8.u8, 8)],
    ["authority", beetSolana6.publicKey],
    ["multisigCreationFee", beet8.u64],
    ["treasury", beetSolana6.publicKey],
    ["reserved", beet8.uniformFixedSizeArray(beet8.u8, 64)]
  ],
  ProgramConfig.fromArgs,
  "ProgramConfig"
);

// src/generated/accounts/Proposal.ts
var web35 = __toESM(require("@solana/web3.js"));
var beet10 = __toESM(require("@metaplex-foundation/beet"));
var beetSolana7 = __toESM(require("@metaplex-foundation/beet-solana"));

// src/generated/types/ProposalStatus.ts
var beet9 = __toESM(require("@metaplex-foundation/beet"));
var isProposalStatusDraft = (x) => x.__kind === "Draft";
var isProposalStatusActive = (x) => x.__kind === "Active";
var isProposalStatusRejected = (x) => x.__kind === "Rejected";
var isProposalStatusApproved = (x) => x.__kind === "Approved";
var isProposalStatusExecuting = (x) => x.__kind === "Executing";
var isProposalStatusExecuted = (x) => x.__kind === "Executed";
var isProposalStatusCancelled = (x) => x.__kind === "Cancelled";
var proposalStatusBeet = beet9.dataEnum([
  [
    "Draft",
    new beet9.BeetArgsStruct(
      [["timestamp", beet9.i64]],
      'ProposalStatusRecord["Draft"]'
    )
  ],
  [
    "Active",
    new beet9.BeetArgsStruct(
      [["timestamp", beet9.i64]],
      'ProposalStatusRecord["Active"]'
    )
  ],
  [
    "Rejected",
    new beet9.BeetArgsStruct(
      [["timestamp", beet9.i64]],
      'ProposalStatusRecord["Rejected"]'
    )
  ],
  [
    "Approved",
    new beet9.BeetArgsStruct(
      [["timestamp", beet9.i64]],
      'ProposalStatusRecord["Approved"]'
    )
  ],
  ["Executing", beet9.unit],
  [
    "Executed",
    new beet9.BeetArgsStruct(
      [["timestamp", beet9.i64]],
      'ProposalStatusRecord["Executed"]'
    )
  ],
  [
    "Cancelled",
    new beet9.BeetArgsStruct(
      [["timestamp", beet9.i64]],
      'ProposalStatusRecord["Cancelled"]'
    )
  ]
]);

// src/generated/accounts/Proposal.ts
var proposalDiscriminator = [26, 94, 189, 187, 116, 136, 53, 33];
var Proposal = class _Proposal {
  constructor(multisig, transactionIndex, status, bump, approved, rejected, cancelled) {
    this.multisig = multisig;
    this.transactionIndex = transactionIndex;
    this.status = status;
    this.bump = bump;
    this.approved = approved;
    this.rejected = rejected;
    this.cancelled = cancelled;
  }
  /**
   * Creates a {@link Proposal} instance from the provided args.
   */
  static fromArgs(args) {
    return new _Proposal(
      args.multisig,
      args.transactionIndex,
      args.status,
      args.bump,
      args.approved,
      args.rejected,
      args.cancelled
    );
  }
  /**
   * Deserializes the {@link Proposal} from the data of the provided {@link web3.AccountInfo}.
   * @returns a tuple of the account data and the offset up to which the buffer was read to obtain it.
   */
  static fromAccountInfo(accountInfo, offset = 0) {
    return _Proposal.deserialize(accountInfo.data, offset);
  }
  /**
   * Retrieves the account info from the provided address and deserializes
   * the {@link Proposal} from its data.
   *
   * @throws Error if no account info is found at the address or if deserialization fails
   */
  static async fromAccountAddress(connection, address, commitmentOrConfig) {
    const accountInfo = await connection.getAccountInfo(
      address,
      commitmentOrConfig
    );
    if (accountInfo == null) {
      throw new Error(`Unable to find Proposal account at ${address}`);
    }
    return _Proposal.fromAccountInfo(accountInfo, 0)[0];
  }
  /**
   * Provides a {@link web3.Connection.getProgramAccounts} config builder,
   * to fetch accounts matching filters that can be specified via that builder.
   *
   * @param programId - the program that owns the accounts we are filtering
   */
  static gpaBuilder(programId = new web35.PublicKey(
    "SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf"
  )) {
    return beetSolana7.GpaBuilder.fromStruct(programId, proposalBeet);
  }
  /**
   * Deserializes the {@link Proposal} from the provided data Buffer.
   * @returns a tuple of the account data and the offset up to which the buffer was read to obtain it.
   */
  static deserialize(buf, offset = 0) {
    return proposalBeet.deserialize(buf, offset);
  }
  /**
   * Serializes the {@link Proposal} into a Buffer.
   * @returns a tuple of the created Buffer and the offset up to which the buffer was written to store it.
   */
  serialize() {
    return proposalBeet.serialize({
      accountDiscriminator: proposalDiscriminator,
      ...this
    });
  }
  /**
   * Returns the byteSize of a {@link Buffer} holding the serialized data of
   * {@link Proposal} for the provided args.
   *
   * @param args need to be provided since the byte size for this account
   * depends on them
   */
  static byteSize(args) {
    const instance = _Proposal.fromArgs(args);
    return proposalBeet.toFixedFromValue({
      accountDiscriminator: proposalDiscriminator,
      ...instance
    }).byteSize;
  }
  /**
   * Fetches the minimum balance needed to exempt an account holding
   * {@link Proposal} data from rent
   *
   * @param args need to be provided since the byte size for this account
   * depends on them
   * @param connection used to retrieve the rent exemption information
   */
  static async getMinimumBalanceForRentExemption(args, connection, commitment) {
    return connection.getMinimumBalanceForRentExemption(
      _Proposal.byteSize(args),
      commitment
    );
  }
  /**
   * Returns a readable version of {@link Proposal} properties
   * and can be used to convert to JSON and/or logging
   */
  pretty() {
    return {
      multisig: this.multisig.toBase58(),
      transactionIndex: (() => {
        const x = this.transactionIndex;
        if (typeof x.toNumber === "function") {
          try {
            return x.toNumber();
          } catch (_) {
            return x;
          }
        }
        return x;
      })(),
      status: this.status.__kind,
      bump: this.bump,
      approved: this.approved,
      rejected: this.rejected,
      cancelled: this.cancelled
    };
  }
};
var proposalBeet = new beet10.FixableBeetStruct(
  [
    ["accountDiscriminator", beet10.uniformFixedSizeArray(beet10.u8, 8)],
    ["multisig", beetSolana7.publicKey],
    ["transactionIndex", beet10.u64],
    ["status", proposalStatusBeet],
    ["bump", beet10.u8],
    ["approved", beet10.array(beetSolana7.publicKey)],
    ["rejected", beet10.array(beetSolana7.publicKey)],
    ["cancelled", beet10.array(beetSolana7.publicKey)]
  ],
  Proposal.fromArgs,
  "Proposal"
);

// src/generated/accounts/SpendingLimit.ts
var web36 = __toESM(require("@solana/web3.js"));
var beet11 = __toESM(require("@metaplex-foundation/beet"));
var beetSolana8 = __toESM(require("@metaplex-foundation/beet-solana"));
var spendingLimitDiscriminator = [10, 201, 27, 160, 218, 195, 222, 152];
var SpendingLimit = class _SpendingLimit {
  constructor(multisig, createKey, vaultIndex, mint, amount, period, remainingAmount, lastReset, bump, members, destinations) {
    this.multisig = multisig;
    this.createKey = createKey;
    this.vaultIndex = vaultIndex;
    this.mint = mint;
    this.amount = amount;
    this.period = period;
    this.remainingAmount = remainingAmount;
    this.lastReset = lastReset;
    this.bump = bump;
    this.members = members;
    this.destinations = destinations;
  }
  /**
   * Creates a {@link SpendingLimit} instance from the provided args.
   */
  static fromArgs(args) {
    return new _SpendingLimit(
      args.multisig,
      args.createKey,
      args.vaultIndex,
      args.mint,
      args.amount,
      args.period,
      args.remainingAmount,
      args.lastReset,
      args.bump,
      args.members,
      args.destinations
    );
  }
  /**
   * Deserializes the {@link SpendingLimit} from the data of the provided {@link web3.AccountInfo}.
   * @returns a tuple of the account data and the offset up to which the buffer was read to obtain it.
   */
  static fromAccountInfo(accountInfo, offset = 0) {
    return _SpendingLimit.deserialize(accountInfo.data, offset);
  }
  /**
   * Retrieves the account info from the provided address and deserializes
   * the {@link SpendingLimit} from its data.
   *
   * @throws Error if no account info is found at the address or if deserialization fails
   */
  static async fromAccountAddress(connection, address, commitmentOrConfig) {
    const accountInfo = await connection.getAccountInfo(
      address,
      commitmentOrConfig
    );
    if (accountInfo == null) {
      throw new Error(`Unable to find SpendingLimit account at ${address}`);
    }
    return _SpendingLimit.fromAccountInfo(accountInfo, 0)[0];
  }
  /**
   * Provides a {@link web3.Connection.getProgramAccounts} config builder,
   * to fetch accounts matching filters that can be specified via that builder.
   *
   * @param programId - the program that owns the accounts we are filtering
   */
  static gpaBuilder(programId = new web36.PublicKey(
    "SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf"
  )) {
    return beetSolana8.GpaBuilder.fromStruct(programId, spendingLimitBeet);
  }
  /**
   * Deserializes the {@link SpendingLimit} from the provided data Buffer.
   * @returns a tuple of the account data and the offset up to which the buffer was read to obtain it.
   */
  static deserialize(buf, offset = 0) {
    return spendingLimitBeet.deserialize(buf, offset);
  }
  /**
   * Serializes the {@link SpendingLimit} into a Buffer.
   * @returns a tuple of the created Buffer and the offset up to which the buffer was written to store it.
   */
  serialize() {
    return spendingLimitBeet.serialize({
      accountDiscriminator: spendingLimitDiscriminator,
      ...this
    });
  }
  /**
   * Returns the byteSize of a {@link Buffer} holding the serialized data of
   * {@link SpendingLimit} for the provided args.
   *
   * @param args need to be provided since the byte size for this account
   * depends on them
   */
  static byteSize(args) {
    const instance = _SpendingLimit.fromArgs(args);
    return spendingLimitBeet.toFixedFromValue({
      accountDiscriminator: spendingLimitDiscriminator,
      ...instance
    }).byteSize;
  }
  /**
   * Fetches the minimum balance needed to exempt an account holding
   * {@link SpendingLimit} data from rent
   *
   * @param args need to be provided since the byte size for this account
   * depends on them
   * @param connection used to retrieve the rent exemption information
   */
  static async getMinimumBalanceForRentExemption(args, connection, commitment) {
    return connection.getMinimumBalanceForRentExemption(
      _SpendingLimit.byteSize(args),
      commitment
    );
  }
  /**
   * Returns a readable version of {@link SpendingLimit} properties
   * and can be used to convert to JSON and/or logging
   */
  pretty() {
    return {
      multisig: this.multisig.toBase58(),
      createKey: this.createKey.toBase58(),
      vaultIndex: this.vaultIndex,
      mint: this.mint.toBase58(),
      amount: (() => {
        const x = this.amount;
        if (typeof x.toNumber === "function") {
          try {
            return x.toNumber();
          } catch (_) {
            return x;
          }
        }
        return x;
      })(),
      period: "Period." + Period[this.period],
      remainingAmount: (() => {
        const x = this.remainingAmount;
        if (typeof x.toNumber === "function") {
          try {
            return x.toNumber();
          } catch (_) {
            return x;
          }
        }
        return x;
      })(),
      lastReset: (() => {
        const x = this.lastReset;
        if (typeof x.toNumber === "function") {
          try {
            return x.toNumber();
          } catch (_) {
            return x;
          }
        }
        return x;
      })(),
      bump: this.bump,
      members: this.members,
      destinations: this.destinations
    };
  }
};
var spendingLimitBeet = new beet11.FixableBeetStruct(
  [
    ["accountDiscriminator", beet11.uniformFixedSizeArray(beet11.u8, 8)],
    ["multisig", beetSolana8.publicKey],
    ["createKey", beetSolana8.publicKey],
    ["vaultIndex", beet11.u8],
    ["mint", beetSolana8.publicKey],
    ["amount", beet11.u64],
    ["period", periodBeet],
    ["remainingAmount", beet11.u64],
    ["lastReset", beet11.i64],
    ["bump", beet11.u8],
    ["members", beet11.array(beetSolana8.publicKey)],
    ["destinations", beet11.array(beetSolana8.publicKey)]
  ],
  SpendingLimit.fromArgs,
  "SpendingLimit"
);

// src/generated/accounts/VaultBatchTransaction.ts
var beet15 = __toESM(require("@metaplex-foundation/beet"));
var web37 = __toESM(require("@solana/web3.js"));
var beetSolana11 = __toESM(require("@metaplex-foundation/beet-solana"));

// src/generated/types/VaultTransactionMessage.ts
var beet14 = __toESM(require("@metaplex-foundation/beet"));
var beetSolana10 = __toESM(require("@metaplex-foundation/beet-solana"));

// src/generated/types/MultisigCompiledInstruction.ts
var beet12 = __toESM(require("@metaplex-foundation/beet"));
var multisigCompiledInstructionBeet = new beet12.FixableBeetArgsStruct(
  [
    ["programIdIndex", beet12.u8],
    ["accountIndexes", beet12.bytes],
    ["data", beet12.bytes]
  ],
  "MultisigCompiledInstruction"
);

// src/generated/types/MultisigMessageAddressTableLookup.ts
var beetSolana9 = __toESM(require("@metaplex-foundation/beet-solana"));
var beet13 = __toESM(require("@metaplex-foundation/beet"));
var multisigMessageAddressTableLookupBeet = new beet13.FixableBeetArgsStruct(
  [
    ["accountKey", beetSolana9.publicKey],
    ["writableIndexes", beet13.bytes],
    ["readonlyIndexes", beet13.bytes]
  ],
  "MultisigMessageAddressTableLookup"
);

// src/generated/types/VaultTransactionMessage.ts
var vaultTransactionMessageBeet = new beet14.FixableBeetArgsStruct(
  [
    ["numSigners", beet14.u8],
    ["numWritableSigners", beet14.u8],
    ["numWritableNonSigners", beet14.u8],
    ["accountKeys", beet14.array(beetSolana10.publicKey)],
    ["instructions", beet14.array(multisigCompiledInstructionBeet)],
    [
      "addressTableLookups",
      beet14.array(multisigMessageAddressTableLookupBeet)
    ]
  ],
  "VaultTransactionMessage"
);

// src/generated/accounts/VaultBatchTransaction.ts
var vaultBatchTransactionDiscriminator = [
  196,
  121,
  46,
  36,
  12,
  19,
  252,
  7
];
var VaultBatchTransaction = class _VaultBatchTransaction {
  constructor(bump, ephemeralSignerBumps, message) {
    this.bump = bump;
    this.ephemeralSignerBumps = ephemeralSignerBumps;
    this.message = message;
  }
  /**
   * Creates a {@link VaultBatchTransaction} instance from the provided args.
   */
  static fromArgs(args) {
    return new _VaultBatchTransaction(
      args.bump,
      args.ephemeralSignerBumps,
      args.message
    );
  }
  /**
   * Deserializes the {@link VaultBatchTransaction} from the data of the provided {@link web3.AccountInfo}.
   * @returns a tuple of the account data and the offset up to which the buffer was read to obtain it.
   */
  static fromAccountInfo(accountInfo, offset = 0) {
    return _VaultBatchTransaction.deserialize(accountInfo.data, offset);
  }
  /**
   * Retrieves the account info from the provided address and deserializes
   * the {@link VaultBatchTransaction} from its data.
   *
   * @throws Error if no account info is found at the address or if deserialization fails
   */
  static async fromAccountAddress(connection, address, commitmentOrConfig) {
    const accountInfo = await connection.getAccountInfo(
      address,
      commitmentOrConfig
    );
    if (accountInfo == null) {
      throw new Error(
        `Unable to find VaultBatchTransaction account at ${address}`
      );
    }
    return _VaultBatchTransaction.fromAccountInfo(accountInfo, 0)[0];
  }
  /**
   * Provides a {@link web3.Connection.getProgramAccounts} config builder,
   * to fetch accounts matching filters that can be specified via that builder.
   *
   * @param programId - the program that owns the accounts we are filtering
   */
  static gpaBuilder(programId = new web37.PublicKey(
    "SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf"
  )) {
    return beetSolana11.GpaBuilder.fromStruct(
      programId,
      vaultBatchTransactionBeet
    );
  }
  /**
   * Deserializes the {@link VaultBatchTransaction} from the provided data Buffer.
   * @returns a tuple of the account data and the offset up to which the buffer was read to obtain it.
   */
  static deserialize(buf, offset = 0) {
    return vaultBatchTransactionBeet.deserialize(buf, offset);
  }
  /**
   * Serializes the {@link VaultBatchTransaction} into a Buffer.
   * @returns a tuple of the created Buffer and the offset up to which the buffer was written to store it.
   */
  serialize() {
    return vaultBatchTransactionBeet.serialize({
      accountDiscriminator: vaultBatchTransactionDiscriminator,
      ...this
    });
  }
  /**
   * Returns the byteSize of a {@link Buffer} holding the serialized data of
   * {@link VaultBatchTransaction} for the provided args.
   *
   * @param args need to be provided since the byte size for this account
   * depends on them
   */
  static byteSize(args) {
    const instance = _VaultBatchTransaction.fromArgs(args);
    return vaultBatchTransactionBeet.toFixedFromValue({
      accountDiscriminator: vaultBatchTransactionDiscriminator,
      ...instance
    }).byteSize;
  }
  /**
   * Fetches the minimum balance needed to exempt an account holding
   * {@link VaultBatchTransaction} data from rent
   *
   * @param args need to be provided since the byte size for this account
   * depends on them
   * @param connection used to retrieve the rent exemption information
   */
  static async getMinimumBalanceForRentExemption(args, connection, commitment) {
    return connection.getMinimumBalanceForRentExemption(
      _VaultBatchTransaction.byteSize(args),
      commitment
    );
  }
  /**
   * Returns a readable version of {@link VaultBatchTransaction} properties
   * and can be used to convert to JSON and/or logging
   */
  pretty() {
    return {
      bump: this.bump,
      ephemeralSignerBumps: this.ephemeralSignerBumps,
      message: this.message
    };
  }
};
var vaultBatchTransactionBeet = new beet15.FixableBeetStruct(
  [
    ["accountDiscriminator", beet15.uniformFixedSizeArray(beet15.u8, 8)],
    ["bump", beet15.u8],
    ["ephemeralSignerBumps", beet15.bytes],
    ["message", vaultTransactionMessageBeet]
  ],
  VaultBatchTransaction.fromArgs,
  "VaultBatchTransaction"
);

// src/generated/accounts/VaultTransaction.ts
var web38 = __toESM(require("@solana/web3.js"));
var beet16 = __toESM(require("@metaplex-foundation/beet"));
var beetSolana12 = __toESM(require("@metaplex-foundation/beet-solana"));
var vaultTransactionDiscriminator = [
  168,
  250,
  162,
  100,
  81,
  14,
  162,
  207
];
var VaultTransaction = class _VaultTransaction {
  constructor(multisig, creator, index, bump, vaultIndex, vaultBump, ephemeralSignerBumps, message) {
    this.multisig = multisig;
    this.creator = creator;
    this.index = index;
    this.bump = bump;
    this.vaultIndex = vaultIndex;
    this.vaultBump = vaultBump;
    this.ephemeralSignerBumps = ephemeralSignerBumps;
    this.message = message;
  }
  /**
   * Creates a {@link VaultTransaction} instance from the provided args.
   */
  static fromArgs(args) {
    return new _VaultTransaction(
      args.multisig,
      args.creator,
      args.index,
      args.bump,
      args.vaultIndex,
      args.vaultBump,
      args.ephemeralSignerBumps,
      args.message
    );
  }
  /**
   * Deserializes the {@link VaultTransaction} from the data of the provided {@link web3.AccountInfo}.
   * @returns a tuple of the account data and the offset up to which the buffer was read to obtain it.
   */
  static fromAccountInfo(accountInfo, offset = 0) {
    return _VaultTransaction.deserialize(accountInfo.data, offset);
  }
  /**
   * Retrieves the account info from the provided address and deserializes
   * the {@link VaultTransaction} from its data.
   *
   * @throws Error if no account info is found at the address or if deserialization fails
   */
  static async fromAccountAddress(connection, address, commitmentOrConfig) {
    const accountInfo = await connection.getAccountInfo(
      address,
      commitmentOrConfig
    );
    if (accountInfo == null) {
      throw new Error(`Unable to find VaultTransaction account at ${address}`);
    }
    return _VaultTransaction.fromAccountInfo(accountInfo, 0)[0];
  }
  /**
   * Provides a {@link web3.Connection.getProgramAccounts} config builder,
   * to fetch accounts matching filters that can be specified via that builder.
   *
   * @param programId - the program that owns the accounts we are filtering
   */
  static gpaBuilder(programId = new web38.PublicKey(
    "SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf"
  )) {
    return beetSolana12.GpaBuilder.fromStruct(programId, vaultTransactionBeet);
  }
  /**
   * Deserializes the {@link VaultTransaction} from the provided data Buffer.
   * @returns a tuple of the account data and the offset up to which the buffer was read to obtain it.
   */
  static deserialize(buf, offset = 0) {
    return vaultTransactionBeet.deserialize(buf, offset);
  }
  /**
   * Serializes the {@link VaultTransaction} into a Buffer.
   * @returns a tuple of the created Buffer and the offset up to which the buffer was written to store it.
   */
  serialize() {
    return vaultTransactionBeet.serialize({
      accountDiscriminator: vaultTransactionDiscriminator,
      ...this
    });
  }
  /**
   * Returns the byteSize of a {@link Buffer} holding the serialized data of
   * {@link VaultTransaction} for the provided args.
   *
   * @param args need to be provided since the byte size for this account
   * depends on them
   */
  static byteSize(args) {
    const instance = _VaultTransaction.fromArgs(args);
    return vaultTransactionBeet.toFixedFromValue({
      accountDiscriminator: vaultTransactionDiscriminator,
      ...instance
    }).byteSize;
  }
  /**
   * Fetches the minimum balance needed to exempt an account holding
   * {@link VaultTransaction} data from rent
   *
   * @param args need to be provided since the byte size for this account
   * depends on them
   * @param connection used to retrieve the rent exemption information
   */
  static async getMinimumBalanceForRentExemption(args, connection, commitment) {
    return connection.getMinimumBalanceForRentExemption(
      _VaultTransaction.byteSize(args),
      commitment
    );
  }
  /**
   * Returns a readable version of {@link VaultTransaction} properties
   * and can be used to convert to JSON and/or logging
   */
  pretty() {
    return {
      multisig: this.multisig.toBase58(),
      creator: this.creator.toBase58(),
      index: (() => {
        const x = this.index;
        if (typeof x.toNumber === "function") {
          try {
            return x.toNumber();
          } catch (_) {
            return x;
          }
        }
        return x;
      })(),
      bump: this.bump,
      vaultIndex: this.vaultIndex,
      vaultBump: this.vaultBump,
      ephemeralSignerBumps: this.ephemeralSignerBumps,
      message: this.message
    };
  }
};
var vaultTransactionBeet = new beet16.FixableBeetStruct(
  [
    ["accountDiscriminator", beet16.uniformFixedSizeArray(beet16.u8, 8)],
    ["multisig", beetSolana12.publicKey],
    ["creator", beetSolana12.publicKey],
    ["index", beet16.u64],
    ["bump", beet16.u8],
    ["vaultIndex", beet16.u8],
    ["vaultBump", beet16.u8],
    ["ephemeralSignerBumps", beet16.bytes],
    ["message", vaultTransactionMessageBeet]
  ],
  VaultTransaction.fromArgs,
  "VaultTransaction"
);

// src/generated/accounts/index.ts
var accountProviders = {
  Batch,
  VaultBatchTransaction,
  ConfigTransaction,
  Multisig,
  ProgramConfig,
  Proposal,
  SpendingLimit,
  VaultTransaction
};

// src/generated/errors/index.ts
var createErrorFromCodeLookup = /* @__PURE__ */ new Map();
var createErrorFromNameLookup = /* @__PURE__ */ new Map();
var DuplicateMemberError = class _DuplicateMemberError extends Error {
  code = 6e3;
  name = "DuplicateMember";
  constructor() {
    super("Found multiple members with the same pubkey");
    if (typeof Error.captureStackTrace === "function") {
      Error.captureStackTrace(this, _DuplicateMemberError);
    }
  }
};
createErrorFromCodeLookup.set(6e3, () => new DuplicateMemberError());
createErrorFromNameLookup.set(
  "DuplicateMember",
  () => new DuplicateMemberError()
);
var EmptyMembersError = class _EmptyMembersError extends Error {
  code = 6001;
  name = "EmptyMembers";
  constructor() {
    super("Members array is empty");
    if (typeof Error.captureStackTrace === "function") {
      Error.captureStackTrace(this, _EmptyMembersError);
    }
  }
};
createErrorFromCodeLookup.set(6001, () => new EmptyMembersError());
createErrorFromNameLookup.set("EmptyMembers", () => new EmptyMembersError());
var TooManyMembersError = class _TooManyMembersError extends Error {
  code = 6002;
  name = "TooManyMembers";
  constructor() {
    super("Too many members, can be up to 65535");
    if (typeof Error.captureStackTrace === "function") {
      Error.captureStackTrace(this, _TooManyMembersError);
    }
  }
};
createErrorFromCodeLookup.set(6002, () => new TooManyMembersError());
createErrorFromNameLookup.set("TooManyMembers", () => new TooManyMembersError());
var InvalidThresholdError = class _InvalidThresholdError extends Error {
  code = 6003;
  name = "InvalidThreshold";
  constructor() {
    super(
      "Invalid threshold, must be between 1 and number of members with Vote permission"
    );
    if (typeof Error.captureStackTrace === "function") {
      Error.captureStackTrace(this, _InvalidThresholdError);
    }
  }
};
createErrorFromCodeLookup.set(6003, () => new InvalidThresholdError());
createErrorFromNameLookup.set(
  "InvalidThreshold",
  () => new InvalidThresholdError()
);
var UnauthorizedError = class _UnauthorizedError extends Error {
  code = 6004;
  name = "Unauthorized";
  constructor() {
    super("Attempted to perform an unauthorized action");
    if (typeof Error.captureStackTrace === "function") {
      Error.captureStackTrace(this, _UnauthorizedError);
    }
  }
};
createErrorFromCodeLookup.set(6004, () => new UnauthorizedError());
createErrorFromNameLookup.set("Unauthorized", () => new UnauthorizedError());
var NotAMemberError = class _NotAMemberError extends Error {
  code = 6005;
  name = "NotAMember";
  constructor() {
    super("Provided pubkey is not a member of multisig");
    if (typeof Error.captureStackTrace === "function") {
      Error.captureStackTrace(this, _NotAMemberError);
    }
  }
};
createErrorFromCodeLookup.set(6005, () => new NotAMemberError());
createErrorFromNameLookup.set("NotAMember", () => new NotAMemberError());
var InvalidTransactionMessageError = class _InvalidTransactionMessageError extends Error {
  code = 6006;
  name = "InvalidTransactionMessage";
  constructor() {
    super("TransactionMessage is malformed.");
    if (typeof Error.captureStackTrace === "function") {
      Error.captureStackTrace(this, _InvalidTransactionMessageError);
    }
  }
};
createErrorFromCodeLookup.set(
  6006,
  () => new InvalidTransactionMessageError()
);
createErrorFromNameLookup.set(
  "InvalidTransactionMessage",
  () => new InvalidTransactionMessageError()
);
var StaleProposalError = class _StaleProposalError extends Error {
  code = 6007;
  name = "StaleProposal";
  constructor() {
    super("Proposal is stale");
    if (typeof Error.captureStackTrace === "function") {
      Error.captureStackTrace(this, _StaleProposalError);
    }
  }
};
createErrorFromCodeLookup.set(6007, () => new StaleProposalError());
createErrorFromNameLookup.set("StaleProposal", () => new StaleProposalError());
var InvalidProposalStatusError = class _InvalidProposalStatusError extends Error {
  code = 6008;
  name = "InvalidProposalStatus";
  constructor() {
    super("Invalid proposal status");
    if (typeof Error.captureStackTrace === "function") {
      Error.captureStackTrace(this, _InvalidProposalStatusError);
    }
  }
};
createErrorFromCodeLookup.set(6008, () => new InvalidProposalStatusError());
createErrorFromNameLookup.set(
  "InvalidProposalStatus",
  () => new InvalidProposalStatusError()
);
var InvalidTransactionIndexError = class _InvalidTransactionIndexError extends Error {
  code = 6009;
  name = "InvalidTransactionIndex";
  constructor() {
    super("Invalid transaction index");
    if (typeof Error.captureStackTrace === "function") {
      Error.captureStackTrace(this, _InvalidTransactionIndexError);
    }
  }
};
createErrorFromCodeLookup.set(6009, () => new InvalidTransactionIndexError());
createErrorFromNameLookup.set(
  "InvalidTransactionIndex",
  () => new InvalidTransactionIndexError()
);
var AlreadyApprovedError = class _AlreadyApprovedError extends Error {
  code = 6010;
  name = "AlreadyApproved";
  constructor() {
    super("Member already approved the transaction");
    if (typeof Error.captureStackTrace === "function") {
      Error.captureStackTrace(this, _AlreadyApprovedError);
    }
  }
};
createErrorFromCodeLookup.set(6010, () => new AlreadyApprovedError());
createErrorFromNameLookup.set(
  "AlreadyApproved",
  () => new AlreadyApprovedError()
);
var AlreadyRejectedError = class _AlreadyRejectedError extends Error {
  code = 6011;
  name = "AlreadyRejected";
  constructor() {
    super("Member already rejected the transaction");
    if (typeof Error.captureStackTrace === "function") {
      Error.captureStackTrace(this, _AlreadyRejectedError);
    }
  }
};
createErrorFromCodeLookup.set(6011, () => new AlreadyRejectedError());
createErrorFromNameLookup.set(
  "AlreadyRejected",
  () => new AlreadyRejectedError()
);
var AlreadyCancelledError = class _AlreadyCancelledError extends Error {
  code = 6012;
  name = "AlreadyCancelled";
  constructor() {
    super("Member already cancelled the transaction");
    if (typeof Error.captureStackTrace === "function") {
      Error.captureStackTrace(this, _AlreadyCancelledError);
    }
  }
};
createErrorFromCodeLookup.set(6012, () => new AlreadyCancelledError());
createErrorFromNameLookup.set(
  "AlreadyCancelled",
  () => new AlreadyCancelledError()
);
var InvalidNumberOfAccountsError = class _InvalidNumberOfAccountsError extends Error {
  code = 6013;
  name = "InvalidNumberOfAccounts";
  constructor() {
    super("Wrong number of accounts provided");
    if (typeof Error.captureStackTrace === "function") {
      Error.captureStackTrace(this, _InvalidNumberOfAccountsError);
    }
  }
};
createErrorFromCodeLookup.set(6013, () => new InvalidNumberOfAccountsError());
createErrorFromNameLookup.set(
  "InvalidNumberOfAccounts",
  () => new InvalidNumberOfAccountsError()
);
var InvalidAccountError = class _InvalidAccountError extends Error {
  code = 6014;
  name = "InvalidAccount";
  constructor() {
    super("Invalid account provided");
    if (typeof Error.captureStackTrace === "function") {
      Error.captureStackTrace(this, _InvalidAccountError);
    }
  }
};
createErrorFromCodeLookup.set(6014, () => new InvalidAccountError());
createErrorFromNameLookup.set("InvalidAccount", () => new InvalidAccountError());
var RemoveLastMemberError = class _RemoveLastMemberError extends Error {
  code = 6015;
  name = "RemoveLastMember";
  constructor() {
    super("Cannot remove last member");
    if (typeof Error.captureStackTrace === "function") {
      Error.captureStackTrace(this, _RemoveLastMemberError);
    }
  }
};
createErrorFromCodeLookup.set(6015, () => new RemoveLastMemberError());
createErrorFromNameLookup.set(
  "RemoveLastMember",
  () => new RemoveLastMemberError()
);
var NoVotersError = class _NoVotersError extends Error {
  code = 6016;
  name = "NoVoters";
  constructor() {
    super("Members don't include any voters");
    if (typeof Error.captureStackTrace === "function") {
      Error.captureStackTrace(this, _NoVotersError);
    }
  }
};
createErrorFromCodeLookup.set(6016, () => new NoVotersError());
createErrorFromNameLookup.set("NoVoters", () => new NoVotersError());
var NoProposersError = class _NoProposersError extends Error {
  code = 6017;
  name = "NoProposers";
  constructor() {
    super("Members don't include any proposers");
    if (typeof Error.captureStackTrace === "function") {
      Error.captureStackTrace(this, _NoProposersError);
    }
  }
};
createErrorFromCodeLookup.set(6017, () => new NoProposersError());
createErrorFromNameLookup.set("NoProposers", () => new NoProposersError());
var NoExecutorsError = class _NoExecutorsError extends Error {
  code = 6018;
  name = "NoExecutors";
  constructor() {
    super("Members don't include any executors");
    if (typeof Error.captureStackTrace === "function") {
      Error.captureStackTrace(this, _NoExecutorsError);
    }
  }
};
createErrorFromCodeLookup.set(6018, () => new NoExecutorsError());
createErrorFromNameLookup.set("NoExecutors", () => new NoExecutorsError());
var InvalidStaleTransactionIndexError = class _InvalidStaleTransactionIndexError extends Error {
  code = 6019;
  name = "InvalidStaleTransactionIndex";
  constructor() {
    super("`stale_transaction_index` must be <= `transaction_index`");
    if (typeof Error.captureStackTrace === "function") {
      Error.captureStackTrace(this, _InvalidStaleTransactionIndexError);
    }
  }
};
createErrorFromCodeLookup.set(
  6019,
  () => new InvalidStaleTransactionIndexError()
);
createErrorFromNameLookup.set(
  "InvalidStaleTransactionIndex",
  () => new InvalidStaleTransactionIndexError()
);
var NotSupportedForControlledError = class _NotSupportedForControlledError extends Error {
  code = 6020;
  name = "NotSupportedForControlled";
  constructor() {
    super("Instruction not supported for controlled multisig");
    if (typeof Error.captureStackTrace === "function") {
      Error.captureStackTrace(this, _NotSupportedForControlledError);
    }
  }
};
createErrorFromCodeLookup.set(
  6020,
  () => new NotSupportedForControlledError()
);
createErrorFromNameLookup.set(
  "NotSupportedForControlled",
  () => new NotSupportedForControlledError()
);
var TimeLockNotReleasedError = class _TimeLockNotReleasedError extends Error {
  code = 6021;
  name = "TimeLockNotReleased";
  constructor() {
    super("Proposal time lock has not been released");
    if (typeof Error.captureStackTrace === "function") {
      Error.captureStackTrace(this, _TimeLockNotReleasedError);
    }
  }
};
createErrorFromCodeLookup.set(6021, () => new TimeLockNotReleasedError());
createErrorFromNameLookup.set(
  "TimeLockNotReleased",
  () => new TimeLockNotReleasedError()
);
var NoActionsError = class _NoActionsError extends Error {
  code = 6022;
  name = "NoActions";
  constructor() {
    super("Config transaction must have at least one action");
    if (typeof Error.captureStackTrace === "function") {
      Error.captureStackTrace(this, _NoActionsError);
    }
  }
};
createErrorFromCodeLookup.set(6022, () => new NoActionsError());
createErrorFromNameLookup.set("NoActions", () => new NoActionsError());
var MissingAccountError = class _MissingAccountError extends Error {
  code = 6023;
  name = "MissingAccount";
  constructor() {
    super("Missing account");
    if (typeof Error.captureStackTrace === "function") {
      Error.captureStackTrace(this, _MissingAccountError);
    }
  }
};
createErrorFromCodeLookup.set(6023, () => new MissingAccountError());
createErrorFromNameLookup.set("MissingAccount", () => new MissingAccountError());
var InvalidMintError = class _InvalidMintError extends Error {
  code = 6024;
  name = "InvalidMint";
  constructor() {
    super("Invalid mint");
    if (typeof Error.captureStackTrace === "function") {
      Error.captureStackTrace(this, _InvalidMintError);
    }
  }
};
createErrorFromCodeLookup.set(6024, () => new InvalidMintError());
createErrorFromNameLookup.set("InvalidMint", () => new InvalidMintError());
var InvalidDestinationError = class _InvalidDestinationError extends Error {
  code = 6025;
  name = "InvalidDestination";
  constructor() {
    super("Invalid destination");
    if (typeof Error.captureStackTrace === "function") {
      Error.captureStackTrace(this, _InvalidDestinationError);
    }
  }
};
createErrorFromCodeLookup.set(6025, () => new InvalidDestinationError());
createErrorFromNameLookup.set(
  "InvalidDestination",
  () => new InvalidDestinationError()
);
var SpendingLimitExceededError = class _SpendingLimitExceededError extends Error {
  code = 6026;
  name = "SpendingLimitExceeded";
  constructor() {
    super("Spending limit exceeded");
    if (typeof Error.captureStackTrace === "function") {
      Error.captureStackTrace(this, _SpendingLimitExceededError);
    }
  }
};
createErrorFromCodeLookup.set(6026, () => new SpendingLimitExceededError());
createErrorFromNameLookup.set(
  "SpendingLimitExceeded",
  () => new SpendingLimitExceededError()
);
var DecimalsMismatchError = class _DecimalsMismatchError extends Error {
  code = 6027;
  name = "DecimalsMismatch";
  constructor() {
    super("Decimals don't match the mint");
    if (typeof Error.captureStackTrace === "function") {
      Error.captureStackTrace(this, _DecimalsMismatchError);
    }
  }
};
createErrorFromCodeLookup.set(6027, () => new DecimalsMismatchError());
createErrorFromNameLookup.set(
  "DecimalsMismatch",
  () => new DecimalsMismatchError()
);
var UnknownPermissionError = class _UnknownPermissionError extends Error {
  code = 6028;
  name = "UnknownPermission";
  constructor() {
    super("Member has unknown permission");
    if (typeof Error.captureStackTrace === "function") {
      Error.captureStackTrace(this, _UnknownPermissionError);
    }
  }
};
createErrorFromCodeLookup.set(6028, () => new UnknownPermissionError());
createErrorFromNameLookup.set(
  "UnknownPermission",
  () => new UnknownPermissionError()
);
var ProtectedAccountError = class _ProtectedAccountError extends Error {
  code = 6029;
  name = "ProtectedAccount";
  constructor() {
    super("Account is protected, it cannot be passed into a CPI as writable");
    if (typeof Error.captureStackTrace === "function") {
      Error.captureStackTrace(this, _ProtectedAccountError);
    }
  }
};
createErrorFromCodeLookup.set(6029, () => new ProtectedAccountError());
createErrorFromNameLookup.set(
  "ProtectedAccount",
  () => new ProtectedAccountError()
);
var TimeLockExceedsMaxAllowedError = class _TimeLockExceedsMaxAllowedError extends Error {
  code = 6030;
  name = "TimeLockExceedsMaxAllowed";
  constructor() {
    super("Time lock exceeds the maximum allowed (90 days)");
    if (typeof Error.captureStackTrace === "function") {
      Error.captureStackTrace(this, _TimeLockExceedsMaxAllowedError);
    }
  }
};
createErrorFromCodeLookup.set(
  6030,
  () => new TimeLockExceedsMaxAllowedError()
);
createErrorFromNameLookup.set(
  "TimeLockExceedsMaxAllowed",
  () => new TimeLockExceedsMaxAllowedError()
);
var IllegalAccountOwnerError = class _IllegalAccountOwnerError extends Error {
  code = 6031;
  name = "IllegalAccountOwner";
  constructor() {
    super("Account is not owned by Multisig program");
    if (typeof Error.captureStackTrace === "function") {
      Error.captureStackTrace(this, _IllegalAccountOwnerError);
    }
  }
};
createErrorFromCodeLookup.set(6031, () => new IllegalAccountOwnerError());
createErrorFromNameLookup.set(
  "IllegalAccountOwner",
  () => new IllegalAccountOwnerError()
);
var RentReclamationDisabledError = class _RentReclamationDisabledError extends Error {
  code = 6032;
  name = "RentReclamationDisabled";
  constructor() {
    super("Rent reclamation is disabled for this multisig");
    if (typeof Error.captureStackTrace === "function") {
      Error.captureStackTrace(this, _RentReclamationDisabledError);
    }
  }
};
createErrorFromCodeLookup.set(6032, () => new RentReclamationDisabledError());
createErrorFromNameLookup.set(
  "RentReclamationDisabled",
  () => new RentReclamationDisabledError()
);
var InvalidRentCollectorError = class _InvalidRentCollectorError extends Error {
  code = 6033;
  name = "InvalidRentCollector";
  constructor() {
    super("Invalid rent collector address");
    if (typeof Error.captureStackTrace === "function") {
      Error.captureStackTrace(this, _InvalidRentCollectorError);
    }
  }
};
createErrorFromCodeLookup.set(6033, () => new InvalidRentCollectorError());
createErrorFromNameLookup.set(
  "InvalidRentCollector",
  () => new InvalidRentCollectorError()
);
var ProposalForAnotherMultisigError = class _ProposalForAnotherMultisigError extends Error {
  code = 6034;
  name = "ProposalForAnotherMultisig";
  constructor() {
    super("Proposal is for another multisig");
    if (typeof Error.captureStackTrace === "function") {
      Error.captureStackTrace(this, _ProposalForAnotherMultisigError);
    }
  }
};
createErrorFromCodeLookup.set(
  6034,
  () => new ProposalForAnotherMultisigError()
);
createErrorFromNameLookup.set(
  "ProposalForAnotherMultisig",
  () => new ProposalForAnotherMultisigError()
);
var TransactionForAnotherMultisigError = class _TransactionForAnotherMultisigError extends Error {
  code = 6035;
  name = "TransactionForAnotherMultisig";
  constructor() {
    super("Transaction is for another multisig");
    if (typeof Error.captureStackTrace === "function") {
      Error.captureStackTrace(this, _TransactionForAnotherMultisigError);
    }
  }
};
createErrorFromCodeLookup.set(
  6035,
  () => new TransactionForAnotherMultisigError()
);
createErrorFromNameLookup.set(
  "TransactionForAnotherMultisig",
  () => new TransactionForAnotherMultisigError()
);
var TransactionNotMatchingProposalError = class _TransactionNotMatchingProposalError extends Error {
  code = 6036;
  name = "TransactionNotMatchingProposal";
  constructor() {
    super("Transaction doesn't match proposal");
    if (typeof Error.captureStackTrace === "function") {
      Error.captureStackTrace(this, _TransactionNotMatchingProposalError);
    }
  }
};
createErrorFromCodeLookup.set(
  6036,
  () => new TransactionNotMatchingProposalError()
);
createErrorFromNameLookup.set(
  "TransactionNotMatchingProposal",
  () => new TransactionNotMatchingProposalError()
);
var TransactionNotLastInBatchError = class _TransactionNotLastInBatchError extends Error {
  code = 6037;
  name = "TransactionNotLastInBatch";
  constructor() {
    super("Transaction is not last in batch");
    if (typeof Error.captureStackTrace === "function") {
      Error.captureStackTrace(this, _TransactionNotLastInBatchError);
    }
  }
};
createErrorFromCodeLookup.set(
  6037,
  () => new TransactionNotLastInBatchError()
);
createErrorFromNameLookup.set(
  "TransactionNotLastInBatch",
  () => new TransactionNotLastInBatchError()
);
var BatchNotEmptyError = class _BatchNotEmptyError extends Error {
  code = 6038;
  name = "BatchNotEmpty";
  constructor() {
    super("Batch is not empty");
    if (typeof Error.captureStackTrace === "function") {
      Error.captureStackTrace(this, _BatchNotEmptyError);
    }
  }
};
createErrorFromCodeLookup.set(6038, () => new BatchNotEmptyError());
createErrorFromNameLookup.set("BatchNotEmpty", () => new BatchNotEmptyError());
var SpendingLimitInvalidAmountError = class _SpendingLimitInvalidAmountError extends Error {
  code = 6039;
  name = "SpendingLimitInvalidAmount";
  constructor() {
    super("Invalid SpendingLimit amount");
    if (typeof Error.captureStackTrace === "function") {
      Error.captureStackTrace(this, _SpendingLimitInvalidAmountError);
    }
  }
};
createErrorFromCodeLookup.set(
  6039,
  () => new SpendingLimitInvalidAmountError()
);
createErrorFromNameLookup.set(
  "SpendingLimitInvalidAmount",
  () => new SpendingLimitInvalidAmountError()
);
function errorFromCode(code) {
  const createError = createErrorFromCodeLookup.get(code);
  return createError != null ? createError() : null;
}
function errorFromName(name) {
  const createError = createErrorFromNameLookup.get(name);
  return createError != null ? createError() : null;
}

// src/generated/instructions/batchAccountsClose.ts
var beet17 = __toESM(require("@metaplex-foundation/beet"));
var web39 = __toESM(require("@solana/web3.js"));
var batchAccountsCloseStruct = new beet17.BeetArgsStruct(
  [["instructionDiscriminator", beet17.uniformFixedSizeArray(beet17.u8, 8)]],
  "BatchAccountsCloseInstructionArgs"
);
var batchAccountsCloseInstructionDiscriminator = [
  218,
  196,
  7,
  175,
  130,
  102,
  11,
  255
];
function createBatchAccountsCloseInstruction(accounts, programId = new web39.PublicKey("SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf")) {
  const [data] = batchAccountsCloseStruct.serialize({
    instructionDiscriminator: batchAccountsCloseInstructionDiscriminator
  });
  const keys = [
    {
      pubkey: accounts.multisig,
      isWritable: false,
      isSigner: false
    },
    {
      pubkey: accounts.proposal,
      isWritable: true,
      isSigner: false
    },
    {
      pubkey: accounts.batch,
      isWritable: true,
      isSigner: false
    },
    {
      pubkey: accounts.rentCollector,
      isWritable: true,
      isSigner: false
    },
    {
      pubkey: accounts.systemProgram ?? web39.SystemProgram.programId,
      isWritable: false,
      isSigner: false
    }
  ];
  if (accounts.anchorRemainingAccounts != null) {
    for (const acc of accounts.anchorRemainingAccounts) {
      keys.push(acc);
    }
  }
  const ix = new web39.TransactionInstruction({
    programId,
    keys,
    data
  });
  return ix;
}

// src/generated/instructions/batchAddTransaction.ts
var beet19 = __toESM(require("@metaplex-foundation/beet"));
var web310 = __toESM(require("@solana/web3.js"));

// src/generated/types/BatchAddTransactionArgs.ts
var beet18 = __toESM(require("@metaplex-foundation/beet"));
var batchAddTransactionArgsBeet = new beet18.FixableBeetArgsStruct(
  [
    ["ephemeralSigners", beet18.u8],
    ["transactionMessage", beet18.bytes]
  ],
  "BatchAddTransactionArgs"
);

// src/generated/instructions/batchAddTransaction.ts
var batchAddTransactionStruct = new beet19.FixableBeetArgsStruct(
  [
    ["instructionDiscriminator", beet19.uniformFixedSizeArray(beet19.u8, 8)],
    ["args", batchAddTransactionArgsBeet]
  ],
  "BatchAddTransactionInstructionArgs"
);
var batchAddTransactionInstructionDiscriminator = [
  89,
  100,
  224,
  18,
  69,
  70,
  54,
  76
];
function createBatchAddTransactionInstruction(accounts, args, programId = new web310.PublicKey("SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf")) {
  const [data] = batchAddTransactionStruct.serialize({
    instructionDiscriminator: batchAddTransactionInstructionDiscriminator,
    ...args
  });
  const keys = [
    {
      pubkey: accounts.multisig,
      isWritable: false,
      isSigner: false
    },
    {
      pubkey: accounts.proposal,
      isWritable: false,
      isSigner: false
    },
    {
      pubkey: accounts.batch,
      isWritable: true,
      isSigner: false
    },
    {
      pubkey: accounts.transaction,
      isWritable: true,
      isSigner: false
    },
    {
      pubkey: accounts.member,
      isWritable: false,
      isSigner: true
    },
    {
      pubkey: accounts.rentPayer,
      isWritable: true,
      isSigner: true
    },
    {
      pubkey: accounts.systemProgram ?? web310.SystemProgram.programId,
      isWritable: false,
      isSigner: false
    }
  ];
  if (accounts.anchorRemainingAccounts != null) {
    for (const acc of accounts.anchorRemainingAccounts) {
      keys.push(acc);
    }
  }
  const ix = new web310.TransactionInstruction({
    programId,
    keys,
    data
  });
  return ix;
}

// src/generated/instructions/batchCreate.ts
var beet21 = __toESM(require("@metaplex-foundation/beet"));
var web311 = __toESM(require("@solana/web3.js"));

// src/generated/types/BatchCreateArgs.ts
var beet20 = __toESM(require("@metaplex-foundation/beet"));
var batchCreateArgsBeet = new beet20.FixableBeetArgsStruct(
  [
    ["vaultIndex", beet20.u8],
    ["memo", beet20.coption(beet20.utf8String)]
  ],
  "BatchCreateArgs"
);

// src/generated/instructions/batchCreate.ts
var batchCreateStruct = new beet21.FixableBeetArgsStruct(
  [
    ["instructionDiscriminator", beet21.uniformFixedSizeArray(beet21.u8, 8)],
    ["args", batchCreateArgsBeet]
  ],
  "BatchCreateInstructionArgs"
);
var batchCreateInstructionDiscriminator = [
  194,
  142,
  141,
  17,
  55,
  185,
  20,
  248
];
function createBatchCreateInstruction(accounts, args, programId = new web311.PublicKey("SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf")) {
  const [data] = batchCreateStruct.serialize({
    instructionDiscriminator: batchCreateInstructionDiscriminator,
    ...args
  });
  const keys = [
    {
      pubkey: accounts.multisig,
      isWritable: true,
      isSigner: false
    },
    {
      pubkey: accounts.batch,
      isWritable: true,
      isSigner: false
    },
    {
      pubkey: accounts.creator,
      isWritable: false,
      isSigner: true
    },
    {
      pubkey: accounts.rentPayer,
      isWritable: true,
      isSigner: true
    },
    {
      pubkey: accounts.systemProgram ?? web311.SystemProgram.programId,
      isWritable: false,
      isSigner: false
    }
  ];
  if (accounts.anchorRemainingAccounts != null) {
    for (const acc of accounts.anchorRemainingAccounts) {
      keys.push(acc);
    }
  }
  const ix = new web311.TransactionInstruction({
    programId,
    keys,
    data
  });
  return ix;
}

// src/generated/instructions/batchExecuteTransaction.ts
var beet22 = __toESM(require("@metaplex-foundation/beet"));
var web312 = __toESM(require("@solana/web3.js"));
var batchExecuteTransactionStruct = new beet22.BeetArgsStruct(
  [["instructionDiscriminator", beet22.uniformFixedSizeArray(beet22.u8, 8)]],
  "BatchExecuteTransactionInstructionArgs"
);
var batchExecuteTransactionInstructionDiscriminator = [
  172,
  44,
  179,
  152,
  21,
  127,
  234,
  180
];
function createBatchExecuteTransactionInstruction(accounts, programId = new web312.PublicKey("SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf")) {
  const [data] = batchExecuteTransactionStruct.serialize({
    instructionDiscriminator: batchExecuteTransactionInstructionDiscriminator
  });
  const keys = [
    {
      pubkey: accounts.multisig,
      isWritable: false,
      isSigner: false
    },
    {
      pubkey: accounts.member,
      isWritable: false,
      isSigner: true
    },
    {
      pubkey: accounts.proposal,
      isWritable: true,
      isSigner: false
    },
    {
      pubkey: accounts.batch,
      isWritable: true,
      isSigner: false
    },
    {
      pubkey: accounts.transaction,
      isWritable: false,
      isSigner: false
    }
  ];
  if (accounts.anchorRemainingAccounts != null) {
    for (const acc of accounts.anchorRemainingAccounts) {
      keys.push(acc);
    }
  }
  const ix = new web312.TransactionInstruction({
    programId,
    keys,
    data
  });
  return ix;
}

// src/generated/instructions/configTransactionAccountsClose.ts
var beet23 = __toESM(require("@metaplex-foundation/beet"));
var web313 = __toESM(require("@solana/web3.js"));
var configTransactionAccountsCloseStruct = new beet23.BeetArgsStruct(
  [["instructionDiscriminator", beet23.uniformFixedSizeArray(beet23.u8, 8)]],
  "ConfigTransactionAccountsCloseInstructionArgs"
);
var configTransactionAccountsCloseInstructionDiscriminator = [
  80,
  203,
  84,
  53,
  151,
  112,
  187,
  186
];
function createConfigTransactionAccountsCloseInstruction(accounts, programId = new web313.PublicKey("SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf")) {
  const [data] = configTransactionAccountsCloseStruct.serialize({
    instructionDiscriminator: configTransactionAccountsCloseInstructionDiscriminator
  });
  const keys = [
    {
      pubkey: accounts.multisig,
      isWritable: false,
      isSigner: false
    },
    {
      pubkey: accounts.proposal,
      isWritable: true,
      isSigner: false
    },
    {
      pubkey: accounts.transaction,
      isWritable: true,
      isSigner: false
    },
    {
      pubkey: accounts.rentCollector,
      isWritable: true,
      isSigner: false
    },
    {
      pubkey: accounts.systemProgram ?? web313.SystemProgram.programId,
      isWritable: false,
      isSigner: false
    }
  ];
  if (accounts.anchorRemainingAccounts != null) {
    for (const acc of accounts.anchorRemainingAccounts) {
      keys.push(acc);
    }
  }
  const ix = new web313.TransactionInstruction({
    programId,
    keys,
    data
  });
  return ix;
}

// src/generated/instructions/configTransactionCreate.ts
var beet25 = __toESM(require("@metaplex-foundation/beet"));
var web314 = __toESM(require("@solana/web3.js"));

// src/generated/types/ConfigTransactionCreateArgs.ts
var beet24 = __toESM(require("@metaplex-foundation/beet"));
var configTransactionCreateArgsBeet = new beet24.FixableBeetArgsStruct(
  [
    ["actions", beet24.array(configActionBeet)],
    ["memo", beet24.coption(beet24.utf8String)]
  ],
  "ConfigTransactionCreateArgs"
);

// src/generated/instructions/configTransactionCreate.ts
var configTransactionCreateStruct = new beet25.FixableBeetArgsStruct(
  [
    ["instructionDiscriminator", beet25.uniformFixedSizeArray(beet25.u8, 8)],
    ["args", configTransactionCreateArgsBeet]
  ],
  "ConfigTransactionCreateInstructionArgs"
);
var configTransactionCreateInstructionDiscriminator = [
  155,
  236,
  87,
  228,
  137,
  75,
  81,
  39
];
function createConfigTransactionCreateInstruction(accounts, args, programId = new web314.PublicKey("SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf")) {
  const [data] = configTransactionCreateStruct.serialize({
    instructionDiscriminator: configTransactionCreateInstructionDiscriminator,
    ...args
  });
  const keys = [
    {
      pubkey: accounts.multisig,
      isWritable: true,
      isSigner: false
    },
    {
      pubkey: accounts.transaction,
      isWritable: true,
      isSigner: false
    },
    {
      pubkey: accounts.creator,
      isWritable: false,
      isSigner: true
    },
    {
      pubkey: accounts.rentPayer,
      isWritable: true,
      isSigner: true
    },
    {
      pubkey: accounts.systemProgram ?? web314.SystemProgram.programId,
      isWritable: false,
      isSigner: false
    }
  ];
  if (accounts.anchorRemainingAccounts != null) {
    for (const acc of accounts.anchorRemainingAccounts) {
      keys.push(acc);
    }
  }
  const ix = new web314.TransactionInstruction({
    programId,
    keys,
    data
  });
  return ix;
}

// src/generated/instructions/configTransactionExecute.ts
var beet26 = __toESM(require("@metaplex-foundation/beet"));
var web315 = __toESM(require("@solana/web3.js"));
var configTransactionExecuteStruct = new beet26.BeetArgsStruct(
  [["instructionDiscriminator", beet26.uniformFixedSizeArray(beet26.u8, 8)]],
  "ConfigTransactionExecuteInstructionArgs"
);
var configTransactionExecuteInstructionDiscriminator = [
  114,
  146,
  244,
  189,
  252,
  140,
  36,
  40
];
function createConfigTransactionExecuteInstruction(accounts, programId = new web315.PublicKey("SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf")) {
  const [data] = configTransactionExecuteStruct.serialize({
    instructionDiscriminator: configTransactionExecuteInstructionDiscriminator
  });
  const keys = [
    {
      pubkey: accounts.multisig,
      isWritable: true,
      isSigner: false
    },
    {
      pubkey: accounts.member,
      isWritable: false,
      isSigner: true
    },
    {
      pubkey: accounts.proposal,
      isWritable: true,
      isSigner: false
    },
    {
      pubkey: accounts.transaction,
      isWritable: false,
      isSigner: false
    },
    {
      pubkey: accounts.rentPayer ?? programId,
      isWritable: accounts.rentPayer != null,
      isSigner: accounts.rentPayer != null
    },
    {
      pubkey: accounts.systemProgram ?? programId,
      isWritable: false,
      isSigner: false
    }
  ];
  if (accounts.anchorRemainingAccounts != null) {
    for (const acc of accounts.anchorRemainingAccounts) {
      keys.push(acc);
    }
  }
  const ix = new web315.TransactionInstruction({
    programId,
    keys,
    data
  });
  return ix;
}

// src/generated/instructions/multisigAddMember.ts
var beet28 = __toESM(require("@metaplex-foundation/beet"));
var web316 = __toESM(require("@solana/web3.js"));

// src/generated/types/MultisigAddMemberArgs.ts
var beet27 = __toESM(require("@metaplex-foundation/beet"));
var multisigAddMemberArgsBeet = new beet27.FixableBeetArgsStruct(
  [
    ["newMember", memberBeet],
    ["memo", beet27.coption(beet27.utf8String)]
  ],
  "MultisigAddMemberArgs"
);

// src/generated/instructions/multisigAddMember.ts
var multisigAddMemberStruct = new beet28.FixableBeetArgsStruct(
  [
    ["instructionDiscriminator", beet28.uniformFixedSizeArray(beet28.u8, 8)],
    ["args", multisigAddMemberArgsBeet]
  ],
  "MultisigAddMemberInstructionArgs"
);
var multisigAddMemberInstructionDiscriminator = [
  1,
  219,
  215,
  108,
  184,
  229,
  214,
  8
];
function createMultisigAddMemberInstruction(accounts, args, programId = new web316.PublicKey("SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf")) {
  const [data] = multisigAddMemberStruct.serialize({
    instructionDiscriminator: multisigAddMemberInstructionDiscriminator,
    ...args
  });
  const keys = [
    {
      pubkey: accounts.multisig,
      isWritable: true,
      isSigner: false
    },
    {
      pubkey: accounts.configAuthority,
      isWritable: false,
      isSigner: true
    },
    {
      pubkey: accounts.rentPayer ?? programId,
      isWritable: accounts.rentPayer != null,
      isSigner: accounts.rentPayer != null
    },
    {
      pubkey: accounts.systemProgram ?? programId,
      isWritable: false,
      isSigner: false
    }
  ];
  if (accounts.anchorRemainingAccounts != null) {
    for (const acc of accounts.anchorRemainingAccounts) {
      keys.push(acc);
    }
  }
  const ix = new web316.TransactionInstruction({
    programId,
    keys,
    data
  });
  return ix;
}

// src/generated/instructions/multisigAddSpendingLimit.ts
var beet30 = __toESM(require("@metaplex-foundation/beet"));
var web317 = __toESM(require("@solana/web3.js"));

// src/generated/types/MultisigAddSpendingLimitArgs.ts
var beet29 = __toESM(require("@metaplex-foundation/beet"));
var beetSolana13 = __toESM(require("@metaplex-foundation/beet-solana"));
var multisigAddSpendingLimitArgsBeet = new beet29.FixableBeetArgsStruct(
  [
    ["createKey", beetSolana13.publicKey],
    ["vaultIndex", beet29.u8],
    ["mint", beetSolana13.publicKey],
    ["amount", beet29.u64],
    ["period", periodBeet],
    ["members", beet29.array(beetSolana13.publicKey)],
    ["destinations", beet29.array(beetSolana13.publicKey)],
    ["memo", beet29.coption(beet29.utf8String)]
  ],
  "MultisigAddSpendingLimitArgs"
);

// src/generated/instructions/multisigAddSpendingLimit.ts
var multisigAddSpendingLimitStruct = new beet30.FixableBeetArgsStruct(
  [
    ["instructionDiscriminator", beet30.uniformFixedSizeArray(beet30.u8, 8)],
    ["args", multisigAddSpendingLimitArgsBeet]
  ],
  "MultisigAddSpendingLimitInstructionArgs"
);
var multisigAddSpendingLimitInstructionDiscriminator = [
  11,
  242,
  159,
  42,
  86,
  197,
  89,
  115
];
function createMultisigAddSpendingLimitInstruction(accounts, args, programId = new web317.PublicKey("SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf")) {
  const [data] = multisigAddSpendingLimitStruct.serialize({
    instructionDiscriminator: multisigAddSpendingLimitInstructionDiscriminator,
    ...args
  });
  const keys = [
    {
      pubkey: accounts.multisig,
      isWritable: false,
      isSigner: false
    },
    {
      pubkey: accounts.configAuthority,
      isWritable: false,
      isSigner: true
    },
    {
      pubkey: accounts.spendingLimit,
      isWritable: true,
      isSigner: false
    },
    {
      pubkey: accounts.rentPayer,
      isWritable: true,
      isSigner: true
    },
    {
      pubkey: accounts.systemProgram ?? web317.SystemProgram.programId,
      isWritable: false,
      isSigner: false
    }
  ];
  if (accounts.anchorRemainingAccounts != null) {
    for (const acc of accounts.anchorRemainingAccounts) {
      keys.push(acc);
    }
  }
  const ix = new web317.TransactionInstruction({
    programId,
    keys,
    data
  });
  return ix;
}

// src/generated/instructions/multisigChangeThreshold.ts
var beet32 = __toESM(require("@metaplex-foundation/beet"));
var web318 = __toESM(require("@solana/web3.js"));

// src/generated/types/MultisigChangeThresholdArgs.ts
var beet31 = __toESM(require("@metaplex-foundation/beet"));
var multisigChangeThresholdArgsBeet = new beet31.FixableBeetArgsStruct(
  [
    ["newThreshold", beet31.u16],
    ["memo", beet31.coption(beet31.utf8String)]
  ],
  "MultisigChangeThresholdArgs"
);

// src/generated/instructions/multisigChangeThreshold.ts
var multisigChangeThresholdStruct = new beet32.FixableBeetArgsStruct(
  [
    ["instructionDiscriminator", beet32.uniformFixedSizeArray(beet32.u8, 8)],
    ["args", multisigChangeThresholdArgsBeet]
  ],
  "MultisigChangeThresholdInstructionArgs"
);
var multisigChangeThresholdInstructionDiscriminator = [
  141,
  42,
  15,
  126,
  169,
  92,
  62,
  181
];
function createMultisigChangeThresholdInstruction(accounts, args, programId = new web318.PublicKey("SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf")) {
  const [data] = multisigChangeThresholdStruct.serialize({
    instructionDiscriminator: multisigChangeThresholdInstructionDiscriminator,
    ...args
  });
  const keys = [
    {
      pubkey: accounts.multisig,
      isWritable: true,
      isSigner: false
    },
    {
      pubkey: accounts.configAuthority,
      isWritable: false,
      isSigner: true
    },
    {
      pubkey: accounts.rentPayer ?? programId,
      isWritable: accounts.rentPayer != null,
      isSigner: accounts.rentPayer != null
    },
    {
      pubkey: accounts.systemProgram ?? programId,
      isWritable: false,
      isSigner: false
    }
  ];
  if (accounts.anchorRemainingAccounts != null) {
    for (const acc of accounts.anchorRemainingAccounts) {
      keys.push(acc);
    }
  }
  const ix = new web318.TransactionInstruction({
    programId,
    keys,
    data
  });
  return ix;
}

// src/generated/instructions/multisigCreate.ts
var beet34 = __toESM(require("@metaplex-foundation/beet"));
var web319 = __toESM(require("@solana/web3.js"));

// src/generated/types/MultisigCreateArgs.ts
var beet33 = __toESM(require("@metaplex-foundation/beet"));
var beetSolana14 = __toESM(require("@metaplex-foundation/beet-solana"));
var multisigCreateArgsBeet = new beet33.FixableBeetArgsStruct(
  [
    ["configAuthority", beet33.coption(beetSolana14.publicKey)],
    ["threshold", beet33.u16],
    ["members", beet33.array(memberBeet)],
    ["timeLock", beet33.u32],
    ["memo", beet33.coption(beet33.utf8String)]
  ],
  "MultisigCreateArgs"
);

// src/generated/instructions/multisigCreate.ts
var multisigCreateStruct = new beet34.FixableBeetArgsStruct(
  [
    ["instructionDiscriminator", beet34.uniformFixedSizeArray(beet34.u8, 8)],
    ["args", multisigCreateArgsBeet]
  ],
  "MultisigCreateInstructionArgs"
);
var multisigCreateInstructionDiscriminator = [
  122,
  77,
  80,
  159,
  84,
  88,
  90,
  197
];
function createMultisigCreateInstruction(accounts, args, programId = new web319.PublicKey("SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf")) {
  const [data] = multisigCreateStruct.serialize({
    instructionDiscriminator: multisigCreateInstructionDiscriminator,
    ...args
  });
  const keys = [
    {
      pubkey: accounts.multisig,
      isWritable: true,
      isSigner: false
    },
    {
      pubkey: accounts.createKey,
      isWritable: false,
      isSigner: true
    },
    {
      pubkey: accounts.creator,
      isWritable: true,
      isSigner: true
    },
    {
      pubkey: accounts.systemProgram ?? web319.SystemProgram.programId,
      isWritable: false,
      isSigner: false
    }
  ];
  if (accounts.anchorRemainingAccounts != null) {
    for (const acc of accounts.anchorRemainingAccounts) {
      keys.push(acc);
    }
  }
  const ix = new web319.TransactionInstruction({
    programId,
    keys,
    data
  });
  return ix;
}

// src/generated/instructions/multisigCreateV2.ts
var beet36 = __toESM(require("@metaplex-foundation/beet"));
var web320 = __toESM(require("@solana/web3.js"));

// src/generated/types/MultisigCreateArgsV2.ts
var beet35 = __toESM(require("@metaplex-foundation/beet"));
var beetSolana15 = __toESM(require("@metaplex-foundation/beet-solana"));
var multisigCreateArgsV2Beet = new beet35.FixableBeetArgsStruct(
  [
    ["configAuthority", beet35.coption(beetSolana15.publicKey)],
    ["threshold", beet35.u16],
    ["members", beet35.array(memberBeet)],
    ["timeLock", beet35.u32],
    ["rentCollector", beet35.coption(beetSolana15.publicKey)],
    ["memo", beet35.coption(beet35.utf8String)]
  ],
  "MultisigCreateArgsV2"
);

// src/generated/instructions/multisigCreateV2.ts
var multisigCreateV2Struct = new beet36.FixableBeetArgsStruct(
  [
    ["instructionDiscriminator", beet36.uniformFixedSizeArray(beet36.u8, 8)],
    ["args", multisigCreateArgsV2Beet]
  ],
  "MultisigCreateV2InstructionArgs"
);
var multisigCreateV2InstructionDiscriminator = [
  50,
  221,
  199,
  93,
  40,
  245,
  139,
  233
];
function createMultisigCreateV2Instruction(accounts, args, programId = new web320.PublicKey("SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf")) {
  const [data] = multisigCreateV2Struct.serialize({
    instructionDiscriminator: multisigCreateV2InstructionDiscriminator,
    ...args
  });
  const keys = [
    {
      pubkey: accounts.programConfig,
      isWritable: false,
      isSigner: false
    },
    {
      pubkey: accounts.treasury,
      isWritable: true,
      isSigner: false
    },
    {
      pubkey: accounts.multisig,
      isWritable: true,
      isSigner: false
    },
    {
      pubkey: accounts.createKey,
      isWritable: false,
      isSigner: true
    },
    {
      pubkey: accounts.creator,
      isWritable: true,
      isSigner: true
    },
    {
      pubkey: accounts.systemProgram ?? web320.SystemProgram.programId,
      isWritable: false,
      isSigner: false
    }
  ];
  if (accounts.anchorRemainingAccounts != null) {
    for (const acc of accounts.anchorRemainingAccounts) {
      keys.push(acc);
    }
  }
  const ix = new web320.TransactionInstruction({
    programId,
    keys,
    data
  });
  return ix;
}

// src/generated/instructions/multisigRemoveMember.ts
var beet38 = __toESM(require("@metaplex-foundation/beet"));
var web321 = __toESM(require("@solana/web3.js"));

// src/generated/types/MultisigRemoveMemberArgs.ts
var beet37 = __toESM(require("@metaplex-foundation/beet"));
var beetSolana16 = __toESM(require("@metaplex-foundation/beet-solana"));
var multisigRemoveMemberArgsBeet = new beet37.FixableBeetArgsStruct(
  [
    ["oldMember", beetSolana16.publicKey],
    ["memo", beet37.coption(beet37.utf8String)]
  ],
  "MultisigRemoveMemberArgs"
);

// src/generated/instructions/multisigRemoveMember.ts
var multisigRemoveMemberStruct = new beet38.FixableBeetArgsStruct(
  [
    ["instructionDiscriminator", beet38.uniformFixedSizeArray(beet38.u8, 8)],
    ["args", multisigRemoveMemberArgsBeet]
  ],
  "MultisigRemoveMemberInstructionArgs"
);
var multisigRemoveMemberInstructionDiscriminator = [
  217,
  117,
  177,
  210,
  182,
  145,
  218,
  72
];
function createMultisigRemoveMemberInstruction(accounts, args, programId = new web321.PublicKey("SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf")) {
  const [data] = multisigRemoveMemberStruct.serialize({
    instructionDiscriminator: multisigRemoveMemberInstructionDiscriminator,
    ...args
  });
  const keys = [
    {
      pubkey: accounts.multisig,
      isWritable: true,
      isSigner: false
    },
    {
      pubkey: accounts.configAuthority,
      isWritable: false,
      isSigner: true
    },
    {
      pubkey: accounts.rentPayer ?? programId,
      isWritable: accounts.rentPayer != null,
      isSigner: accounts.rentPayer != null
    },
    {
      pubkey: accounts.systemProgram ?? programId,
      isWritable: false,
      isSigner: false
    }
  ];
  if (accounts.anchorRemainingAccounts != null) {
    for (const acc of accounts.anchorRemainingAccounts) {
      keys.push(acc);
    }
  }
  const ix = new web321.TransactionInstruction({
    programId,
    keys,
    data
  });
  return ix;
}

// src/generated/instructions/multisigRemoveSpendingLimit.ts
var beet40 = __toESM(require("@metaplex-foundation/beet"));
var web322 = __toESM(require("@solana/web3.js"));

// src/generated/types/MultisigRemoveSpendingLimitArgs.ts
var beet39 = __toESM(require("@metaplex-foundation/beet"));
var multisigRemoveSpendingLimitArgsBeet = new beet39.FixableBeetArgsStruct(
  [["memo", beet39.coption(beet39.utf8String)]],
  "MultisigRemoveSpendingLimitArgs"
);

// src/generated/instructions/multisigRemoveSpendingLimit.ts
var multisigRemoveSpendingLimitStruct = new beet40.FixableBeetArgsStruct(
  [
    ["instructionDiscriminator", beet40.uniformFixedSizeArray(beet40.u8, 8)],
    ["args", multisigRemoveSpendingLimitArgsBeet]
  ],
  "MultisigRemoveSpendingLimitInstructionArgs"
);
var multisigRemoveSpendingLimitInstructionDiscriminator = [
  228,
  198,
  136,
  111,
  123,
  4,
  178,
  113
];
function createMultisigRemoveSpendingLimitInstruction(accounts, args, programId = new web322.PublicKey("SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf")) {
  const [data] = multisigRemoveSpendingLimitStruct.serialize({
    instructionDiscriminator: multisigRemoveSpendingLimitInstructionDiscriminator,
    ...args
  });
  const keys = [
    {
      pubkey: accounts.multisig,
      isWritable: false,
      isSigner: false
    },
    {
      pubkey: accounts.configAuthority,
      isWritable: false,
      isSigner: true
    },
    {
      pubkey: accounts.spendingLimit,
      isWritable: true,
      isSigner: false
    },
    {
      pubkey: accounts.rentCollector,
      isWritable: true,
      isSigner: false
    }
  ];
  if (accounts.anchorRemainingAccounts != null) {
    for (const acc of accounts.anchorRemainingAccounts) {
      keys.push(acc);
    }
  }
  const ix = new web322.TransactionInstruction({
    programId,
    keys,
    data
  });
  return ix;
}

// src/generated/instructions/multisigSetConfigAuthority.ts
var beet42 = __toESM(require("@metaplex-foundation/beet"));
var web323 = __toESM(require("@solana/web3.js"));

// src/generated/types/MultisigSetConfigAuthorityArgs.ts
var beet41 = __toESM(require("@metaplex-foundation/beet"));
var beetSolana17 = __toESM(require("@metaplex-foundation/beet-solana"));
var multisigSetConfigAuthorityArgsBeet = new beet41.FixableBeetArgsStruct(
  [
    ["configAuthority", beetSolana17.publicKey],
    ["memo", beet41.coption(beet41.utf8String)]
  ],
  "MultisigSetConfigAuthorityArgs"
);

// src/generated/instructions/multisigSetConfigAuthority.ts
var multisigSetConfigAuthorityStruct = new beet42.FixableBeetArgsStruct(
  [
    ["instructionDiscriminator", beet42.uniformFixedSizeArray(beet42.u8, 8)],
    ["args", multisigSetConfigAuthorityArgsBeet]
  ],
  "MultisigSetConfigAuthorityInstructionArgs"
);
var multisigSetConfigAuthorityInstructionDiscriminator = [
  143,
  93,
  199,
  143,
  92,
  169,
  193,
  232
];
function createMultisigSetConfigAuthorityInstruction(accounts, args, programId = new web323.PublicKey("SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf")) {
  const [data] = multisigSetConfigAuthorityStruct.serialize({
    instructionDiscriminator: multisigSetConfigAuthorityInstructionDiscriminator,
    ...args
  });
  const keys = [
    {
      pubkey: accounts.multisig,
      isWritable: true,
      isSigner: false
    },
    {
      pubkey: accounts.configAuthority,
      isWritable: false,
      isSigner: true
    },
    {
      pubkey: accounts.rentPayer ?? programId,
      isWritable: accounts.rentPayer != null,
      isSigner: accounts.rentPayer != null
    },
    {
      pubkey: accounts.systemProgram ?? programId,
      isWritable: false,
      isSigner: false
    }
  ];
  if (accounts.anchorRemainingAccounts != null) {
    for (const acc of accounts.anchorRemainingAccounts) {
      keys.push(acc);
    }
  }
  const ix = new web323.TransactionInstruction({
    programId,
    keys,
    data
  });
  return ix;
}

// src/generated/instructions/multisigSetRentCollector.ts
var beet44 = __toESM(require("@metaplex-foundation/beet"));
var web324 = __toESM(require("@solana/web3.js"));

// src/generated/types/MultisigSetRentCollectorArgs.ts
var beet43 = __toESM(require("@metaplex-foundation/beet"));
var beetSolana18 = __toESM(require("@metaplex-foundation/beet-solana"));
var multisigSetRentCollectorArgsBeet = new beet43.FixableBeetArgsStruct(
  [
    ["rentCollector", beet43.coption(beetSolana18.publicKey)],
    ["memo", beet43.coption(beet43.utf8String)]
  ],
  "MultisigSetRentCollectorArgs"
);

// src/generated/instructions/multisigSetRentCollector.ts
var multisigSetRentCollectorStruct = new beet44.FixableBeetArgsStruct(
  [
    ["instructionDiscriminator", beet44.uniformFixedSizeArray(beet44.u8, 8)],
    ["args", multisigSetRentCollectorArgsBeet]
  ],
  "MultisigSetRentCollectorInstructionArgs"
);
var multisigSetRentCollectorInstructionDiscriminator = [
  48,
  204,
  65,
  57,
  210,
  70,
  156,
  74
];
function createMultisigSetRentCollectorInstruction(accounts, args, programId = new web324.PublicKey("SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf")) {
  const [data] = multisigSetRentCollectorStruct.serialize({
    instructionDiscriminator: multisigSetRentCollectorInstructionDiscriminator,
    ...args
  });
  const keys = [
    {
      pubkey: accounts.multisig,
      isWritable: true,
      isSigner: false
    },
    {
      pubkey: accounts.configAuthority,
      isWritable: false,
      isSigner: true
    },
    {
      pubkey: accounts.rentPayer ?? programId,
      isWritable: accounts.rentPayer != null,
      isSigner: accounts.rentPayer != null
    },
    {
      pubkey: accounts.systemProgram ?? programId,
      isWritable: false,
      isSigner: false
    }
  ];
  if (accounts.anchorRemainingAccounts != null) {
    for (const acc of accounts.anchorRemainingAccounts) {
      keys.push(acc);
    }
  }
  const ix = new web324.TransactionInstruction({
    programId,
    keys,
    data
  });
  return ix;
}

// src/generated/instructions/multisigSetTimeLock.ts
var beet46 = __toESM(require("@metaplex-foundation/beet"));
var web325 = __toESM(require("@solana/web3.js"));

// src/generated/types/MultisigSetTimeLockArgs.ts
var beet45 = __toESM(require("@metaplex-foundation/beet"));
var multisigSetTimeLockArgsBeet = new beet45.FixableBeetArgsStruct(
  [
    ["timeLock", beet45.u32],
    ["memo", beet45.coption(beet45.utf8String)]
  ],
  "MultisigSetTimeLockArgs"
);

// src/generated/instructions/multisigSetTimeLock.ts
var multisigSetTimeLockStruct = new beet46.FixableBeetArgsStruct(
  [
    ["instructionDiscriminator", beet46.uniformFixedSizeArray(beet46.u8, 8)],
    ["args", multisigSetTimeLockArgsBeet]
  ],
  "MultisigSetTimeLockInstructionArgs"
);
var multisigSetTimeLockInstructionDiscriminator = [
  148,
  154,
  121,
  77,
  212,
  254,
  155,
  72
];
function createMultisigSetTimeLockInstruction(accounts, args, programId = new web325.PublicKey("SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf")) {
  const [data] = multisigSetTimeLockStruct.serialize({
    instructionDiscriminator: multisigSetTimeLockInstructionDiscriminator,
    ...args
  });
  const keys = [
    {
      pubkey: accounts.multisig,
      isWritable: true,
      isSigner: false
    },
    {
      pubkey: accounts.configAuthority,
      isWritable: false,
      isSigner: true
    },
    {
      pubkey: accounts.rentPayer ?? programId,
      isWritable: accounts.rentPayer != null,
      isSigner: accounts.rentPayer != null
    },
    {
      pubkey: accounts.systemProgram ?? programId,
      isWritable: false,
      isSigner: false
    }
  ];
  if (accounts.anchorRemainingAccounts != null) {
    for (const acc of accounts.anchorRemainingAccounts) {
      keys.push(acc);
    }
  }
  const ix = new web325.TransactionInstruction({
    programId,
    keys,
    data
  });
  return ix;
}

// src/generated/instructions/programConfigInit.ts
var beet48 = __toESM(require("@metaplex-foundation/beet"));
var web326 = __toESM(require("@solana/web3.js"));

// src/generated/types/ProgramConfigInitArgs.ts
var beet47 = __toESM(require("@metaplex-foundation/beet"));
var beetSolana19 = __toESM(require("@metaplex-foundation/beet-solana"));
var programConfigInitArgsBeet = new beet47.BeetArgsStruct(
  [
    ["authority", beetSolana19.publicKey],
    ["multisigCreationFee", beet47.u64],
    ["treasury", beetSolana19.publicKey]
  ],
  "ProgramConfigInitArgs"
);

// src/generated/instructions/programConfigInit.ts
var programConfigInitStruct = new beet48.BeetArgsStruct(
  [
    ["instructionDiscriminator", beet48.uniformFixedSizeArray(beet48.u8, 8)],
    ["args", programConfigInitArgsBeet]
  ],
  "ProgramConfigInitInstructionArgs"
);
var programConfigInitInstructionDiscriminator = [
  184,
  188,
  198,
  195,
  205,
  124,
  117,
  216
];
function createProgramConfigInitInstruction(accounts, args, programId = new web326.PublicKey("SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf")) {
  const [data] = programConfigInitStruct.serialize({
    instructionDiscriminator: programConfigInitInstructionDiscriminator,
    ...args
  });
  const keys = [
    {
      pubkey: accounts.programConfig,
      isWritable: true,
      isSigner: false
    },
    {
      pubkey: accounts.initializer,
      isWritable: true,
      isSigner: true
    },
    {
      pubkey: accounts.systemProgram ?? web326.SystemProgram.programId,
      isWritable: false,
      isSigner: false
    }
  ];
  if (accounts.anchorRemainingAccounts != null) {
    for (const acc of accounts.anchorRemainingAccounts) {
      keys.push(acc);
    }
  }
  const ix = new web326.TransactionInstruction({
    programId,
    keys,
    data
  });
  return ix;
}

// src/generated/instructions/programConfigSetAuthority.ts
var beet50 = __toESM(require("@metaplex-foundation/beet"));
var web327 = __toESM(require("@solana/web3.js"));

// src/generated/types/ProgramConfigSetAuthorityArgs.ts
var beetSolana20 = __toESM(require("@metaplex-foundation/beet-solana"));
var beet49 = __toESM(require("@metaplex-foundation/beet"));
var programConfigSetAuthorityArgsBeet = new beet49.BeetArgsStruct(
  [["newAuthority", beetSolana20.publicKey]],
  "ProgramConfigSetAuthorityArgs"
);

// src/generated/instructions/programConfigSetAuthority.ts
var programConfigSetAuthorityStruct = new beet50.BeetArgsStruct(
  [
    ["instructionDiscriminator", beet50.uniformFixedSizeArray(beet50.u8, 8)],
    ["args", programConfigSetAuthorityArgsBeet]
  ],
  "ProgramConfigSetAuthorityInstructionArgs"
);
var programConfigSetAuthorityInstructionDiscriminator = [
  238,
  242,
  36,
  181,
  32,
  143,
  216,
  75
];
function createProgramConfigSetAuthorityInstruction(accounts, args, programId = new web327.PublicKey("SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf")) {
  const [data] = programConfigSetAuthorityStruct.serialize({
    instructionDiscriminator: programConfigSetAuthorityInstructionDiscriminator,
    ...args
  });
  const keys = [
    {
      pubkey: accounts.programConfig,
      isWritable: true,
      isSigner: false
    },
    {
      pubkey: accounts.authority,
      isWritable: false,
      isSigner: true
    }
  ];
  if (accounts.anchorRemainingAccounts != null) {
    for (const acc of accounts.anchorRemainingAccounts) {
      keys.push(acc);
    }
  }
  const ix = new web327.TransactionInstruction({
    programId,
    keys,
    data
  });
  return ix;
}

// src/generated/instructions/programConfigSetMultisigCreationFee.ts
var beet52 = __toESM(require("@metaplex-foundation/beet"));
var web328 = __toESM(require("@solana/web3.js"));

// src/generated/types/ProgramConfigSetMultisigCreationFeeArgs.ts
var beet51 = __toESM(require("@metaplex-foundation/beet"));
var programConfigSetMultisigCreationFeeArgsBeet = new beet51.BeetArgsStruct(
  [["newMultisigCreationFee", beet51.u64]],
  "ProgramConfigSetMultisigCreationFeeArgs"
);

// src/generated/instructions/programConfigSetMultisigCreationFee.ts
var programConfigSetMultisigCreationFeeStruct = new beet52.BeetArgsStruct(
  [
    ["instructionDiscriminator", beet52.uniformFixedSizeArray(beet52.u8, 8)],
    ["args", programConfigSetMultisigCreationFeeArgsBeet]
  ],
  "ProgramConfigSetMultisigCreationFeeInstructionArgs"
);
var programConfigSetMultisigCreationFeeInstructionDiscriminator = [
  101,
  160,
  249,
  63,
  154,
  215,
  153,
  13
];
function createProgramConfigSetMultisigCreationFeeInstruction(accounts, args, programId = new web328.PublicKey("SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf")) {
  const [data] = programConfigSetMultisigCreationFeeStruct.serialize({
    instructionDiscriminator: programConfigSetMultisigCreationFeeInstructionDiscriminator,
    ...args
  });
  const keys = [
    {
      pubkey: accounts.programConfig,
      isWritable: true,
      isSigner: false
    },
    {
      pubkey: accounts.authority,
      isWritable: false,
      isSigner: true
    }
  ];
  if (accounts.anchorRemainingAccounts != null) {
    for (const acc of accounts.anchorRemainingAccounts) {
      keys.push(acc);
    }
  }
  const ix = new web328.TransactionInstruction({
    programId,
    keys,
    data
  });
  return ix;
}

// src/generated/instructions/programConfigSetTreasury.ts
var beet54 = __toESM(require("@metaplex-foundation/beet"));
var web329 = __toESM(require("@solana/web3.js"));

// src/generated/types/ProgramConfigSetTreasuryArgs.ts
var beetSolana21 = __toESM(require("@metaplex-foundation/beet-solana"));
var beet53 = __toESM(require("@metaplex-foundation/beet"));
var programConfigSetTreasuryArgsBeet = new beet53.BeetArgsStruct(
  [["newTreasury", beetSolana21.publicKey]],
  "ProgramConfigSetTreasuryArgs"
);

// src/generated/instructions/programConfigSetTreasury.ts
var programConfigSetTreasuryStruct = new beet54.BeetArgsStruct(
  [
    ["instructionDiscriminator", beet54.uniformFixedSizeArray(beet54.u8, 8)],
    ["args", programConfigSetTreasuryArgsBeet]
  ],
  "ProgramConfigSetTreasuryInstructionArgs"
);
var programConfigSetTreasuryInstructionDiscriminator = [
  111,
  46,
  243,
  117,
  144,
  188,
  162,
  107
];
function createProgramConfigSetTreasuryInstruction(accounts, args, programId = new web329.PublicKey("SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf")) {
  const [data] = programConfigSetTreasuryStruct.serialize({
    instructionDiscriminator: programConfigSetTreasuryInstructionDiscriminator,
    ...args
  });
  const keys = [
    {
      pubkey: accounts.programConfig,
      isWritable: true,
      isSigner: false
    },
    {
      pubkey: accounts.authority,
      isWritable: false,
      isSigner: true
    }
  ];
  if (accounts.anchorRemainingAccounts != null) {
    for (const acc of accounts.anchorRemainingAccounts) {
      keys.push(acc);
    }
  }
  const ix = new web329.TransactionInstruction({
    programId,
    keys,
    data
  });
  return ix;
}

// src/generated/instructions/proposalActivate.ts
var beet55 = __toESM(require("@metaplex-foundation/beet"));
var web330 = __toESM(require("@solana/web3.js"));
var proposalActivateStruct = new beet55.BeetArgsStruct(
  [["instructionDiscriminator", beet55.uniformFixedSizeArray(beet55.u8, 8)]],
  "ProposalActivateInstructionArgs"
);
var proposalActivateInstructionDiscriminator = [
  11,
  34,
  92,
  248,
  154,
  27,
  51,
  106
];
function createProposalActivateInstruction(accounts, programId = new web330.PublicKey("SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf")) {
  const [data] = proposalActivateStruct.serialize({
    instructionDiscriminator: proposalActivateInstructionDiscriminator
  });
  const keys = [
    {
      pubkey: accounts.multisig,
      isWritable: false,
      isSigner: false
    },
    {
      pubkey: accounts.member,
      isWritable: true,
      isSigner: true
    },
    {
      pubkey: accounts.proposal,
      isWritable: true,
      isSigner: false
    }
  ];
  if (accounts.anchorRemainingAccounts != null) {
    for (const acc of accounts.anchorRemainingAccounts) {
      keys.push(acc);
    }
  }
  const ix = new web330.TransactionInstruction({
    programId,
    keys,
    data
  });
  return ix;
}

// src/generated/instructions/proposalApprove.ts
var beet57 = __toESM(require("@metaplex-foundation/beet"));
var web331 = __toESM(require("@solana/web3.js"));

// src/generated/types/ProposalVoteArgs.ts
var beet56 = __toESM(require("@metaplex-foundation/beet"));
var proposalVoteArgsBeet = new beet56.FixableBeetArgsStruct(
  [["memo", beet56.coption(beet56.utf8String)]],
  "ProposalVoteArgs"
);

// src/generated/instructions/proposalApprove.ts
var proposalApproveStruct = new beet57.FixableBeetArgsStruct(
  [
    ["instructionDiscriminator", beet57.uniformFixedSizeArray(beet57.u8, 8)],
    ["args", proposalVoteArgsBeet]
  ],
  "ProposalApproveInstructionArgs"
);
var proposalApproveInstructionDiscriminator = [
  144,
  37,
  164,
  136,
  188,
  216,
  42,
  248
];
function createProposalApproveInstruction(accounts, args, programId = new web331.PublicKey("SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf")) {
  const [data] = proposalApproveStruct.serialize({
    instructionDiscriminator: proposalApproveInstructionDiscriminator,
    ...args
  });
  const keys = [
    {
      pubkey: accounts.multisig,
      isWritable: false,
      isSigner: false
    },
    {
      pubkey: accounts.member,
      isWritable: true,
      isSigner: true
    },
    {
      pubkey: accounts.proposal,
      isWritable: true,
      isSigner: false
    }
  ];
  if (accounts.anchorRemainingAccounts != null) {
    for (const acc of accounts.anchorRemainingAccounts) {
      keys.push(acc);
    }
  }
  const ix = new web331.TransactionInstruction({
    programId,
    keys,
    data
  });
  return ix;
}

// src/generated/instructions/proposalCancel.ts
var beet58 = __toESM(require("@metaplex-foundation/beet"));
var web332 = __toESM(require("@solana/web3.js"));
var proposalCancelStruct = new beet58.FixableBeetArgsStruct(
  [
    ["instructionDiscriminator", beet58.uniformFixedSizeArray(beet58.u8, 8)],
    ["args", proposalVoteArgsBeet]
  ],
  "ProposalCancelInstructionArgs"
);
var proposalCancelInstructionDiscriminator = [
  27,
  42,
  127,
  237,
  38,
  163,
  84,
  203
];
function createProposalCancelInstruction(accounts, args, programId = new web332.PublicKey("SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf")) {
  const [data] = proposalCancelStruct.serialize({
    instructionDiscriminator: proposalCancelInstructionDiscriminator,
    ...args
  });
  const keys = [
    {
      pubkey: accounts.multisig,
      isWritable: false,
      isSigner: false
    },
    {
      pubkey: accounts.member,
      isWritable: true,
      isSigner: true
    },
    {
      pubkey: accounts.proposal,
      isWritable: true,
      isSigner: false
    }
  ];
  if (accounts.anchorRemainingAccounts != null) {
    for (const acc of accounts.anchorRemainingAccounts) {
      keys.push(acc);
    }
  }
  const ix = new web332.TransactionInstruction({
    programId,
    keys,
    data
  });
  return ix;
}

// src/generated/instructions/proposalCreate.ts
var beet60 = __toESM(require("@metaplex-foundation/beet"));
var web333 = __toESM(require("@solana/web3.js"));

// src/generated/types/ProposalCreateArgs.ts
var beet59 = __toESM(require("@metaplex-foundation/beet"));
var proposalCreateArgsBeet = new beet59.BeetArgsStruct(
  [
    ["transactionIndex", beet59.u64],
    ["draft", beet59.bool]
  ],
  "ProposalCreateArgs"
);

// src/generated/instructions/proposalCreate.ts
var proposalCreateStruct = new beet60.BeetArgsStruct(
  [
    ["instructionDiscriminator", beet60.uniformFixedSizeArray(beet60.u8, 8)],
    ["args", proposalCreateArgsBeet]
  ],
  "ProposalCreateInstructionArgs"
);
var proposalCreateInstructionDiscriminator = [
  220,
  60,
  73,
  224,
  30,
  108,
  79,
  159
];
function createProposalCreateInstruction(accounts, args, programId = new web333.PublicKey("SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf")) {
  const [data] = proposalCreateStruct.serialize({
    instructionDiscriminator: proposalCreateInstructionDiscriminator,
    ...args
  });
  const keys = [
    {
      pubkey: accounts.multisig,
      isWritable: false,
      isSigner: false
    },
    {
      pubkey: accounts.proposal,
      isWritable: true,
      isSigner: false
    },
    {
      pubkey: accounts.creator,
      isWritable: false,
      isSigner: true
    },
    {
      pubkey: accounts.rentPayer,
      isWritable: true,
      isSigner: true
    },
    {
      pubkey: accounts.systemProgram ?? web333.SystemProgram.programId,
      isWritable: false,
      isSigner: false
    }
  ];
  if (accounts.anchorRemainingAccounts != null) {
    for (const acc of accounts.anchorRemainingAccounts) {
      keys.push(acc);
    }
  }
  const ix = new web333.TransactionInstruction({
    programId,
    keys,
    data
  });
  return ix;
}

// src/generated/instructions/proposalReject.ts
var beet61 = __toESM(require("@metaplex-foundation/beet"));
var web334 = __toESM(require("@solana/web3.js"));
var proposalRejectStruct = new beet61.FixableBeetArgsStruct(
  [
    ["instructionDiscriminator", beet61.uniformFixedSizeArray(beet61.u8, 8)],
    ["args", proposalVoteArgsBeet]
  ],
  "ProposalRejectInstructionArgs"
);
var proposalRejectInstructionDiscriminator = [
  243,
  62,
  134,
  156,
  230,
  106,
  246,
  135
];
function createProposalRejectInstruction(accounts, args, programId = new web334.PublicKey("SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf")) {
  const [data] = proposalRejectStruct.serialize({
    instructionDiscriminator: proposalRejectInstructionDiscriminator,
    ...args
  });
  const keys = [
    {
      pubkey: accounts.multisig,
      isWritable: false,
      isSigner: false
    },
    {
      pubkey: accounts.member,
      isWritable: true,
      isSigner: true
    },
    {
      pubkey: accounts.proposal,
      isWritable: true,
      isSigner: false
    }
  ];
  if (accounts.anchorRemainingAccounts != null) {
    for (const acc of accounts.anchorRemainingAccounts) {
      keys.push(acc);
    }
  }
  const ix = new web334.TransactionInstruction({
    programId,
    keys,
    data
  });
  return ix;
}

// src/generated/instructions/spendingLimitUse.ts
var beet63 = __toESM(require("@metaplex-foundation/beet"));
var web335 = __toESM(require("@solana/web3.js"));

// src/generated/types/SpendingLimitUseArgs.ts
var beet62 = __toESM(require("@metaplex-foundation/beet"));
var spendingLimitUseArgsBeet = new beet62.FixableBeetArgsStruct(
  [
    ["amount", beet62.u64],
    ["decimals", beet62.u8],
    ["memo", beet62.coption(beet62.utf8String)]
  ],
  "SpendingLimitUseArgs"
);

// src/generated/instructions/spendingLimitUse.ts
var spendingLimitUseStruct = new beet63.FixableBeetArgsStruct(
  [
    ["instructionDiscriminator", beet63.uniformFixedSizeArray(beet63.u8, 8)],
    ["args", spendingLimitUseArgsBeet]
  ],
  "SpendingLimitUseInstructionArgs"
);
var spendingLimitUseInstructionDiscriminator = [
  16,
  57,
  130,
  127,
  193,
  20,
  155,
  134
];
function createSpendingLimitUseInstruction(accounts, args, programId = new web335.PublicKey("SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf")) {
  const [data] = spendingLimitUseStruct.serialize({
    instructionDiscriminator: spendingLimitUseInstructionDiscriminator,
    ...args
  });
  const keys = [
    {
      pubkey: accounts.multisig,
      isWritable: false,
      isSigner: false
    },
    {
      pubkey: accounts.member,
      isWritable: false,
      isSigner: true
    },
    {
      pubkey: accounts.spendingLimit,
      isWritable: true,
      isSigner: false
    },
    {
      pubkey: accounts.vault,
      isWritable: true,
      isSigner: false
    },
    {
      pubkey: accounts.destination,
      isWritable: true,
      isSigner: false
    },
    {
      pubkey: accounts.systemProgram ?? programId,
      isWritable: false,
      isSigner: false
    },
    {
      pubkey: accounts.mint ?? programId,
      isWritable: false,
      isSigner: false
    },
    {
      pubkey: accounts.vaultTokenAccount ?? programId,
      isWritable: accounts.vaultTokenAccount != null,
      isSigner: false
    },
    {
      pubkey: accounts.destinationTokenAccount ?? programId,
      isWritable: accounts.destinationTokenAccount != null,
      isSigner: false
    },
    {
      pubkey: accounts.tokenProgram ?? programId,
      isWritable: false,
      isSigner: false
    }
  ];
  if (accounts.anchorRemainingAccounts != null) {
    for (const acc of accounts.anchorRemainingAccounts) {
      keys.push(acc);
    }
  }
  const ix = new web335.TransactionInstruction({
    programId,
    keys,
    data
  });
  return ix;
}

// src/generated/instructions/vaultBatchTransactionAccountClose.ts
var beet64 = __toESM(require("@metaplex-foundation/beet"));
var web336 = __toESM(require("@solana/web3.js"));
var vaultBatchTransactionAccountCloseStruct = new beet64.BeetArgsStruct(
  [["instructionDiscriminator", beet64.uniformFixedSizeArray(beet64.u8, 8)]],
  "VaultBatchTransactionAccountCloseInstructionArgs"
);
var vaultBatchTransactionAccountCloseInstructionDiscriminator = [
  134,
  18,
  19,
  106,
  129,
  68,
  97,
  247
];
function createVaultBatchTransactionAccountCloseInstruction(accounts, programId = new web336.PublicKey("SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf")) {
  const [data] = vaultBatchTransactionAccountCloseStruct.serialize({
    instructionDiscriminator: vaultBatchTransactionAccountCloseInstructionDiscriminator
  });
  const keys = [
    {
      pubkey: accounts.multisig,
      isWritable: false,
      isSigner: false
    },
    {
      pubkey: accounts.proposal,
      isWritable: false,
      isSigner: false
    },
    {
      pubkey: accounts.batch,
      isWritable: true,
      isSigner: false
    },
    {
      pubkey: accounts.transaction,
      isWritable: true,
      isSigner: false
    },
    {
      pubkey: accounts.rentCollector,
      isWritable: true,
      isSigner: false
    },
    {
      pubkey: accounts.systemProgram ?? web336.SystemProgram.programId,
      isWritable: false,
      isSigner: false
    }
  ];
  if (accounts.anchorRemainingAccounts != null) {
    for (const acc of accounts.anchorRemainingAccounts) {
      keys.push(acc);
    }
  }
  const ix = new web336.TransactionInstruction({
    programId,
    keys,
    data
  });
  return ix;
}

// src/generated/instructions/vaultTransactionAccountsClose.ts
var beet65 = __toESM(require("@metaplex-foundation/beet"));
var web337 = __toESM(require("@solana/web3.js"));
var vaultTransactionAccountsCloseStruct = new beet65.BeetArgsStruct(
  [["instructionDiscriminator", beet65.uniformFixedSizeArray(beet65.u8, 8)]],
  "VaultTransactionAccountsCloseInstructionArgs"
);
var vaultTransactionAccountsCloseInstructionDiscriminator = [
  196,
  71,
  187,
  176,
  2,
  35,
  170,
  165
];
function createVaultTransactionAccountsCloseInstruction(accounts, programId = new web337.PublicKey("SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf")) {
  const [data] = vaultTransactionAccountsCloseStruct.serialize({
    instructionDiscriminator: vaultTransactionAccountsCloseInstructionDiscriminator
  });
  const keys = [
    {
      pubkey: accounts.multisig,
      isWritable: false,
      isSigner: false
    },
    {
      pubkey: accounts.proposal,
      isWritable: true,
      isSigner: false
    },
    {
      pubkey: accounts.transaction,
      isWritable: true,
      isSigner: false
    },
    {
      pubkey: accounts.rentCollector,
      isWritable: true,
      isSigner: false
    },
    {
      pubkey: accounts.systemProgram ?? web337.SystemProgram.programId,
      isWritable: false,
      isSigner: false
    }
  ];
  if (accounts.anchorRemainingAccounts != null) {
    for (const acc of accounts.anchorRemainingAccounts) {
      keys.push(acc);
    }
  }
  const ix = new web337.TransactionInstruction({
    programId,
    keys,
    data
  });
  return ix;
}

// src/generated/instructions/vaultTransactionCreate.ts
var beet67 = __toESM(require("@metaplex-foundation/beet"));
var web338 = __toESM(require("@solana/web3.js"));

// src/generated/types/VaultTransactionCreateArgs.ts
var beet66 = __toESM(require("@metaplex-foundation/beet"));
var vaultTransactionCreateArgsBeet = new beet66.FixableBeetArgsStruct(
  [
    ["vaultIndex", beet66.u8],
    ["ephemeralSigners", beet66.u8],
    ["transactionMessage", beet66.bytes],
    ["memo", beet66.coption(beet66.utf8String)]
  ],
  "VaultTransactionCreateArgs"
);

// src/generated/instructions/vaultTransactionCreate.ts
var vaultTransactionCreateStruct = new beet67.FixableBeetArgsStruct(
  [
    ["instructionDiscriminator", beet67.uniformFixedSizeArray(beet67.u8, 8)],
    ["args", vaultTransactionCreateArgsBeet]
  ],
  "VaultTransactionCreateInstructionArgs"
);
var vaultTransactionCreateInstructionDiscriminator = [
  48,
  250,
  78,
  168,
  208,
  226,
  218,
  211
];
function createVaultTransactionCreateInstruction(accounts, args, programId = new web338.PublicKey("SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf")) {
  const [data] = vaultTransactionCreateStruct.serialize({
    instructionDiscriminator: vaultTransactionCreateInstructionDiscriminator,
    ...args
  });
  const keys = [
    {
      pubkey: accounts.multisig,
      isWritable: true,
      isSigner: false
    },
    {
      pubkey: accounts.transaction,
      isWritable: true,
      isSigner: false
    },
    {
      pubkey: accounts.creator,
      isWritable: false,
      isSigner: true
    },
    {
      pubkey: accounts.rentPayer,
      isWritable: true,
      isSigner: true
    },
    {
      pubkey: accounts.systemProgram ?? web338.SystemProgram.programId,
      isWritable: false,
      isSigner: false
    }
  ];
  if (accounts.anchorRemainingAccounts != null) {
    for (const acc of accounts.anchorRemainingAccounts) {
      keys.push(acc);
    }
  }
  const ix = new web338.TransactionInstruction({
    programId,
    keys,
    data
  });
  return ix;
}

// src/generated/instructions/vaultTransactionExecute.ts
var beet68 = __toESM(require("@metaplex-foundation/beet"));
var web339 = __toESM(require("@solana/web3.js"));
var vaultTransactionExecuteStruct = new beet68.BeetArgsStruct(
  [["instructionDiscriminator", beet68.uniformFixedSizeArray(beet68.u8, 8)]],
  "VaultTransactionExecuteInstructionArgs"
);
var vaultTransactionExecuteInstructionDiscriminator = [
  194,
  8,
  161,
  87,
  153,
  164,
  25,
  171
];
function createVaultTransactionExecuteInstruction(accounts, programId = new web339.PublicKey("SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf")) {
  const [data] = vaultTransactionExecuteStruct.serialize({
    instructionDiscriminator: vaultTransactionExecuteInstructionDiscriminator
  });
  const keys = [
    {
      pubkey: accounts.multisig,
      isWritable: false,
      isSigner: false
    },
    {
      pubkey: accounts.proposal,
      isWritable: true,
      isSigner: false
    },
    {
      pubkey: accounts.transaction,
      isWritable: false,
      isSigner: false
    },
    {
      pubkey: accounts.member,
      isWritable: false,
      isSigner: true
    }
  ];
  if (accounts.anchorRemainingAccounts != null) {
    for (const acc of accounts.anchorRemainingAccounts) {
      keys.push(acc);
    }
  }
  const ix = new web339.TransactionInstruction({
    programId,
    keys,
    data
  });
  return ix;
}

// src/generated/types/Vote.ts
var beet69 = __toESM(require("@metaplex-foundation/beet"));
var Vote = /* @__PURE__ */ ((Vote2) => {
  Vote2[Vote2["Approve"] = 0] = "Approve";
  Vote2[Vote2["Reject"] = 1] = "Reject";
  Vote2[Vote2["Cancel"] = 2] = "Cancel";
  return Vote2;
})(Vote || {});
var voteBeet = beet69.fixedScalarEnum(Vote);

// src/generated/index.ts
var PROGRAM_ADDRESS = "SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf";
var PROGRAM_ID = new import_web3.PublicKey(PROGRAM_ADDRESS);

// src/accounts.ts
var accounts_exports = {};
__export(accounts_exports, {
  Batch: () => Batch,
  ConfigTransaction: () => ConfigTransaction,
  Multisig: () => Multisig,
  ProgramConfig: () => ProgramConfig,
  Proposal: () => Proposal,
  SpendingLimit: () => SpendingLimit,
  VaultBatchTransaction: () => VaultBatchTransaction,
  VaultTransaction: () => VaultTransaction,
  accountProviders: () => accountProviders,
  batchBeet: () => batchBeet,
  batchDiscriminator: () => batchDiscriminator,
  configTransactionBeet: () => configTransactionBeet,
  configTransactionDiscriminator: () => configTransactionDiscriminator,
  multisigBeet: () => multisigBeet,
  multisigDiscriminator: () => multisigDiscriminator,
  programConfigBeet: () => programConfigBeet,
  programConfigDiscriminator: () => programConfigDiscriminator,
  proposalBeet: () => proposalBeet,
  proposalDiscriminator: () => proposalDiscriminator,
  spendingLimitBeet: () => spendingLimitBeet,
  spendingLimitDiscriminator: () => spendingLimitDiscriminator,
  vaultBatchTransactionBeet: () => vaultBatchTransactionBeet,
  vaultBatchTransactionDiscriminator: () => vaultBatchTransactionDiscriminator,
  vaultTransactionBeet: () => vaultTransactionBeet,
  vaultTransactionDiscriminator: () => vaultTransactionDiscriminator
});

// src/errors.ts
var errors_exports = {};
__export(errors_exports, {
  isErrorWithLogs: () => isErrorWithLogs,
  translateAndThrowAnchorError: () => translateAndThrowAnchorError
});
var import_cusper = require("@metaplex-foundation/cusper");
var cusper = (0, import_cusper.initCusper)(errorFromCode);
function translateAndThrowAnchorError(err) {
  if (!isErrorWithLogs(err)) {
    throw err;
  }
  const translatedError = cusper.errorFromProgramLogs(err.logs) ?? err;
  if (typeof Error.captureStackTrace === "function") {
    Error.captureStackTrace(translatedError, translateAndThrowAnchorError);
  }
  translatedError.logs = err.logs;
  throw translatedError;
}
var isErrorWithLogs = (err) => {
  return Boolean(
    err && typeof err === "object" && "logs" in err && Array.isArray(err.logs)
  );
};

// src/pda.ts
var import_web34 = require("@solana/web3.js");

// src/utils.ts
var utils_exports = {};
__export(utils_exports, {
  accountsForTransactionExecute: () => accountsForTransactionExecute,
  getAvailableMemoSize: () => getAvailableMemoSize,
  isSignerIndex: () => isSignerIndex,
  isStaticWritableIndex: () => isStaticWritableIndex,
  toBigInt: () => toBigInt,
  toU32Bytes: () => toU32Bytes,
  toU64Bytes: () => toU64Bytes,
  toU8Bytes: () => toU8Bytes,
  toUtfBytes: () => toUtfBytes,
  transactionMessageToMultisigTransactionMessageBytes: () => transactionMessageToMultisigTransactionMessageBytes
});
var import_beet = require("@metaplex-foundation/beet");
var import_buffer = require("buffer");

// src/types.ts
var types_exports = {};
__export(types_exports, {
  Period: () => Period,
  Permission: () => Permission,
  Permissions: () => Permissions2,
  compiledMsInstructionBeet: () => compiledMsInstructionBeet,
  fixedSizeSmallArray: () => fixedSizeSmallArray,
  isConfigActionAddMember: () => isConfigActionAddMember,
  isConfigActionAddSpendingLimit: () => isConfigActionAddSpendingLimit,
  isConfigActionChangeThreshold: () => isConfigActionChangeThreshold,
  isConfigActionRemoveMember: () => isConfigActionRemoveMember,
  isConfigActionRemoveSpendingLimit: () => isConfigActionRemoveSpendingLimit,
  isConfigActionSetTimeLock: () => isConfigActionSetTimeLock,
  isProposalStatusActive: () => isProposalStatusActive,
  isProposalStatusApproved: () => isProposalStatusApproved,
  isProposalStatusCancelled: () => isProposalStatusCancelled,
  isProposalStatusExecuted: () => isProposalStatusExecuted,
  isProposalStatusRejected: () => isProposalStatusRejected,
  messageAddressTableLookupBeet: () => messageAddressTableLookupBeet,
  smallArray: () => smallArray,
  transactionMessageBeet: () => transactionMessageBeet
});
var beet70 = __toESM(require("@metaplex-foundation/beet"));
var beetSolana22 = __toESM(require("@metaplex-foundation/beet-solana"));
var import_invariant = __toESM(require("invariant"));
var Permission = {
  Initiate: 1,
  Vote: 2,
  Execute: 4
};
var Permissions2 = class _Permissions {
  constructor(mask) {
    this.mask = mask;
  }
  static fromPermissions(permissions) {
    return new _Permissions(
      permissions.reduce((mask, permission) => mask | permission, 0)
    );
  }
  static all() {
    return new _Permissions(
      Object.values(Permission).reduce(
        (mask, permission) => mask | permission,
        0
      )
    );
  }
  static has(permissions, permission) {
    return (permissions.mask & permission) === permission;
  }
};
function fixedSizeSmallArray(lengthBeet, elements, elementsByteSize) {
  const len = elements.length;
  const firstElement = len === 0 ? "<EMPTY>" : elements[0].description;
  return {
    write: function(buf, offset, value) {
      (0, import_invariant.default)(
        value.length === len,
        `array length ${value.length} should match len ${len}`
      );
      lengthBeet.write(buf, offset, len);
      let cursor = offset + lengthBeet.byteSize;
      for (let i = 0; i < len; i++) {
        const element = elements[i];
        element.write(buf, cursor, value[i]);
        cursor += element.byteSize;
      }
    },
    read: function(buf, offset) {
      const size = lengthBeet.read(buf, offset);
      (0, import_invariant.default)(size === len, "invalid byte size");
      let cursor = offset + lengthBeet.byteSize;
      const arr = new Array(len);
      for (let i = 0; i < len; i++) {
        const element = elements[i];
        arr[i] = element.read(buf, cursor);
        cursor += element.byteSize;
      }
      return arr;
    },
    byteSize: lengthBeet.byteSize + elementsByteSize,
    length: len,
    description: `Array<${firstElement}>(${len})[ ${lengthBeet.byteSize} + ${elementsByteSize} ]`
  };
}
function smallArray(lengthBeet, element) {
  return {
    toFixedFromData(buf, offset) {
      const len = lengthBeet.read(buf, offset);
      const cursorStart = offset + lengthBeet.byteSize;
      let cursor = cursorStart;
      const fixedElements = new Array(len);
      for (let i = 0; i < len; i++) {
        const fixedElement = beet70.fixBeetFromData(
          element,
          buf,
          cursor
        );
        fixedElements[i] = fixedElement;
        cursor += fixedElement.byteSize;
      }
      return fixedSizeSmallArray(
        lengthBeet,
        fixedElements,
        cursor - cursorStart
      );
    },
    toFixedFromValue(vals) {
      (0, import_invariant.default)(Array.isArray(vals), `${vals} should be an array`);
      let elementsSize = 0;
      const fixedElements = new Array(vals.length);
      for (let i = 0; i < vals.length; i++) {
        const fixedElement = beet70.fixBeetFromValue(element, vals[i]);
        fixedElements[i] = fixedElement;
        elementsSize += fixedElement.byteSize;
      }
      return fixedSizeSmallArray(lengthBeet, fixedElements, elementsSize);
    },
    description: `smallArray`
  };
}
var compiledMsInstructionBeet = new beet70.FixableBeetArgsStruct(
  [
    ["programIdIndex", beet70.u8],
    ["accountIndexes", smallArray(beet70.u8, beet70.u8)],
    ["data", smallArray(beet70.u16, beet70.u8)]
  ],
  "CompiledMsInstruction"
);
var messageAddressTableLookupBeet = new beet70.FixableBeetArgsStruct(
  [
    ["accountKey", beetSolana22.publicKey],
    ["writableIndexes", smallArray(beet70.u8, beet70.u8)],
    ["readonlyIndexes", smallArray(beet70.u8, beet70.u8)]
  ],
  "MessageAddressTableLookup"
);
var transactionMessageBeet = new beet70.FixableBeetArgsStruct(
  [
    ["numSigners", beet70.u8],
    ["numWritableSigners", beet70.u8],
    ["numWritableNonSigners", beet70.u8],
    ["accountKeys", smallArray(beet70.u8, beetSolana22.publicKey)],
    ["instructions", smallArray(beet70.u8, compiledMsInstructionBeet)],
    [
      "addressTableLookups",
      smallArray(beet70.u8, messageAddressTableLookupBeet)
    ]
  ],
  "TransactionMessage"
);

// src/utils.ts
var import_invariant2 = __toESM(require("invariant"));

// src/utils/compileToWrappedMessageV0.ts
var import_web33 = require("@solana/web3.js");

// src/utils/compiled-keys.ts
var import_assert = __toESM(require("assert"));
var import_web32 = require("@solana/web3.js");
var CompiledKeys = class _CompiledKeys {
  payer;
  keyMetaMap;
  constructor(payer, keyMetaMap) {
    this.payer = payer;
    this.keyMetaMap = keyMetaMap;
  }
  /**
   * The only difference between this and the original is that we don't mark the instruction programIds as invoked.
   * It makes sense to do because the instructions will be called via CPI, so the programIds can come from Address Lookup Tables.
   * This allows to compress the message size and avoid hitting the tx size limit during vault_transaction_create instruction calls.
   */
  static compile(instructions, payer) {
    const keyMetaMap = /* @__PURE__ */ new Map();
    const getOrInsertDefault = (pubkey) => {
      const address = pubkey.toBase58();
      let keyMeta = keyMetaMap.get(address);
      if (keyMeta === void 0) {
        keyMeta = {
          isSigner: false,
          isWritable: false,
          isInvoked: false
        };
        keyMetaMap.set(address, keyMeta);
      }
      return keyMeta;
    };
    const payerKeyMeta = getOrInsertDefault(payer);
    payerKeyMeta.isSigner = true;
    payerKeyMeta.isWritable = true;
    for (const ix of instructions) {
      getOrInsertDefault(ix.programId).isInvoked = false;
      for (const accountMeta of ix.keys) {
        const keyMeta = getOrInsertDefault(accountMeta.pubkey);
        keyMeta.isSigner ||= accountMeta.isSigner;
        keyMeta.isWritable ||= accountMeta.isWritable;
      }
    }
    return new _CompiledKeys(payer, keyMetaMap);
  }
  getMessageComponents() {
    const mapEntries = [...this.keyMetaMap.entries()];
    (0, import_assert.default)(mapEntries.length <= 256, "Max static account keys length exceeded");
    const writableSigners = mapEntries.filter(
      ([, meta]) => meta.isSigner && meta.isWritable
    );
    const readonlySigners = mapEntries.filter(
      ([, meta]) => meta.isSigner && !meta.isWritable
    );
    const writableNonSigners = mapEntries.filter(
      ([, meta]) => !meta.isSigner && meta.isWritable
    );
    const readonlyNonSigners = mapEntries.filter(
      ([, meta]) => !meta.isSigner && !meta.isWritable
    );
    const header = {
      numRequiredSignatures: writableSigners.length + readonlySigners.length,
      numReadonlySignedAccounts: readonlySigners.length,
      numReadonlyUnsignedAccounts: readonlyNonSigners.length
    };
    {
      (0, import_assert.default)(
        writableSigners.length > 0,
        "Expected at least one writable signer key"
      );
      const [payerAddress] = writableSigners[0];
      (0, import_assert.default)(
        payerAddress === this.payer.toBase58(),
        "Expected first writable signer key to be the fee payer"
      );
    }
    const staticAccountKeys = [
      ...writableSigners.map(([address]) => new import_web32.PublicKey(address)),
      ...readonlySigners.map(([address]) => new import_web32.PublicKey(address)),
      ...writableNonSigners.map(([address]) => new import_web32.PublicKey(address)),
      ...readonlyNonSigners.map(([address]) => new import_web32.PublicKey(address))
    ];
    return [header, staticAccountKeys];
  }
  extractTableLookup(lookupTable) {
    const [writableIndexes, drainedWritableKeys] = this.drainKeysFoundInLookupTable(
      lookupTable.state.addresses,
      (keyMeta) => !keyMeta.isSigner && !keyMeta.isInvoked && keyMeta.isWritable
    );
    const [readonlyIndexes, drainedReadonlyKeys] = this.drainKeysFoundInLookupTable(
      lookupTable.state.addresses,
      (keyMeta) => !keyMeta.isSigner && !keyMeta.isInvoked && !keyMeta.isWritable
    );
    if (writableIndexes.length === 0 && readonlyIndexes.length === 0) {
      return;
    }
    return [
      {
        accountKey: lookupTable.key,
        writableIndexes,
        readonlyIndexes
      },
      {
        writable: drainedWritableKeys,
        readonly: drainedReadonlyKeys
      }
    ];
  }
  /** @internal */
  drainKeysFoundInLookupTable(lookupTableEntries, keyMetaFilter) {
    const lookupTableIndexes = new Array();
    const drainedKeys = new Array();
    for (const [address, keyMeta] of this.keyMetaMap.entries()) {
      if (keyMetaFilter(keyMeta)) {
        const key = new import_web32.PublicKey(address);
        const lookupTableIndex = lookupTableEntries.findIndex(
          (entry) => entry.equals(key)
        );
        if (lookupTableIndex >= 0) {
          (0, import_assert.default)(lookupTableIndex < 256, "Max lookup table index exceeded");
          lookupTableIndexes.push(lookupTableIndex);
          drainedKeys.push(key);
          this.keyMetaMap.delete(address);
        }
      }
    }
    return [lookupTableIndexes, drainedKeys];
  }
};

// src/utils/compileToWrappedMessageV0.ts
function compileToWrappedMessageV0({
  payerKey,
  recentBlockhash,
  instructions,
  addressLookupTableAccounts
}) {
  const compiledKeys = CompiledKeys.compile(instructions, payerKey);
  const addressTableLookups = new Array();
  const accountKeysFromLookups = {
    writable: [],
    readonly: []
  };
  const lookupTableAccounts = addressLookupTableAccounts || [];
  for (const lookupTable of lookupTableAccounts) {
    const extractResult = compiledKeys.extractTableLookup(lookupTable);
    if (extractResult !== void 0) {
      const [addressTableLookup, { writable, readonly }] = extractResult;
      addressTableLookups.push(addressTableLookup);
      accountKeysFromLookups.writable.push(...writable);
      accountKeysFromLookups.readonly.push(...readonly);
    }
  }
  const [header, staticAccountKeys] = compiledKeys.getMessageComponents();
  const accountKeys = new import_web33.MessageAccountKeys(
    staticAccountKeys,
    accountKeysFromLookups
  );
  const compiledInstructions = accountKeys.compileInstructions(instructions);
  return new import_web33.MessageV0({
    header,
    staticAccountKeys,
    recentBlockhash,
    compiledInstructions,
    addressTableLookups
  });
}

// src/utils.ts
function toUtfBytes(str) {
  return new TextEncoder().encode(str);
}
function toU8Bytes(num) {
  const bytes7 = import_buffer.Buffer.alloc(1);
  import_beet.u8.write(bytes7, 0, num);
  return bytes7;
}
function toU32Bytes(num) {
  const bytes7 = import_buffer.Buffer.alloc(4);
  import_beet.u32.write(bytes7, 0, num);
  return bytes7;
}
function toU64Bytes(num) {
  const bytes7 = import_buffer.Buffer.alloc(8);
  import_beet.u64.write(bytes7, 0, num);
  return bytes7;
}
function toBigInt(number) {
  return BigInt(number.toString());
}
var MAX_TX_SIZE_BYTES = 1232;
var STRING_LEN_SIZE = 4;
function getAvailableMemoSize(txWithoutMemo) {
  const txSize = txWithoutMemo.serialize().length;
  return MAX_TX_SIZE_BYTES - txSize - STRING_LEN_SIZE - // Sometimes long memo can trigger switching from 1 to 2 bytes length encoding in Compact-u16,
  // so we reserve 1 extra byte to make sure.
  1;
}
function isStaticWritableIndex(message, index) {
  const numAccountKeys = message.accountKeys.length;
  const { numSigners, numWritableSigners, numWritableNonSigners } = message;
  if (index >= numAccountKeys) {
    return false;
  }
  if (index < numWritableSigners) {
    return true;
  }
  if (index >= numSigners) {
    const indexIntoNonSigners = index - numSigners;
    return indexIntoNonSigners < numWritableNonSigners;
  }
  return false;
}
function isSignerIndex(message, index) {
  return index < message.numSigners;
}
function transactionMessageToMultisigTransactionMessageBytes({
  message,
  addressLookupTableAccounts,
  vaultPda
}) {
  const compiledMessage = compileToWrappedMessageV0({
    payerKey: message.payerKey,
    recentBlockhash: message.recentBlockhash,
    instructions: message.instructions,
    addressLookupTableAccounts
  });
  const [transactionMessageBytes] = transactionMessageBeet.serialize({
    numSigners: compiledMessage.header.numRequiredSignatures,
    numWritableSigners: compiledMessage.header.numRequiredSignatures - compiledMessage.header.numReadonlySignedAccounts,
    numWritableNonSigners: compiledMessage.staticAccountKeys.length - compiledMessage.header.numRequiredSignatures - compiledMessage.header.numReadonlyUnsignedAccounts,
    accountKeys: compiledMessage.staticAccountKeys,
    instructions: compiledMessage.compiledInstructions.map((ix) => {
      return {
        programIdIndex: ix.programIdIndex,
        accountIndexes: ix.accountKeyIndexes,
        data: Array.from(ix.data)
      };
    }),
    addressTableLookups: compiledMessage.addressTableLookups
  });
  return transactionMessageBytes;
}
async function accountsForTransactionExecute({
  connection,
  transactionPda,
  vaultPda,
  message,
  ephemeralSignerBumps,
  programId
}) {
  const ephemeralSignerPdas = ephemeralSignerBumps.map(
    (_, additionalSignerIndex) => {
      return getEphemeralSignerPda({
        transactionPda,
        ephemeralSignerIndex: additionalSignerIndex,
        programId
      })[0];
    }
  );
  const addressLookupTableKeys = message.addressTableLookups.map(
    ({ accountKey }) => accountKey
  );
  const addressLookupTableAccounts = new Map(
    await Promise.all(
      addressLookupTableKeys.map(async (key) => {
        const { value } = await connection.getAddressLookupTable(key);
        if (!value) {
          throw new Error(
            `Address lookup table account ${key.toBase58()} not found`
          );
        }
        return [key.toBase58(), value];
      })
    )
  );
  const accountMetas = [];
  accountMetas.push(
    ...addressLookupTableKeys.map((key) => {
      return { pubkey: key, isSigner: false, isWritable: false };
    })
  );
  for (const [accountIndex, accountKey] of message.accountKeys.entries()) {
    accountMetas.push({
      pubkey: accountKey,
      isWritable: isStaticWritableIndex(message, accountIndex),
      // NOTE: vaultPda and ephemeralSignerPdas cannot be marked as signers,
      // because they are PDAs and hence won't have their signatures on the transaction.
      isSigner: isSignerIndex(message, accountIndex) && !accountKey.equals(vaultPda) && !ephemeralSignerPdas.find((k) => accountKey.equals(k))
    });
  }
  for (const lookup of message.addressTableLookups) {
    const lookupTableAccount = addressLookupTableAccounts.get(
      lookup.accountKey.toBase58()
    );
    (0, import_invariant2.default)(
      lookupTableAccount,
      `Address lookup table account ${lookup.accountKey.toBase58()} not found`
    );
    for (const accountIndex of lookup.writableIndexes) {
      const pubkey = lookupTableAccount.state.addresses[accountIndex];
      (0, import_invariant2.default)(
        pubkey,
        `Address lookup table account ${lookup.accountKey.toBase58()} does not contain address at index ${accountIndex}`
      );
      accountMetas.push({
        pubkey,
        isWritable: true,
        // Accounts in address lookup tables can not be signers.
        isSigner: false
      });
    }
    for (const accountIndex of lookup.readonlyIndexes) {
      const pubkey = lookupTableAccount.state.addresses[accountIndex];
      (0, import_invariant2.default)(
        pubkey,
        `Address lookup table account ${lookup.accountKey.toBase58()} does not contain address at index ${accountIndex}`
      );
      accountMetas.push({
        pubkey,
        isWritable: false,
        // Accounts in address lookup tables can not be signers.
        isSigner: false
      });
    }
  }
  return {
    accountMetas,
    lookupTableAccounts: [...addressLookupTableAccounts.values()]
  };
}

// src/pda.ts
var import_invariant3 = __toESM(require("invariant"));
var SEED_PREFIX = toUtfBytes("multisig");
var SEED_PROGRAM_CONFIG = toUtfBytes("program_config");
var SEED_MULTISIG = toUtfBytes("multisig");
var SEED_VAULT = toUtfBytes("vault");
var SEED_TRANSACTION = toUtfBytes("transaction");
var SEED_PROPOSAL = toUtfBytes("proposal");
var SEED_BATCH_TRANSACTION = toUtfBytes("batch_transaction");
var SEED_EPHEMERAL_SIGNER = toUtfBytes("ephemeral_signer");
var SEED_SPENDING_LIMIT = toUtfBytes("spending_limit");
function getProgramConfigPda({
  programId = PROGRAM_ID
}) {
  return import_web34.PublicKey.findProgramAddressSync(
    [SEED_PREFIX, SEED_PROGRAM_CONFIG],
    programId
  );
}
function getMultisigPda({
  createKey,
  programId = PROGRAM_ID
}) {
  return import_web34.PublicKey.findProgramAddressSync(
    [SEED_PREFIX, SEED_MULTISIG, createKey.toBytes()],
    programId
  );
}
function getVaultPda({
  multisigPda,
  /** Authority index. */
  index,
  programId = PROGRAM_ID
}) {
  (0, import_invariant3.default)(index >= 0 && index < 256, "Invalid vault index");
  return import_web34.PublicKey.findProgramAddressSync(
    [SEED_PREFIX, multisigPda.toBytes(), SEED_VAULT, toU8Bytes(index)],
    programId
  );
}
function getEphemeralSignerPda({
  transactionPda,
  ephemeralSignerIndex,
  programId = PROGRAM_ID
}) {
  return import_web34.PublicKey.findProgramAddressSync(
    [
      SEED_PREFIX,
      transactionPda.toBytes(),
      SEED_EPHEMERAL_SIGNER,
      toU8Bytes(ephemeralSignerIndex)
    ],
    programId
  );
}
function getTransactionPda({
  multisigPda,
  index,
  programId = PROGRAM_ID
}) {
  return import_web34.PublicKey.findProgramAddressSync(
    [SEED_PREFIX, multisigPda.toBytes(), SEED_TRANSACTION, toU64Bytes(index)],
    programId
  );
}
function getProposalPda({
  multisigPda,
  transactionIndex,
  programId = PROGRAM_ID
}) {
  return import_web34.PublicKey.findProgramAddressSync(
    [
      SEED_PREFIX,
      multisigPda.toBytes(),
      SEED_TRANSACTION,
      toU64Bytes(transactionIndex),
      SEED_PROPOSAL
    ],
    programId
  );
}
function getBatchTransactionPda({
  multisigPda,
  batchIndex,
  transactionIndex,
  programId = PROGRAM_ID
}) {
  return import_web34.PublicKey.findProgramAddressSync(
    [
      SEED_PREFIX,
      multisigPda.toBytes(),
      SEED_TRANSACTION,
      toU64Bytes(batchIndex),
      SEED_BATCH_TRANSACTION,
      toU32Bytes(transactionIndex)
    ],
    programId
  );
}
function getSpendingLimitPda({
  multisigPda,
  createKey,
  programId = PROGRAM_ID
}) {
  return import_web34.PublicKey.findProgramAddressSync(
    [
      SEED_PREFIX,
      multisigPda.toBytes(),
      SEED_SPENDING_LIMIT,
      createKey.toBytes()
    ],
    programId
  );
}

// src/rpc/index.ts
var rpc_exports = {};
__export(rpc_exports, {
  batchAccountsClose: () => batchAccountsClose3,
  batchAddTransaction: () => batchAddTransaction3,
  batchCreate: () => batchCreate3,
  batchExecuteTransaction: () => batchExecuteTransaction3,
  configTransactionAccountsClose: () => configTransactionAccountsClose3,
  configTransactionCreate: () => configTransactionCreate3,
  configTransactionExecute: () => configTransactionExecute3,
  multisigAddMember: () => multisigAddMember3,
  multisigAddSpendingLimit: () => multisigAddSpendingLimit3,
  multisigCreate: () => multisigCreate3,
  multisigCreateV2: () => multisigCreateV23,
  multisigRemoveSpendingLimit: () => multisigRemoveSpendingLimit3,
  multisigSetConfigAuthority: () => multisigSetConfigAuthority3,
  multisigSetRentCollector: () => multisigSetRentCollector3,
  multisigSetTimeLock: () => multisigSetTimeLock3,
  proposalActivate: () => proposalActivate3,
  proposalApprove: () => proposalApprove3,
  proposalCancel: () => proposalCancel3,
  proposalCreate: () => proposalCreate3,
  proposalReject: () => proposalReject3,
  spendingLimitUse: () => spendingLimitUse3,
  vaultBatchTransactionAccountClose: () => vaultBatchTransactionAccountClose3,
  vaultTransactionAccountsClose: () => vaultTransactionAccountsClose3,
  vaultTransactionCreate: () => vaultTransactionCreate3,
  vaultTransactionExecute: () => vaultTransactionExecute3
});

// src/transactions/index.ts
var transactions_exports = {};
__export(transactions_exports, {
  batchAccountsClose: () => batchAccountsClose2,
  batchAddTransaction: () => batchAddTransaction2,
  batchCreate: () => batchCreate2,
  batchExecuteTransaction: () => batchExecuteTransaction2,
  configTransactionAccountsClose: () => configTransactionAccountsClose2,
  configTransactionCreate: () => configTransactionCreate2,
  configTransactionExecute: () => configTransactionExecute2,
  multisigAddMember: () => multisigAddMember2,
  multisigAddSpendingLimit: () => multisigAddSpendingLimit2,
  multisigCreate: () => multisigCreate2,
  multisigCreateV2: () => multisigCreateV22,
  multisigRemoveSpendingLimit: () => multisigRemoveSpendingLimit2,
  multisigSetConfigAuthority: () => multisigSetConfigAuthority2,
  multisigSetRentCollector: () => multisigSetRentCollector2,
  multisigSetTimeLock: () => multisigSetTimeLock2,
  proposalActivate: () => proposalActivate2,
  proposalApprove: () => proposalApprove2,
  proposalCancel: () => proposalCancel2,
  proposalCreate: () => proposalCreate2,
  proposalReject: () => proposalReject2,
  spendingLimitUse: () => spendingLimitUse2,
  vaultBatchTransactionAccountClose: () => vaultBatchTransactionAccountClose2,
  vaultTransactionAccountsClose: () => vaultTransactionAccountsClose2,
  vaultTransactionCreate: () => vaultTransactionCreate2,
  vaultTransactionExecute: () => vaultTransactionExecute2
});

// src/transactions/batchAccountsClose.ts
var import_web39 = require("@solana/web3.js");

// src/instructions/index.ts
var instructions_exports = {};
__export(instructions_exports, {
  batchAccountsClose: () => batchAccountsClose,
  batchAddTransaction: () => batchAddTransaction,
  batchCreate: () => batchCreate,
  batchExecuteTransaction: () => batchExecuteTransaction,
  configTransactionAccountsClose: () => configTransactionAccountsClose,
  configTransactionCreate: () => configTransactionCreate,
  configTransactionExecute: () => configTransactionExecute,
  multisigAddMember: () => multisigAddMember,
  multisigAddSpendingLimit: () => multisigAddSpendingLimit,
  multisigCreate: () => multisigCreate,
  multisigCreateV2: () => multisigCreateV2,
  multisigRemoveSpendingLimit: () => multisigRemoveSpendingLimit,
  multisigSetConfigAuthority: () => multisigSetConfigAuthority,
  multisigSetRentCollector: () => multisigSetRentCollector,
  multisigSetTimeLock: () => multisigSetTimeLock,
  proposalActivate: () => proposalActivate,
  proposalApprove: () => proposalApprove,
  proposalCancel: () => proposalCancel,
  proposalCreate: () => proposalCreate,
  proposalReject: () => proposalReject,
  spendingLimitUse: () => spendingLimitUse,
  vaultBatchTransactionAccountClose: () => vaultBatchTransactionAccountClose,
  vaultTransactionAccountsClose: () => vaultTransactionAccountsClose,
  vaultTransactionCreate: () => vaultTransactionCreate,
  vaultTransactionExecute: () => vaultTransactionExecute
});

// src/instructions/batchAccountsClose.ts
function batchAccountsClose({
  multisigPda,
  rentCollector,
  batchIndex,
  programId = PROGRAM_ID
}) {
  const [proposalPda] = getProposalPda({
    multisigPda,
    transactionIndex: batchIndex,
    programId
  });
  const [batchPda] = getTransactionPda({
    multisigPda,
    index: batchIndex,
    programId
  });
  return createBatchAccountsCloseInstruction(
    {
      multisig: multisigPda,
      rentCollector,
      proposal: proposalPda,
      batch: batchPda
    },
    programId
  );
}

// src/instructions/batchAddTransaction.ts
function batchAddTransaction({
  vaultIndex,
  multisigPda,
  member,
  rentPayer,
  batchIndex,
  transactionIndex,
  ephemeralSigners,
  transactionMessage,
  addressLookupTableAccounts,
  programId = PROGRAM_ID
}) {
  const [proposalPda] = getProposalPda({
    multisigPda,
    transactionIndex: batchIndex,
    programId
  });
  const [batchPda] = getTransactionPda({
    multisigPda,
    index: batchIndex,
    programId
  });
  const [batchTransactionPda] = getBatchTransactionPda({
    multisigPda,
    batchIndex,
    transactionIndex,
    programId
  });
  const [vaultPda] = getVaultPda({
    multisigPda,
    index: vaultIndex,
    programId
  });
  const transactionMessageBytes = transactionMessageToMultisigTransactionMessageBytes({
    message: transactionMessage,
    addressLookupTableAccounts,
    vaultPda
  });
  return createBatchAddTransactionInstruction(
    {
      multisig: multisigPda,
      member,
      proposal: proposalPda,
      rentPayer: rentPayer ?? member,
      batch: batchPda,
      transaction: batchTransactionPda
    },
    {
      args: {
        ephemeralSigners,
        transactionMessage: transactionMessageBytes
      }
    },
    programId
  );
}

// src/instructions/batchCreate.ts
function batchCreate({
  multisigPda,
  creator,
  rentPayer,
  batchIndex,
  vaultIndex,
  memo,
  programId = PROGRAM_ID
}) {
  const [batchPda] = getTransactionPda({
    multisigPda,
    index: batchIndex,
    programId
  });
  return createBatchCreateInstruction(
    {
      multisig: multisigPda,
      creator,
      rentPayer: rentPayer ?? creator,
      batch: batchPda
    },
    { args: { vaultIndex, memo: memo ?? null } },
    programId
  );
}

// src/instructions/batchExecuteTransaction.ts
async function batchExecuteTransaction({
  connection,
  multisigPda,
  member,
  batchIndex,
  transactionIndex,
  programId = PROGRAM_ID
}) {
  const [proposalPda] = getProposalPda({
    multisigPda,
    transactionIndex: batchIndex,
    programId
  });
  const [batchPda] = getTransactionPda({
    multisigPda,
    index: batchIndex,
    programId
  });
  const [batchTransactionPda] = getBatchTransactionPda({
    multisigPda,
    batchIndex,
    transactionIndex,
    programId
  });
  const batchAccount = await Batch.fromAccountAddress(connection, batchPda);
  const [vaultPda] = getVaultPda({
    multisigPda,
    index: batchAccount.vaultIndex,
    programId
  });
  const batchTransactionAccount = await VaultBatchTransaction.fromAccountAddress(
    connection,
    batchTransactionPda
  );
  const { accountMetas, lookupTableAccounts } = await accountsForTransactionExecute({
    connection,
    message: batchTransactionAccount.message,
    ephemeralSignerBumps: [...batchTransactionAccount.ephemeralSignerBumps],
    vaultPda,
    transactionPda: batchPda
  });
  return {
    instruction: createBatchExecuteTransactionInstruction(
      {
        multisig: multisigPda,
        member,
        proposal: proposalPda,
        batch: batchPda,
        transaction: batchTransactionPda,
        anchorRemainingAccounts: accountMetas
      },
      programId
    ),
    lookupTableAccounts
  };
}

// src/instructions/configTransactionAccountsClose.ts
function configTransactionAccountsClose({
  multisigPda,
  rentCollector,
  transactionIndex,
  programId = PROGRAM_ID
}) {
  const [proposalPda] = getProposalPda({
    multisigPda,
    transactionIndex,
    programId
  });
  const [transactionPda] = getTransactionPda({
    multisigPda,
    index: transactionIndex,
    programId
  });
  return createConfigTransactionAccountsCloseInstruction(
    {
      multisig: multisigPda,
      rentCollector,
      proposal: proposalPda,
      transaction: transactionPda
    },
    programId
  );
}

// src/instructions/configTransactionCreate.ts
function configTransactionCreate({
  multisigPda,
  transactionIndex,
  creator,
  rentPayer,
  actions,
  memo,
  programId = PROGRAM_ID
}) {
  const [transactionPda] = getTransactionPda({
    multisigPda,
    index: transactionIndex,
    programId
  });
  return createConfigTransactionCreateInstruction(
    {
      multisig: multisigPda,
      transaction: transactionPda,
      creator,
      rentPayer: rentPayer ?? creator
    },
    { args: { actions, memo: memo ?? null } },
    programId
  );
}

// src/instructions/configTransactionExecute.ts
var import_web35 = require("@solana/web3.js");
function configTransactionExecute({
  multisigPda,
  transactionIndex,
  member,
  rentPayer,
  spendingLimits,
  programId = PROGRAM_ID
}) {
  const [proposalPda] = getProposalPda({
    multisigPda,
    transactionIndex,
    programId
  });
  const [transactionPda] = getTransactionPda({
    multisigPda,
    index: transactionIndex,
    programId
  });
  return createConfigTransactionExecuteInstruction(
    {
      multisig: multisigPda,
      member,
      proposal: proposalPda,
      transaction: transactionPda,
      rentPayer,
      systemProgram: import_web35.SystemProgram.programId,
      anchorRemainingAccounts: spendingLimits?.map((spendingLimit) => ({
        pubkey: spendingLimit,
        isWritable: true,
        isSigner: false
      }))
    },
    programId
  );
}

// src/instructions/multisigCreate.ts
function multisigCreate({
  creator,
  multisigPda,
  configAuthority,
  threshold,
  members,
  timeLock,
  createKey,
  memo,
  programId = PROGRAM_ID
}) {
  return createMultisigCreateInstruction(
    {
      creator,
      createKey,
      multisig: multisigPda
    },
    {
      args: {
        configAuthority,
        threshold,
        members,
        timeLock,
        memo: memo ?? null
      }
    },
    programId
  );
}

// src/instructions/multisigCreateV2.ts
function multisigCreateV2({
  treasury,
  creator,
  multisigPda,
  configAuthority,
  threshold,
  members,
  timeLock,
  createKey,
  rentCollector,
  memo,
  programId = PROGRAM_ID
}) {
  const programConfigPda = getProgramConfigPda({ programId })[0];
  return createMultisigCreateV2Instruction(
    {
      programConfig: programConfigPda,
      treasury,
      creator,
      createKey,
      multisig: multisigPda
    },
    {
      args: {
        configAuthority,
        threshold,
        members,
        timeLock,
        rentCollector,
        memo: memo ?? null
      }
    },
    programId
  );
}

// src/instructions/multisigAddMember.ts
var import_web36 = require("@solana/web3.js");
function multisigAddMember({
  multisigPda,
  configAuthority,
  rentPayer,
  newMember,
  memo,
  programId = PROGRAM_ID
}) {
  return createMultisigAddMemberInstruction(
    {
      multisig: multisigPda,
      configAuthority,
      rentPayer,
      systemProgram: import_web36.SystemProgram.programId
    },
    { args: { newMember, memo: memo ?? null } },
    programId
  );
}

// src/instructions/multisigAddSpendingLimit.ts
var import_bn = __toESM(require("bn.js"));
function multisigAddSpendingLimit({
  multisigPda,
  configAuthority,
  spendingLimit,
  rentPayer,
  createKey,
  vaultIndex,
  mint,
  amount,
  period,
  members,
  destinations,
  memo,
  programId = PROGRAM_ID
}) {
  return createMultisigAddSpendingLimitInstruction(
    {
      multisig: multisigPda,
      spendingLimit,
      configAuthority,
      rentPayer
    },
    {
      args: {
        createKey,
        vaultIndex,
        mint,
        amount: new import_bn.default(amount.toString()),
        period,
        members,
        destinations,
        memo: memo ?? null
      }
    },
    programId
  );
}

// src/instructions/multisigRemoveSpendingLimit.ts
function multisigRemoveSpendingLimit({
  multisigPda,
  configAuthority,
  spendingLimit,
  rentCollector,
  memo,
  programId = PROGRAM_ID
}) {
  return createMultisigRemoveSpendingLimitInstruction(
    {
      multisig: multisigPda,
      spendingLimit,
      configAuthority,
      rentCollector
    },
    {
      args: {
        memo: memo ?? null
      }
    },
    programId
  );
}

// src/instructions/multisigSetConfigAuthority.ts
function multisigSetConfigAuthority({
  multisigPda,
  configAuthority,
  newConfigAuthority,
  memo,
  programId
}) {
  return createMultisigSetConfigAuthorityInstruction(
    {
      multisig: multisigPda,
      configAuthority
    },
    {
      args: {
        configAuthority: newConfigAuthority,
        memo: memo ?? null
      }
    },
    programId
  );
}

// src/instructions/multisigSetRentCollector.ts
var import_web37 = require("@solana/web3.js");
function multisigSetRentCollector({
  multisigPda,
  configAuthority,
  newRentCollector,
  rentPayer,
  memo,
  programId
}) {
  return createMultisigSetRentCollectorInstruction(
    {
      multisig: multisigPda,
      configAuthority,
      rentPayer,
      systemProgram: import_web37.SystemProgram.programId
    },
    {
      args: {
        rentCollector: newRentCollector,
        memo: memo ?? null
      }
    },
    programId
  );
}

// src/instructions/multisigSetTimeLock.ts
function multisigSetTimeLock({
  multisigPda,
  configAuthority,
  timeLock,
  memo,
  programId
}) {
  return createMultisigSetTimeLockInstruction(
    {
      multisig: multisigPda,
      configAuthority
    },
    {
      args: {
        timeLock,
        memo: memo ?? null
      }
    },
    programId
  );
}

// src/instructions/proposalActivate.ts
function proposalActivate({
  multisigPda,
  transactionIndex,
  member,
  programId = PROGRAM_ID
}) {
  const [proposalPda] = getProposalPda({
    multisigPda,
    transactionIndex,
    programId
  });
  return createProposalActivateInstruction(
    {
      multisig: multisigPda,
      proposal: proposalPda,
      member
    },
    programId
  );
}

// src/instructions/proposalApprove.ts
function proposalApprove({
  multisigPda,
  transactionIndex,
  member,
  memo,
  programId
}) {
  const [proposalPda] = getProposalPda({
    multisigPda,
    transactionIndex,
    programId
  });
  return createProposalApproveInstruction(
    { multisig: multisigPda, proposal: proposalPda, member },
    { args: { memo: memo ?? null } },
    programId
  );
}

// src/instructions/proposalCancel.ts
function proposalCancel({
  multisigPda,
  transactionIndex,
  member,
  memo,
  programId = PROGRAM_ID
}) {
  const [proposalPda] = getProposalPda({
    multisigPda,
    transactionIndex,
    programId
  });
  return createProposalCancelInstruction(
    { multisig: multisigPda, proposal: proposalPda, member },
    { args: { memo: memo ?? null } },
    programId
  );
}

// src/instructions/proposalCreate.ts
function proposalCreate({
  multisigPda,
  creator,
  rentPayer,
  transactionIndex,
  isDraft = false,
  programId = PROGRAM_ID
}) {
  const [proposalPda] = getProposalPda({
    multisigPda,
    transactionIndex,
    programId
  });
  if (transactionIndex > Number.MAX_SAFE_INTEGER) {
    throw new Error("transactionIndex is too large");
  }
  return createProposalCreateInstruction(
    {
      creator,
      rentPayer: rentPayer ?? creator,
      multisig: multisigPda,
      proposal: proposalPda
    },
    { args: { transactionIndex: Number(transactionIndex), draft: isDraft } },
    programId
  );
}

// src/instructions/proposalReject.ts
function proposalReject({
  multisigPda,
  transactionIndex,
  member,
  memo,
  programId = PROGRAM_ID
}) {
  const [proposalPda] = getProposalPda({
    multisigPda,
    transactionIndex,
    programId
  });
  return createProposalRejectInstruction(
    { multisig: multisigPda, proposal: proposalPda, member },
    { args: { memo: memo ?? null } },
    programId
  );
}

// src/instructions/spendingLimitUse.ts
var import_web38 = require("@solana/web3.js");
var import_spl_token = require("@solana/spl-token");
function spendingLimitUse({
  multisigPda,
  member,
  spendingLimit,
  mint,
  vaultIndex,
  amount,
  decimals,
  destination,
  tokenProgram = import_spl_token.TOKEN_PROGRAM_ID,
  memo,
  programId = PROGRAM_ID
}) {
  const [vaultPda] = getVaultPda({ multisigPda, index: vaultIndex, programId });
  const vaultTokenAccount = mint && (0, import_spl_token.getAssociatedTokenAddressSync)(
    mint,
    vaultPda,
    true,
    tokenProgram,
    import_spl_token.ASSOCIATED_TOKEN_PROGRAM_ID
  );
  const destinationTokenAccount = mint && (0, import_spl_token.getAssociatedTokenAddressSync)(
    mint,
    destination,
    true,
    tokenProgram,
    import_spl_token.ASSOCIATED_TOKEN_PROGRAM_ID
  );
  return createSpendingLimitUseInstruction(
    {
      multisig: multisigPda,
      member,
      spendingLimit,
      vault: vaultPda,
      destination,
      systemProgram: import_web38.SystemProgram.programId,
      mint,
      vaultTokenAccount,
      destinationTokenAccount,
      tokenProgram: mint ? tokenProgram : void 0
    },
    { args: { amount, decimals, memo: memo ?? null } },
    programId
  );
}

// src/instructions/vaultBatchTransactionAccountClose.ts
function vaultBatchTransactionAccountClose({
  multisigPda,
  rentCollector,
  batchIndex,
  transactionIndex,
  programId = PROGRAM_ID
}) {
  const [proposalPda] = getProposalPda({
    multisigPda,
    transactionIndex: batchIndex,
    programId
  });
  const [batchPda] = getTransactionPda({
    multisigPda,
    index: batchIndex,
    programId
  });
  const [batchTransactionPda] = getBatchTransactionPda({
    multisigPda,
    batchIndex,
    transactionIndex,
    programId
  });
  return createVaultBatchTransactionAccountCloseInstruction(
    {
      multisig: multisigPda,
      rentCollector,
      proposal: proposalPda,
      batch: batchPda,
      transaction: batchTransactionPda
    },
    programId
  );
}

// src/instructions/vaultTransactionAccountsClose.ts
function vaultTransactionAccountsClose({
  multisigPda,
  rentCollector,
  transactionIndex,
  programId = PROGRAM_ID
}) {
  const [proposalPda] = getProposalPda({
    multisigPda,
    transactionIndex,
    programId
  });
  const [transactionPda] = getTransactionPda({
    multisigPda,
    index: transactionIndex,
    programId
  });
  return createVaultTransactionAccountsCloseInstruction(
    {
      multisig: multisigPda,
      rentCollector,
      proposal: proposalPda,
      transaction: transactionPda
    },
    programId
  );
}

// src/instructions/vaultTransactionCreate.ts
function vaultTransactionCreate({
  multisigPda,
  transactionIndex,
  creator,
  rentPayer,
  vaultIndex,
  ephemeralSigners,
  transactionMessage,
  addressLookupTableAccounts,
  memo,
  programId = PROGRAM_ID
}) {
  const [vaultPda] = getVaultPda({
    multisigPda,
    index: vaultIndex,
    programId
  });
  const [transactionPda] = getTransactionPda({
    multisigPda,
    index: transactionIndex,
    programId
  });
  const transactionMessageBytes = transactionMessageToMultisigTransactionMessageBytes({
    message: transactionMessage,
    addressLookupTableAccounts,
    vaultPda
  });
  return createVaultTransactionCreateInstruction(
    {
      multisig: multisigPda,
      transaction: transactionPda,
      creator,
      rentPayer: rentPayer ?? creator
    },
    {
      args: {
        vaultIndex,
        ephemeralSigners,
        transactionMessage: transactionMessageBytes,
        memo: memo ?? null
      }
    },
    programId
  );
}

// src/instructions/vaultTransactionExecute.ts
async function vaultTransactionExecute({
  connection,
  multisigPda,
  transactionIndex,
  member,
  programId = PROGRAM_ID
}) {
  const [proposalPda] = getProposalPda({
    multisigPda,
    transactionIndex,
    programId
  });
  const [transactionPda] = getTransactionPda({
    multisigPda,
    index: transactionIndex,
    programId
  });
  const transactionAccount = await VaultTransaction.fromAccountAddress(
    connection,
    transactionPda
  );
  const [vaultPda] = getVaultPda({
    multisigPda,
    index: transactionAccount.vaultIndex,
    programId
  });
  const { accountMetas, lookupTableAccounts } = await accountsForTransactionExecute({
    connection,
    message: transactionAccount.message,
    ephemeralSignerBumps: [...transactionAccount.ephemeralSignerBumps],
    vaultPda,
    transactionPda,
    programId
  });
  return {
    instruction: createVaultTransactionExecuteInstruction(
      {
        multisig: multisigPda,
        member,
        proposal: proposalPda,
        transaction: transactionPda,
        anchorRemainingAccounts: accountMetas
      },
      programId
    ),
    lookupTableAccounts
  };
}

// src/transactions/batchAccountsClose.ts
function batchAccountsClose2({
  blockhash,
  feePayer,
  multisigPda,
  rentCollector,
  batchIndex,
  programId
}) {
  const message = new import_web39.TransactionMessage({
    payerKey: feePayer,
    recentBlockhash: blockhash,
    instructions: [
      batchAccountsClose({
        multisigPda,
        rentCollector,
        batchIndex,
        programId
      })
    ]
  }).compileToV0Message();
  return new import_web39.VersionedTransaction(message);
}

// src/transactions/batchAddTransaction.ts
var import_web310 = require("@solana/web3.js");
async function batchAddTransaction2({
  connection,
  feePayer,
  multisigPda,
  member,
  rentPayer,
  vaultIndex,
  batchIndex,
  transactionIndex,
  ephemeralSigners,
  transactionMessage,
  addressLookupTableAccounts,
  programId
}) {
  const blockhash = (await connection.getLatestBlockhash()).blockhash;
  const message = new import_web310.TransactionMessage({
    payerKey: feePayer,
    recentBlockhash: blockhash,
    instructions: [
      batchAddTransaction({
        vaultIndex,
        multisigPda,
        member,
        rentPayer,
        batchIndex,
        transactionIndex,
        ephemeralSigners,
        transactionMessage,
        addressLookupTableAccounts,
        programId
      })
    ]
  }).compileToV0Message();
  return new import_web310.VersionedTransaction(message);
}

// src/transactions/batchCreate.ts
var import_web311 = require("@solana/web3.js");
function batchCreate2({
  blockhash,
  feePayer,
  multisigPda,
  batchIndex,
  creator,
  rentPayer,
  vaultIndex,
  memo,
  programId
}) {
  const message = new import_web311.TransactionMessage({
    payerKey: feePayer,
    recentBlockhash: blockhash,
    instructions: [
      batchCreate({
        multisigPda,
        creator,
        rentPayer: rentPayer ?? creator,
        batchIndex,
        vaultIndex,
        memo,
        programId
      })
    ]
  }).compileToV0Message();
  return new import_web311.VersionedTransaction(message);
}

// src/transactions/batchExecuteTransaction.ts
var import_web312 = require("@solana/web3.js");
async function batchExecuteTransaction2({
  connection,
  blockhash,
  feePayer,
  multisigPda,
  member,
  batchIndex,
  transactionIndex,
  programId
}) {
  const { instruction, lookupTableAccounts } = await batchExecuteTransaction({
    connection,
    multisigPda,
    member,
    batchIndex,
    transactionIndex,
    programId
  });
  const message = new import_web312.TransactionMessage({
    payerKey: feePayer,
    recentBlockhash: blockhash,
    instructions: [instruction]
  }).compileToV0Message(lookupTableAccounts);
  return new import_web312.VersionedTransaction(message);
}

// src/transactions/configTransactionAccountsClose.ts
var import_web313 = require("@solana/web3.js");
function configTransactionAccountsClose2({
  blockhash,
  feePayer,
  multisigPda,
  rentCollector,
  transactionIndex,
  programId
}) {
  const message = new import_web313.TransactionMessage({
    payerKey: feePayer,
    recentBlockhash: blockhash,
    instructions: [
      configTransactionAccountsClose({
        multisigPda,
        rentCollector,
        transactionIndex,
        programId
      })
    ]
  }).compileToV0Message();
  return new import_web313.VersionedTransaction(message);
}

// src/transactions/configTransactionCreate.ts
var import_web314 = require("@solana/web3.js");
function configTransactionCreate2({
  blockhash,
  feePayer,
  creator,
  rentPayer,
  multisigPda,
  transactionIndex,
  actions,
  memo,
  programId
}) {
  const message = new import_web314.TransactionMessage({
    payerKey: feePayer,
    recentBlockhash: blockhash,
    instructions: [
      configTransactionCreate({
        creator,
        rentPayer,
        multisigPda,
        transactionIndex,
        actions,
        memo,
        programId
      })
    ]
  }).compileToV0Message();
  return new import_web314.VersionedTransaction(message);
}

// src/transactions/configTransactionExecute.ts
var import_web315 = require("@solana/web3.js");
function configTransactionExecute2({
  blockhash,
  feePayer,
  multisigPda,
  member,
  rentPayer,
  transactionIndex,
  spendingLimits,
  programId
}) {
  const message = new import_web315.TransactionMessage({
    payerKey: feePayer,
    recentBlockhash: blockhash,
    instructions: [
      configTransactionExecute({
        multisigPda,
        transactionIndex,
        member,
        rentPayer,
        spendingLimits,
        programId
      })
    ]
  }).compileToV0Message();
  return new import_web315.VersionedTransaction(message);
}

// src/transactions/multisigAddMember.ts
var import_web316 = require("@solana/web3.js");
function multisigAddMember2({
  blockhash,
  feePayer,
  multisigPda,
  configAuthority,
  rentPayer,
  newMember,
  memo,
  programId
}) {
  const message = new import_web316.TransactionMessage({
    payerKey: feePayer,
    recentBlockhash: blockhash,
    instructions: [
      multisigAddMember({
        multisigPda,
        configAuthority,
        rentPayer,
        newMember,
        memo,
        programId
      })
    ]
  }).compileToV0Message();
  return new import_web316.VersionedTransaction(message);
}

// src/transactions/multisigAddSpendingLimit.ts
var import_web317 = require("@solana/web3.js");
function multisigAddSpendingLimit2({
  blockhash,
  feePayer,
  multisigPda,
  configAuthority,
  spendingLimit,
  rentPayer,
  createKey,
  vaultIndex,
  mint,
  amount,
  period,
  members,
  destinations,
  memo,
  programId
}) {
  const message = new import_web317.TransactionMessage({
    payerKey: feePayer,
    recentBlockhash: blockhash,
    instructions: [
      multisigAddSpendingLimit({
        configAuthority,
        multisigPda,
        spendingLimit,
        rentPayer,
        createKey,
        vaultIndex,
        mint,
        amount,
        period,
        members,
        destinations,
        memo,
        programId
      })
    ]
  }).compileToV0Message();
  return new import_web317.VersionedTransaction(message);
}

// src/transactions/multisigRemoveSpendingLimit.ts
var import_web318 = require("@solana/web3.js");
function multisigRemoveSpendingLimit2({
  blockhash,
  feePayer,
  multisigPda,
  configAuthority,
  spendingLimit,
  rentCollector,
  memo,
  programId
}) {
  const message = new import_web318.TransactionMessage({
    payerKey: feePayer,
    recentBlockhash: blockhash,
    instructions: [
      multisigRemoveSpendingLimit({
        configAuthority,
        multisigPda,
        spendingLimit,
        rentCollector,
        memo,
        programId
      })
    ]
  }).compileToV0Message();
  return new import_web318.VersionedTransaction(message);
}

// src/transactions/multisigCreate.ts
var import_web319 = require("@solana/web3.js");
function multisigCreate2({
  blockhash,
  configAuthority,
  createKey,
  creator,
  multisigPda,
  threshold,
  members,
  timeLock,
  memo,
  programId
}) {
  const ix = multisigCreate({
    creator,
    multisigPda,
    configAuthority,
    threshold,
    members,
    timeLock,
    createKey,
    memo,
    programId
  });
  const message = new import_web319.TransactionMessage({
    payerKey: creator,
    recentBlockhash: blockhash,
    instructions: [ix]
  }).compileToV0Message();
  return new import_web319.VersionedTransaction(message);
}

// src/transactions/multisigCreateV2.ts
var import_web320 = require("@solana/web3.js");
function multisigCreateV22({
  blockhash,
  treasury,
  configAuthority,
  createKey,
  creator,
  multisigPda,
  threshold,
  members,
  timeLock,
  rentCollector,
  memo,
  programId
}) {
  const ix = multisigCreateV2({
    treasury,
    creator,
    multisigPda,
    configAuthority,
    threshold,
    members,
    timeLock,
    createKey,
    rentCollector,
    memo,
    programId
  });
  const message = new import_web320.TransactionMessage({
    payerKey: creator,
    recentBlockhash: blockhash,
    instructions: [ix]
  }).compileToV0Message();
  return new import_web320.VersionedTransaction(message);
}

// src/transactions/multisigSetConfigAuthority.ts
var import_web321 = require("@solana/web3.js");
function multisigSetConfigAuthority2({
  blockhash,
  feePayer,
  multisigPda,
  configAuthority,
  newConfigAuthority,
  memo,
  programId
}) {
  const message = new import_web321.TransactionMessage({
    payerKey: feePayer,
    recentBlockhash: blockhash,
    instructions: [
      multisigSetConfigAuthority({
        multisigPda,
        configAuthority,
        newConfigAuthority,
        memo,
        programId
      })
    ]
  }).compileToV0Message();
  return new import_web321.VersionedTransaction(message);
}

// src/transactions/multisigSetRentCollector.ts
var import_web322 = require("@solana/web3.js");
function multisigSetRentCollector2({
  blockhash,
  feePayer,
  multisigPda,
  configAuthority,
  newRentCollector,
  rentPayer,
  memo,
  programId
}) {
  const message = new import_web322.TransactionMessage({
    payerKey: feePayer,
    recentBlockhash: blockhash,
    instructions: [
      multisigSetRentCollector({
        multisigPda,
        configAuthority,
        newRentCollector,
        rentPayer,
        memo,
        programId
      })
    ]
  }).compileToV0Message();
  return new import_web322.VersionedTransaction(message);
}

// src/transactions/multisigSetTimeLock.ts
var import_web323 = require("@solana/web3.js");
function multisigSetTimeLock2({
  blockhash,
  feePayer,
  multisigPda,
  configAuthority,
  timeLock,
  memo,
  programId
}) {
  const message = new import_web323.TransactionMessage({
    payerKey: feePayer,
    recentBlockhash: blockhash,
    instructions: [
      multisigSetTimeLock({
        multisigPda,
        configAuthority,
        timeLock,
        memo,
        programId
      })
    ]
  }).compileToV0Message();
  return new import_web323.VersionedTransaction(message);
}

// src/transactions/proposalActivate.ts
var import_web324 = require("@solana/web3.js");
function proposalActivate2({
  blockhash,
  feePayer,
  multisigPda,
  transactionIndex,
  member,
  programId
}) {
  const message = new import_web324.TransactionMessage({
    payerKey: feePayer,
    recentBlockhash: blockhash,
    instructions: [
      proposalActivate({
        member,
        multisigPda,
        transactionIndex,
        programId
      })
    ]
  }).compileToV0Message();
  return new import_web324.VersionedTransaction(message);
}

// src/transactions/proposalApprove.ts
var import_web325 = require("@solana/web3.js");
function proposalApprove2({
  blockhash,
  feePayer,
  multisigPda,
  transactionIndex,
  member,
  memo,
  programId
}) {
  const message = new import_web325.TransactionMessage({
    payerKey: feePayer,
    recentBlockhash: blockhash,
    instructions: [
      proposalApprove({
        member,
        multisigPda,
        transactionIndex,
        memo,
        programId
      })
    ]
  }).compileToV0Message();
  return new import_web325.VersionedTransaction(message);
}

// src/transactions/proposalCancel.ts
var import_web326 = require("@solana/web3.js");
function proposalCancel2({
  blockhash,
  feePayer,
  multisigPda,
  transactionIndex,
  member,
  memo,
  programId
}) {
  const message = new import_web326.TransactionMessage({
    payerKey: feePayer,
    recentBlockhash: blockhash,
    instructions: [
      proposalCancel({
        member,
        multisigPda,
        transactionIndex,
        memo,
        programId
      })
    ]
  }).compileToV0Message();
  return new import_web326.VersionedTransaction(message);
}

// src/transactions/proposalCreate.ts
var import_web327 = require("@solana/web3.js");
function proposalCreate2({
  blockhash,
  feePayer,
  multisigPda,
  transactionIndex,
  creator,
  rentPayer,
  isDraft,
  programId
}) {
  const message = new import_web327.TransactionMessage({
    payerKey: feePayer,
    recentBlockhash: blockhash,
    instructions: [
      proposalCreate({
        multisigPda,
        creator,
        rentPayer,
        transactionIndex,
        isDraft,
        programId
      })
    ]
  }).compileToV0Message();
  return new import_web327.VersionedTransaction(message);
}

// src/transactions/proposalReject.ts
var import_web328 = require("@solana/web3.js");
function proposalReject2({
  blockhash,
  feePayer,
  multisigPda,
  transactionIndex,
  member,
  memo,
  programId
}) {
  const message = new import_web328.TransactionMessage({
    payerKey: feePayer,
    recentBlockhash: blockhash,
    instructions: [
      proposalReject({
        member,
        multisigPda,
        transactionIndex,
        memo,
        programId
      })
    ]
  }).compileToV0Message();
  return new import_web328.VersionedTransaction(message);
}

// src/transactions/spendingLimitUse.ts
var import_web329 = require("@solana/web3.js");
function spendingLimitUse2({
  blockhash,
  feePayer,
  multisigPda,
  member,
  spendingLimit,
  mint,
  vaultIndex,
  amount,
  decimals,
  destination,
  tokenProgram,
  memo,
  programId
}) {
  const message = new import_web329.TransactionMessage({
    payerKey: feePayer,
    recentBlockhash: blockhash,
    instructions: [
      spendingLimitUse({
        multisigPda,
        member,
        spendingLimit,
        mint,
        vaultIndex,
        amount,
        decimals,
        destination,
        tokenProgram,
        memo,
        programId
      })
    ]
  }).compileToV0Message();
  return new import_web329.VersionedTransaction(message);
}

// src/transactions/vaultBatchTransactionAccountClose.ts
var import_web330 = require("@solana/web3.js");
function vaultBatchTransactionAccountClose2({
  blockhash,
  feePayer,
  multisigPda,
  rentCollector,
  batchIndex,
  transactionIndex,
  programId
}) {
  const message = new import_web330.TransactionMessage({
    payerKey: feePayer,
    recentBlockhash: blockhash,
    instructions: [
      vaultBatchTransactionAccountClose({
        multisigPda,
        rentCollector,
        batchIndex,
        transactionIndex,
        programId
      })
    ]
  }).compileToV0Message();
  return new import_web330.VersionedTransaction(message);
}

// src/transactions/vaultTransactionAccountsClose.ts
var import_web331 = require("@solana/web3.js");
function vaultTransactionAccountsClose2({
  blockhash,
  feePayer,
  multisigPda,
  rentCollector,
  transactionIndex,
  programId
}) {
  const message = new import_web331.TransactionMessage({
    payerKey: feePayer,
    recentBlockhash: blockhash,
    instructions: [
      vaultTransactionAccountsClose({
        multisigPda,
        rentCollector,
        transactionIndex,
        programId
      })
    ]
  }).compileToV0Message();
  return new import_web331.VersionedTransaction(message);
}

// src/transactions/vaultTransactionCreate.ts
var import_web332 = require("@solana/web3.js");
function vaultTransactionCreate2({
  blockhash,
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
  programId
}) {
  const message = new import_web332.TransactionMessage({
    payerKey: feePayer,
    recentBlockhash: blockhash,
    instructions: [
      vaultTransactionCreate({
        multisigPda,
        transactionIndex,
        creator,
        rentPayer,
        vaultIndex,
        ephemeralSigners,
        transactionMessage,
        addressLookupTableAccounts,
        memo,
        programId
      })
    ]
  }).compileToV0Message();
  return new import_web332.VersionedTransaction(message);
}

// src/transactions/vaultTransactionExecute.ts
var import_web333 = require("@solana/web3.js");
async function vaultTransactionExecute2({
  connection,
  blockhash,
  feePayer,
  multisigPda,
  transactionIndex,
  member,
  programId
}) {
  const { instruction, lookupTableAccounts } = await vaultTransactionExecute({
    connection,
    multisigPda,
    member,
    transactionIndex,
    programId
  });
  const message = new import_web333.TransactionMessage({
    payerKey: feePayer,
    recentBlockhash: blockhash,
    instructions: [instruction]
  }).compileToV0Message(lookupTableAccounts);
  return new import_web333.VersionedTransaction(message);
}

// src/rpc/batchAccountsClose.ts
async function batchAccountsClose3({
  connection,
  feePayer,
  multisigPda,
  rentCollector,
  batchIndex,
  sendOptions,
  programId
}) {
  const blockhash = (await connection.getLatestBlockhash()).blockhash;
  const tx = batchAccountsClose2({
    blockhash,
    feePayer: feePayer.publicKey,
    rentCollector,
    batchIndex,
    multisigPda,
    programId
  });
  tx.sign([feePayer]);
  try {
    return await connection.sendTransaction(tx, sendOptions);
  } catch (err) {
    translateAndThrowAnchorError(err);
  }
}

// src/rpc/batchAddTransaction.ts
async function batchAddTransaction3({
  connection,
  feePayer,
  multisigPda,
  member,
  rentPayer,
  vaultIndex,
  batchIndex,
  transactionIndex,
  ephemeralSigners,
  transactionMessage,
  addressLookupTableAccounts,
  signers,
  sendOptions,
  programId
}) {
  const tx = await batchAddTransaction2({
    connection,
    feePayer: feePayer.publicKey,
    multisigPda,
    member: member.publicKey,
    rentPayer: rentPayer?.publicKey ?? member.publicKey,
    vaultIndex,
    batchIndex,
    transactionIndex,
    ephemeralSigners,
    transactionMessage,
    addressLookupTableAccounts,
    programId
  });
  const allSigners = [feePayer, member];
  if (signers) {
    allSigners.push(...signers);
  }
  if (rentPayer) {
    allSigners.push(rentPayer);
  }
  tx.sign(allSigners);
  try {
    return await connection.sendTransaction(tx, sendOptions);
  } catch (err) {
    translateAndThrowAnchorError(err);
  }
}

// src/rpc/batchCreate.ts
async function batchCreate3({
  connection,
  feePayer,
  multisigPda,
  batchIndex,
  creator,
  rentPayer,
  vaultIndex,
  memo,
  signers,
  sendOptions,
  programId
}) {
  const blockhash = (await connection.getLatestBlockhash()).blockhash;
  const tx = batchCreate2({
    blockhash,
    feePayer: feePayer.publicKey,
    multisigPda,
    batchIndex,
    creator: creator.publicKey,
    rentPayer: rentPayer?.publicKey ?? creator.publicKey,
    vaultIndex,
    memo,
    programId
  });
  const allSigners = [feePayer, creator];
  if (signers) {
    allSigners.push(...signers);
  }
  if (rentPayer) {
    allSigners.push(rentPayer);
  }
  tx.sign(allSigners);
  try {
    return await connection.sendTransaction(tx, sendOptions);
  } catch (err) {
    translateAndThrowAnchorError(err);
  }
}

// src/rpc/batchExecuteTransaction.ts
async function batchExecuteTransaction3({
  connection,
  feePayer,
  multisigPda,
  member,
  batchIndex,
  transactionIndex,
  signers,
  sendOptions,
  programId
}) {
  const blockhash = (await connection.getLatestBlockhash()).blockhash;
  const tx = await batchExecuteTransaction2({
    connection,
    blockhash,
    feePayer: feePayer.publicKey,
    multisigPda,
    member: member.publicKey,
    batchIndex,
    transactionIndex,
    programId
  });
  tx.sign([feePayer, member, ...signers ?? []]);
  try {
    return await connection.sendTransaction(tx, sendOptions);
  } catch (err) {
    translateAndThrowAnchorError(err);
  }
}

// src/rpc/configTransactionAccountsClose.ts
async function configTransactionAccountsClose3({
  connection,
  feePayer,
  multisigPda,
  rentCollector,
  transactionIndex,
  sendOptions,
  programId
}) {
  const blockhash = (await connection.getLatestBlockhash()).blockhash;
  const tx = configTransactionAccountsClose2({
    blockhash,
    feePayer: feePayer.publicKey,
    rentCollector,
    transactionIndex,
    multisigPda,
    programId
  });
  tx.sign([feePayer]);
  try {
    return await connection.sendTransaction(tx, sendOptions);
  } catch (err) {
    translateAndThrowAnchorError(err);
  }
}

// src/rpc/configTransactionCreate.ts
async function configTransactionCreate3({
  connection,
  feePayer,
  multisigPda,
  transactionIndex,
  creator,
  rentPayer,
  actions,
  memo,
  signers,
  sendOptions,
  programId
}) {
  const blockhash = (await connection.getLatestBlockhash()).blockhash;
  const tx = configTransactionCreate2({
    blockhash,
    feePayer: feePayer.publicKey,
    multisigPda,
    transactionIndex,
    creator,
    rentPayer,
    actions,
    memo,
    programId
  });
  tx.sign([feePayer, ...signers ?? []]);
  try {
    return await connection.sendTransaction(tx, sendOptions);
  } catch (err) {
    translateAndThrowAnchorError(err);
  }
}

// src/rpc/configTransactionExecute.ts
async function configTransactionExecute3({
  connection,
  feePayer,
  multisigPda,
  transactionIndex,
  member,
  rentPayer,
  spendingLimits,
  signers,
  sendOptions,
  programId
}) {
  const blockhash = (await connection.getLatestBlockhash()).blockhash;
  const tx = configTransactionExecute2({
    blockhash,
    feePayer: feePayer.publicKey,
    multisigPda,
    transactionIndex,
    member: member.publicKey,
    rentPayer: rentPayer.publicKey,
    spendingLimits,
    programId
  });
  tx.sign([feePayer, member, rentPayer, ...signers ?? []]);
  try {
    return await connection.sendTransaction(tx, sendOptions);
  } catch (err) {
    translateAndThrowAnchorError(err);
  }
}

// src/rpc/multisigAddMember.ts
async function multisigAddMember3({
  connection,
  feePayer,
  multisigPda,
  configAuthority,
  rentPayer,
  newMember,
  memo,
  signers,
  sendOptions,
  programId
}) {
  const blockhash = (await connection.getLatestBlockhash()).blockhash;
  const tx = multisigAddMember2({
    blockhash,
    feePayer: feePayer.publicKey,
    multisigPda,
    configAuthority,
    rentPayer: rentPayer.publicKey,
    newMember,
    memo,
    programId
  });
  tx.sign([feePayer, rentPayer, ...signers ?? []]);
  try {
    return await connection.sendTransaction(tx, sendOptions);
  } catch (err) {
    translateAndThrowAnchorError(err);
  }
}

// src/rpc/multisigAddSpendingLimit.ts
async function multisigAddSpendingLimit3({
  connection,
  feePayer,
  multisigPda,
  configAuthority,
  spendingLimit,
  rentPayer,
  createKey,
  vaultIndex,
  mint,
  amount,
  period,
  members,
  destinations,
  memo,
  signers,
  sendOptions,
  programId
}) {
  const blockhash = (await connection.getLatestBlockhash()).blockhash;
  const tx = multisigAddSpendingLimit2({
    blockhash,
    feePayer: feePayer.publicKey,
    multisigPda,
    configAuthority,
    spendingLimit,
    rentPayer: rentPayer.publicKey,
    createKey,
    vaultIndex,
    mint,
    amount,
    period,
    members,
    destinations,
    memo,
    programId
  });
  tx.sign([feePayer, rentPayer, ...signers ?? []]);
  try {
    return await connection.sendTransaction(tx, sendOptions);
  } catch (err) {
    translateAndThrowAnchorError(err);
  }
}

// src/rpc/multisigRemoveSpendingLimit.ts
async function multisigRemoveSpendingLimit3({
  connection,
  feePayer,
  multisigPda,
  configAuthority,
  spendingLimit,
  rentCollector,
  memo,
  signers,
  sendOptions,
  programId
}) {
  const blockhash = (await connection.getLatestBlockhash()).blockhash;
  const tx = multisigRemoveSpendingLimit2({
    blockhash,
    feePayer: feePayer.publicKey,
    multisigPda,
    configAuthority,
    spendingLimit,
    rentCollector,
    memo,
    programId
  });
  tx.sign([feePayer, ...signers ?? []]);
  try {
    return await connection.sendTransaction(tx, sendOptions);
  } catch (err) {
    translateAndThrowAnchorError(err);
  }
}

// src/rpc/multisigCreate.ts
async function multisigCreate3({
  connection,
  createKey,
  creator,
  multisigPda,
  configAuthority,
  threshold,
  members,
  timeLock,
  memo,
  sendOptions,
  programId
}) {
  const blockhash = (await connection.getLatestBlockhash()).blockhash;
  const tx = multisigCreate2({
    blockhash,
    createKey: createKey.publicKey,
    creator: creator.publicKey,
    multisigPda,
    configAuthority,
    threshold,
    members,
    timeLock,
    memo,
    programId
  });
  tx.sign([creator, createKey]);
  try {
    return await connection.sendTransaction(tx, sendOptions);
  } catch (err) {
    translateAndThrowAnchorError(err);
  }
}

// src/rpc/multisigCreateV2.ts
async function multisigCreateV23({
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
  programId
}) {
  const blockhash = (await connection.getLatestBlockhash()).blockhash;
  const tx = multisigCreateV22({
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
    programId
  });
  tx.sign([creator, createKey]);
  try {
    return await connection.sendTransaction(tx, sendOptions);
  } catch (err) {
    translateAndThrowAnchorError(err);
  }
}

// src/rpc/multisigSetConfigAuthority.ts
async function multisigSetConfigAuthority3({
  connection,
  feePayer,
  multisigPda,
  configAuthority,
  newConfigAuthority,
  memo,
  signers,
  sendOptions,
  programId
}) {
  const blockhash = (await connection.getLatestBlockhash()).blockhash;
  const tx = multisigSetConfigAuthority2({
    blockhash,
    feePayer: feePayer.publicKey,
    multisigPda,
    configAuthority,
    newConfigAuthority,
    memo,
    programId
  });
  tx.sign([feePayer, ...signers ?? []]);
  try {
    return await connection.sendTransaction(tx, sendOptions);
  } catch (err) {
    translateAndThrowAnchorError(err);
  }
}

// src/rpc/multisigSetRentCollector.ts
async function multisigSetRentCollector3({
  connection,
  feePayer,
  multisigPda,
  configAuthority,
  newRentCollector,
  rentPayer,
  memo,
  signers,
  sendOptions,
  programId
}) {
  const blockhash = (await connection.getLatestBlockhash()).blockhash;
  const tx = multisigSetRentCollector2({
    blockhash,
    feePayer: feePayer.publicKey,
    multisigPda,
    configAuthority,
    newRentCollector,
    rentPayer,
    memo,
    programId
  });
  tx.sign([feePayer, ...signers ?? []]);
  try {
    return await connection.sendTransaction(tx, sendOptions);
  } catch (err) {
    translateAndThrowAnchorError(err);
  }
}

// src/rpc/multisigSetTimeLock.ts
async function multisigSetTimeLock3({
  connection,
  feePayer,
  multisigPda,
  configAuthority,
  timeLock,
  memo,
  signers,
  sendOptions,
  programId
}) {
  const blockhash = (await connection.getLatestBlockhash()).blockhash;
  const tx = multisigSetTimeLock2({
    blockhash,
    feePayer: feePayer.publicKey,
    multisigPda,
    configAuthority,
    timeLock,
    memo,
    programId
  });
  tx.sign([feePayer, ...signers ?? []]);
  try {
    return await connection.sendTransaction(tx, sendOptions);
  } catch (err) {
    translateAndThrowAnchorError(err);
  }
}

// src/rpc/proposalActivate.ts
async function proposalActivate3({
  connection,
  feePayer,
  member,
  multisigPda,
  transactionIndex,
  sendOptions,
  programId
}) {
  const blockhash = (await connection.getLatestBlockhash()).blockhash;
  const tx = proposalActivate2({
    blockhash,
    feePayer: feePayer.publicKey,
    multisigPda,
    transactionIndex,
    member: member.publicKey,
    programId
  });
  tx.sign([feePayer, member]);
  try {
    return await connection.sendTransaction(tx, sendOptions);
  } catch (err) {
    translateAndThrowAnchorError(err);
  }
}

// src/rpc/proposalApprove.ts
async function proposalApprove3({
  connection,
  feePayer,
  member,
  multisigPda,
  transactionIndex,
  memo,
  sendOptions,
  programId
}) {
  const blockhash = (await connection.getLatestBlockhash()).blockhash;
  const tx = proposalApprove2({
    blockhash,
    feePayer: feePayer.publicKey,
    multisigPda,
    transactionIndex,
    member: member.publicKey,
    memo,
    programId
  });
  tx.sign([feePayer, member]);
  try {
    return await connection.sendTransaction(tx, sendOptions);
  } catch (err) {
    translateAndThrowAnchorError(err);
  }
}

// src/rpc/proposalCancel.ts
async function proposalCancel3({
  connection,
  feePayer,
  member,
  multisigPda,
  transactionIndex,
  memo,
  sendOptions,
  programId
}) {
  const blockhash = (await connection.getLatestBlockhash()).blockhash;
  const tx = proposalCancel2({
    blockhash,
    feePayer: feePayer.publicKey,
    multisigPda,
    transactionIndex,
    member: member.publicKey,
    memo,
    programId
  });
  tx.sign([feePayer, member]);
  try {
    return await connection.sendTransaction(tx, sendOptions);
  } catch (err) {
    translateAndThrowAnchorError(err);
  }
}

// src/rpc/proposalCreate.ts
async function proposalCreate3({
  connection,
  feePayer,
  creator,
  rentPayer,
  multisigPda,
  transactionIndex,
  isDraft,
  sendOptions,
  programId
}) {
  const blockhash = (await connection.getLatestBlockhash()).blockhash;
  const tx = proposalCreate2({
    blockhash,
    feePayer: feePayer.publicKey,
    multisigPda,
    transactionIndex,
    creator: creator.publicKey,
    isDraft,
    programId
  });
  const allSigners = [feePayer, creator];
  if (rentPayer) {
    allSigners.push(rentPayer);
  }
  tx.sign(allSigners);
  try {
    return await connection.sendTransaction(tx, sendOptions);
  } catch (err) {
    translateAndThrowAnchorError(err);
  }
}

// src/rpc/proposalReject.ts
async function proposalReject3({
  connection,
  feePayer,
  member,
  multisigPda,
  transactionIndex,
  memo,
  sendOptions,
  programId
}) {
  const blockhash = (await connection.getLatestBlockhash()).blockhash;
  const tx = proposalReject2({
    blockhash,
    feePayer: feePayer.publicKey,
    multisigPda,
    transactionIndex,
    member: member.publicKey,
    memo,
    programId
  });
  tx.sign([feePayer, member]);
  try {
    return await connection.sendTransaction(tx, sendOptions);
  } catch (err) {
    translateAndThrowAnchorError(err);
  }
}

// src/rpc/spendingLimitUse.ts
async function spendingLimitUse3({
  connection,
  feePayer,
  member,
  multisigPda,
  spendingLimit,
  mint,
  vaultIndex,
  amount,
  decimals,
  destination,
  tokenProgram,
  memo,
  sendOptions,
  programId
}) {
  const blockhash = (await connection.getLatestBlockhash()).blockhash;
  const tx = spendingLimitUse2({
    blockhash,
    feePayer: feePayer.publicKey,
    multisigPda,
    member: member.publicKey,
    spendingLimit,
    mint,
    vaultIndex,
    amount,
    decimals,
    destination,
    tokenProgram,
    memo,
    programId
  });
  tx.sign([feePayer, member]);
  try {
    return await connection.sendTransaction(tx, sendOptions);
  } catch (err) {
    translateAndThrowAnchorError(err);
  }
}

// src/rpc/vaultBatchTransactionAccountClose.ts
async function vaultBatchTransactionAccountClose3({
  connection,
  feePayer,
  multisigPda,
  rentCollector,
  batchIndex,
  transactionIndex,
  sendOptions,
  programId
}) {
  const blockhash = (await connection.getLatestBlockhash()).blockhash;
  const tx = vaultBatchTransactionAccountClose2({
    blockhash,
    feePayer: feePayer.publicKey,
    rentCollector,
    batchIndex,
    transactionIndex,
    multisigPda,
    programId
  });
  tx.sign([feePayer]);
  try {
    return await connection.sendTransaction(tx, sendOptions);
  } catch (err) {
    translateAndThrowAnchorError(err);
  }
}

// src/rpc/vaultTransactionAccountsClose.ts
async function vaultTransactionAccountsClose3({
  connection,
  feePayer,
  multisigPda,
  rentCollector,
  transactionIndex,
  sendOptions,
  programId
}) {
  const blockhash = (await connection.getLatestBlockhash()).blockhash;
  const tx = vaultTransactionAccountsClose2({
    blockhash,
    feePayer: feePayer.publicKey,
    rentCollector,
    transactionIndex,
    multisigPda,
    programId
  });
  tx.sign([feePayer]);
  try {
    return await connection.sendTransaction(tx, sendOptions);
  } catch (err) {
    translateAndThrowAnchorError(err);
  }
}

// src/rpc/vaultTransactionCreate.ts
async function vaultTransactionCreate3({
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
  programId
}) {
  const blockhash = (await connection.getLatestBlockhash()).blockhash;
  const tx = vaultTransactionCreate2({
    blockhash,
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
    programId
  });
  tx.sign([feePayer, ...signers ?? []]);
  try {
    return await connection.sendTransaction(tx, sendOptions);
  } catch (err) {
    translateAndThrowAnchorError(err);
  }
}

// src/rpc/vaultTransactionExecute.ts
async function vaultTransactionExecute3({
  connection,
  feePayer,
  multisigPda,
  transactionIndex,
  member,
  signers,
  sendOptions,
  programId
}) {
  const blockhash = (await connection.getLatestBlockhash()).blockhash;
  const tx = await vaultTransactionExecute2({
    connection,
    blockhash,
    feePayer: feePayer.publicKey,
    multisigPda,
    transactionIndex,
    member,
    programId
  });
  tx.sign([feePayer, ...signers ?? []]);
  try {
    return await connection.sendTransaction(tx, sendOptions);
  } catch (err) {
    translateAndThrowAnchorError(err);
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  PROGRAM_ADDRESS,
  PROGRAM_ID,
  accounts,
  errors,
  generated,
  getBatchTransactionPda,
  getEphemeralSignerPda,
  getMultisigPda,
  getProgramConfigPda,
  getProposalPda,
  getSpendingLimitPda,
  getTransactionPda,
  getVaultPda,
  instructions,
  rpc,
  transactions,
  types,
  utils
});
