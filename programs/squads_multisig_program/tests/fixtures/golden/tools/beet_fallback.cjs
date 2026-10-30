// Encodes instructions that mainnet sampling did not cover, with the frozen v4 TS SDK
// (Solita/Beet). Prints fixture lines: `<instruction> beet:<case> <hex>`.
const { PublicKey } = require("@solana/web3.js");
const { generated } = require("@sqds/multisig");

const key = (n) => new PublicKey(new Uint8Array(32).fill(n));
const accounts = new Proxy({}, { get: (_, prop) => (prop === "anchorRemainingAccounts" ? undefined : key(1)) });
const memo = (s) => s;

const cases = [
  ["program_config_init", "init", "createProgramConfigInitInstruction", { args: { authority: key(2), multisigCreationFee: 25_000_000, treasury: key(3) } }],
  ["program_config_set_authority", "set", "createProgramConfigSetAuthorityInstruction", { args: { newAuthority: key(4) } }],
  ["program_config_set_multisig_creation_fee", "fee", "createProgramConfigSetMultisigCreationFeeInstruction", { args: { newMultisigCreationFee: 1_000_000_000 } }],
  ["program_config_set_treasury", "set", "createProgramConfigSetTreasuryInstruction", { args: { newTreasury: key(5) } }],
  ["multisig_add_member", "all-permissions-memo", "createMultisigAddMemberInstruction", { args: { newMember: { key: key(6), permissions: { mask: 7 } }, memo: memo("add") } }],
  ["multisig_add_member", "vote-only-no-memo", "createMultisigAddMemberInstruction", { args: { newMember: { key: key(7), permissions: { mask: 2 } }, memo: null } }],
  ["multisig_remove_member", "memo", "createMultisigRemoveMemberInstruction", { args: { oldMember: key(6), memo: memo("remove") } }],
  ["multisig_set_time_lock", "one-day", "createMultisigSetTimeLockInstruction", { args: { timeLock: 86_400, memo: null } }],
  ["multisig_change_threshold", "two", "createMultisigChangeThresholdInstruction", { args: { newThreshold: 2, memo: memo("threshold") } }],
  ["multisig_set_config_authority", "set", "createMultisigSetConfigAuthorityInstruction", { args: { configAuthority: key(8), memo: null } }],
  ["multisig_set_rent_collector", "some", "createMultisigSetRentCollectorInstruction", { args: { rentCollector: key(9), memo: null } }],
  ["multisig_set_rent_collector", "none", "createMultisigSetRentCollectorInstruction", { args: { rentCollector: null, memo: memo("off") } }],
  ["multisig_add_spending_limit", "spl-week-destinations", "createMultisigAddSpendingLimitInstruction", {
    args: { createKey: key(10), vaultIndex: 1, mint: key(11), amount: 5_000_000, period: 2, members: [key(12)], destinations: [key(13), key(14)], memo: memo("limit") },
  }],
  ["multisig_add_spending_limit", "sol-onetime-any-destination", "createMultisigAddSpendingLimitInstruction", {
    args: { createKey: key(15), vaultIndex: 0, mint: PublicKey.default, amount: 1_000_000_000, period: 0, members: [key(12), key(16)], destinations: [], memo: null },
  }],
  ["multisig_remove_spending_limit", "memo", "createMultisigRemoveSpendingLimitInstruction", { args: { memo: memo("remove limit") } }],
  ["transaction_buffer_close", "no-args", "createTransactionBufferCloseInstruction", undefined],
  ["proposal_cancel_v2", "memo", "createProposalCancelV2Instruction", { args: { memo: memo("cancel") } }],
  ["batch_accounts_close", "no-args", "createBatchAccountsCloseInstruction", undefined],
];

for (const [name, label, builder, args] of cases) {
  const ix = args === undefined ? generated[builder](accounts) : generated[builder](accounts, args);
  console.log(`${name} beet:${label} ${Buffer.from(ix.data).toString("hex")}`);
}
