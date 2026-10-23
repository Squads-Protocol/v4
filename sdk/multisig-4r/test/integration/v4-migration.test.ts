import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { getSetComputeUnitLimitInstruction } from "@solana-program/compute-budget";
import { getCreateAccountInstruction } from "@solana-program/system";
import {
  AuthorityType,
  fetchMint,
  getApproveInstruction,
  getCreateAssociatedTokenIdempotentInstructionAsync,
  getFreezeAccountInstruction,
  getInitializeMint2Instruction,
  getMintToInstruction,
  getSetAuthorityInstruction,
} from "@solana-program/token";
import {
  AccountRole,
  address,
  airdropFactory,
  appendTransactionMessageInstructions,
  compressTransactionMessageUsingAddressLookupTables,
  createKeyPairSignerFromBytes,
  createNoopSigner,
  createSolanaRpc,
  createSolanaRpcSubscriptions,
  downgradeRoleToNonSigner,
  isSignerRole,
  createTransactionMessage,
  generateKeyPairSigner,
  getAddressDecoder,
  getAddressEncoder,
  getBase64EncodedWireTransaction,
  getProgramDerivedAddress,
  getSignatureFromTransaction,
  lamports,
  pipe,
  sendAndConfirmTransactionFactory,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
  some,
  type Address,
  type Instruction,
  type KeyPairSigner,
  type Signature,
  type TransactionSigner,
} from "@solana/kit";
import { beforeAll, describe, expect, it } from "vitest";

import {
  BPF_LOADER_UPGRADEABLE_ADDRESS,
  fetchMaybeMultisig,
  fetchMaybeProgramConfig,
  fetchMultisigChecked,
  fetchProgramConfigChecked,
  fetchVaultBatchTransactionChecked,
  fetchVaultTransactionChecked,
  findAssociatedTokenAddress,
  findBatchTransactionPda,
  findMultisigPda,
  findProgramConfigPda,
  findProposalPda,
  findSuccessorPda,
  findTransactionPda,
  findVaultPda,
  getAccountsForExecute,
  getBatchAddTransactionInstruction,
  getBatchCreateInstruction,
  getBatchExecuteTransactionInstruction,
  getCreateLookupTablesTransactions,
  getDeactivateLookupTableInstruction,
  getMigrateProgramsInstruction,
  getMigrateSolInstruction,
  getMigrateStakesInstruction,
  getMigrateTokenAuthoritiesInstruction,
  getMigrateTokensInstruction,
  getMigrateVoteAccountsInstruction,
  getMigrationAccounts,
  getMigrationLookupTableAddresses,
  getMultisigAddMemberInstruction,
  getMultisigCreateFromInstructionAsync,
  getMultisigCreateV2InstructionAsync,
  getMultisigEventsFromTransaction,
  getMultisigMigrateSolInstruction,
  getMultisigMigrateTokenAuthoritiesInstruction,
  getProgramConfigInitInstructionAsync,
  getProgramConfigSetMultisigCreationFeeInstruction,
  getProposalActivateInstruction,
  getProposalApproveInstruction,
  getProposalCreateInstruction,
  getTransactionMessageBytes,
  getV4BatchExecuteInstructions,
  getV4MigrationProposal,
  getV4VaultInventory,
  getV4VaultTransactionExecuteInstruction,
  getVaultTransactionCreateInstruction,
  getVaultTransactionExecuteInstructionWithAccounts,
  LEGACY_V4_PROGRAM_ADDRESS,
  MigrationScope,
  MigrationSkipReason,
  parseMintAuthorities,
  planV4Migration,
  STAKE_PROGRAM_ADDRESS,
  TOKEN_2022_PROGRAM_ADDRESS,
  TOKEN_PROGRAM_ADDRESS,
  TokenAuthorityKind,
  VOTE_PROGRAM_ADDRESS,
  withEvents,
  withMigrationLookupTables,
  type AddressLookupTables,
  type MemberArgs,
  type MigrationAssetKind,
  type MigrationEvent,
  type MigrationItem,
  type MigrationSource,
  type MultisigEvent,
} from "../../src";

// Needs the 4r testing build, the mainnet v4 program, its ProgramConfig and an upgradeable program
// with FIXED_V4_VAULT as authority. Validator flags: tests/fixtures/v4-mainnet/README.md.
const TEST_PROGRAM = address("GyhGAqjokLwF9UXdQ2dR5Zwiup242j4mX4J1tSMKyAmD");
const UPGRADEABLE_PROGRAM = address("5Yk7if5XWfc34w2n8Zr2h6giukrKUFMBy98ACXvJZBL1");
const FIXED_V4_VAULT = address("4GXYAfWWYJKtYwNtzdNMEMVYsqJBzZ363RZXT7Wjec9Q");
const RENT_SYSVAR = address("SysvarRent111111111111111111111111111111111");
const CLOCK_SYSVAR = address("SysvarC1ock11111111111111111111111111111111");
const SYSTEM_PROGRAM = address("11111111111111111111111111111111");
const v4 = { programAddress: LEGACY_V4_PROGRAM_ADDRESS };
const r4 = { programAddress: TEST_PROGRAM };
const repoRoot = join(__dirname, "..", "..", "..", "..");
const ALL_PERMISSIONS = { mask: 7 };

// Anchor and program error codes.
const CONSTRAINT_SEEDS = 2006;
const ACCOUNT_NOT_SIGNER = 3010;
const V4_INVALID_ACCOUNT = 6014;
const INVALID_PROGRAM_ID = 3008;
const ACCOUNT_NOT_INITIALIZED = 3012;
const ACCOUNT_ALREADY_IN_USE = 0;
const MIGRATION_GOVERNANCE_MISMATCH = 6046;
const MIGRATION_INVALID_ASSET_ACCOUNTS = 6048;
const MIGRATION_INVALID_AMOUNT = 6049;
const MIGRATION_CREATION_FEE_TOO_HIGH = 6050;

const rpc = createSolanaRpc(process.env.RPC_URL ?? "http://127.0.0.1:8899");
const rpcSubscriptions = createSolanaRpcSubscriptions(process.env.RPC_WS_URL ?? "ws://127.0.0.1:8900");
const sendAndConfirm = sendAndConfirmTransactionFactory({ rpc, rpcSubscriptions });
const airdrop = airdropFactory({ rpc, rpcSubscriptions });
const addressEncoder = getAddressEncoder();
const computeLimit = getSetComputeUnitLimitInstruction({ units: 1_400_000 });

async function signed(payer: KeyPairSigner, instructions: Instruction[], tables: AddressLookupTables = {}) {
  const { value: blockhash } = await rpc.getLatestBlockhash().send();
  const message = pipe(
    createTransactionMessage({ version: 0 }),
    (m) => setTransactionMessageFeePayerSigner(payer, m),
    (m) => setTransactionMessageLifetimeUsingBlockhash(blockhash, m),
    (m) => appendTransactionMessageInstructions(instructions, m),
    (m) => compressTransactionMessageUsingAddressLookupTables(m, tables as Record<Address, Address[]>),
  );
  return signTransactionMessageWithSigners(message);
}

async function send(payer: KeyPairSigner, instructions: Instruction[], tables: AddressLookupTables = {}): Promise<Signature> {
  const transaction = await signed(payer, instructions, tables);
  await sendAndConfirm(transaction as Parameters<typeof sendAndConfirm>[0], { commitment: "confirmed" });
  return getSignatureFromTransaction(transaction);
}

/** The custom error code of the failing instruction, from a simulation. */
async function simulatedErrorCode(payer: KeyPairSigner, instructions: Instruction[]): Promise<number | undefined> {
  const transaction = await signed(payer, instructions);
  const { value } = await rpc
    .simulateTransaction(getBase64EncodedWireTransaction(transaction), { encoding: "base64", commitment: "confirmed" })
    .send();
  const error = value.err as { InstructionError?: [number, { Custom?: number | bigint } | string] } | null;
  const detail = error?.InstructionError?.[1];
  return typeof detail === "object" && detail.Custom !== undefined ? Number(detail.Custom) : undefined;
}

async function eventsOf(signature: Signature): Promise<MultisigEvent[]> {
  const transaction = await rpc
    .getTransaction(signature, { commitment: "confirmed", encoding: "json", maxSupportedTransactionVersion: 0 })
    .send();
  if (!transaction) throw new Error("transaction not found");
  return getMultisigEventsFromTransaction(transaction, TEST_PROGRAM);
}

async function migrationEvent(signature: Signature): Promise<MigrationEvent> {
  const migration = (await eventsOf(signature)).find((event) => event.__kind === "Migration");
  if (migration?.__kind !== "Migration") throw new Error("no Migration event");
  return migration;
}

async function fundedSigner(sol: bigint): Promise<KeyPairSigner> {
  const signer = await generateKeyPairSigner();
  await airdrop({ recipientAddress: signer.address, lamports: lamports(sol * 1_000_000_000n), commitment: "confirmed" });
  return signer;
}

async function accountData(account: Address): Promise<Uint8Array | null> {
  const { value } = await rpc.getAccountInfo(account, { encoding: "base64", commitment: "confirmed" }).send();
  return value ? Uint8Array.from(Buffer.from(value.data[0], "base64")) : null;
}

async function tokenBalance(account: Address): Promise<bigint> {
  const { value } = await rpc.getTokenAccountBalance(account, { commitment: "confirmed" }).send();
  return BigInt(value.amount);
}

const addressAt = (data: Uint8Array, offset: number) => getAddressDecoder().decode(data.slice(offset, offset + 32));

async function programConfigAuthority(): Promise<KeyPairSigner> {
  const bytes = JSON.parse(readFileSync(join(repoRoot, "test-program-config-initializer-keypair.json"), "utf8"));
  return createKeyPairSignerFromBytes(Uint8Array.from(bytes));
}

async function ensureProgramConfig(payer: KeyPairSigner) {
  const [programConfig] = await findProgramConfigPda(r4);
  if ((await fetchMaybeProgramConfig(rpc, programConfig)).exists) return;
  const initializer = await programConfigAuthority();
  await airdrop({ recipientAddress: initializer.address, lamports: lamports(1_000_000_000n), commitment: "confirmed" });
  const ix = await getProgramConfigInitInstructionAsync(
    // The initializer is also the authority, so every test file can sign config changes.
    { initializer, authority: initializer.address, multisigCreationFee: 0, treasury: payer.address },
    r4,
  );
  await send(payer, [ix]);
}

async function createV4Multisig(
  payer: KeyPairSigner,
  options: { createKey: KeyPairSigner; members: MemberArgs[]; threshold: number; configAuthority?: Address },
): Promise<Address> {
  const [multisig] = await findMultisigPda({ createKey: options.createKey.address }, v4);
  const [programConfig] = await findProgramConfigPda(v4);
  const { data } = await fetchProgramConfigChecked(rpc, programConfig, v4);
  await send(payer, [
    await getMultisigCreateV2InstructionAsync(
      {
        treasury: data.treasury,
        createKey: options.createKey,
        creator: payer,
        configAuthority: options.configAuthority ?? null,
        threshold: options.threshold,
        members: options.members,
        timeLock: 0,
        rentCollector: null,
        memo: null,
      },
      v4,
    ),
  ]);
  return multisig;
}

/** Creates and approves a v4 vault transaction for vault 0; returns its execute instruction. */
async function v4VaultTransaction(multisig: Address, inner: Instruction[], member: KeyPairSigner): Promise<Instruction> {
  const [vault] = await findVaultPda({ multisig, index: 0 }, v4);
  const transactionIndex = (await fetchMultisigChecked(rpc, multisig, v4)).data.transactionIndex + 1n;
  const [transaction] = await findTransactionPda({ multisig, index: transactionIndex }, v4);
  const [proposal] = await findProposalPda({ multisig, transactionIndex }, v4);
  await send(member, [
    getVaultTransactionCreateInstruction(
      {
        multisig,
        transaction,
        creator: member,
        rentPayer: member,
        vaultIndex: 0,
        ephemeralSigners: 0,
        transactionMessage: getTransactionMessageBytes({ vault, instructions: inner }),
        memo: null,
      },
      v4,
    ),
  ]);
  await send(member, [
    getProposalCreateInstruction({ multisig, proposal, creator: member, rentPayer: member, transactionIndex, draft: false }, v4),
    getProposalApproveInstruction({ multisig, member, proposal, memo: null }, v4),
  ]);
  const { data } = await fetchVaultTransactionChecked(rpc, transaction, v4);
  return getVaultTransactionExecuteInstructionWithAccounts(
    { multisig, proposal, transaction, member, message: data.message, vaultIndex: 0 },
    v4,
  );
}

/** Creates and approves a v4 batch (one vote); returns the execute instruction of each item. */
async function v4Batch(multisig: Address, items: Instruction[][], member: KeyPairSigner): Promise<Instruction[]> {
  const [vault] = await findVaultPda({ multisig, index: 0 }, v4);
  const batchIndex = (await fetchMultisigChecked(rpc, multisig, v4)).data.transactionIndex + 1n;
  const [batch] = await findTransactionPda({ multisig, index: batchIndex }, v4);
  const [proposal] = await findProposalPda({ multisig, transactionIndex: batchIndex }, v4);
  const itemPda = async (i: number) =>
    (await findBatchTransactionPda({ multisig, batchIndex, transactionIndex: i + 1 }, v4))[0];
  await send(member, [
    getBatchCreateInstruction({ multisig, batch, creator: member, rentPayer: member, vaultIndex: 0, memo: null }, v4),
    getProposalCreateInstruction(
      { multisig, proposal, creator: member, rentPayer: member, transactionIndex: batchIndex, draft: true },
      v4,
    ),
  ]);
  for (const [i, inner] of items.entries()) {
    await send(member, [
      getBatchAddTransactionInstruction(
        {
          multisig,
          proposal,
          batch,
          transaction: await itemPda(i),
          member,
          rentPayer: member,
          ephemeralSigners: 0,
          transactionMessage: getTransactionMessageBytes({ vault, instructions: inner }),
        },
        v4,
      ),
    ]);
  }
  await send(member, [
    getProposalActivateInstruction({ multisig, member, proposal }, v4),
    getProposalApproveInstruction({ multisig, member, proposal, memo: null }, v4),
  ]);
  return Promise.all(
    items.map(async (_, i) => {
      const transaction = await itemPda(i);
      const { data } = await fetchVaultBatchTransactionChecked(rpc, transaction, v4);
      const execute = getBatchExecuteTransactionInstruction({ multisig, member, proposal, batch, transaction }, v4);
      const remaining = await getAccountsForExecute({
        message: data.message,
        multisig,
        vaultIndex: 0,
        transaction,
        programAddress: LEGACY_V4_PROGRAM_ADDRESS,
      });
      return { ...execute, accounts: [...execute.accounts, ...remaining] };
    }),
  );
}

async function sourceVaultOf(source: Address) {
  return createNoopSigner((await findVaultPda({ multisig: source, index: 0 }, v4))[0]);
}

async function successorOf(source: Address) {
  const [multisig] = await findSuccessorPda({ sourceMultisig: source }, r4);
  const [vault] = await findVaultPda({ multisig, index: 0 }, r4);
  return { multisig, vault };
}

/** `multisigCreateFrom`; `maxCreationFee` defaults to the current fee. */
async function createFromInstruction(source: Address, maxCreationFee?: bigint): Promise<Instruction> {
  const [programConfig] = await findProgramConfigPda(r4);
  const { data } = await fetchProgramConfigChecked(rpc, programConfig, r4);
  return withEvents(
    await getMultisigCreateFromInstructionAsync(
      {
        treasury: data.treasury,
        sourceMultisig: source,
        sourceVault: await sourceVaultOf(source),
        vaultIndex: 0,
        configAuthorityVaultIndex: null,
        rentCollectorVaultIndex: null,
        maxCreationFee: maxCreationFee ?? data.multisigCreationFee,
        memo: "migrate",
      },
      r4,
    ),
  );
}

const migrationSource = (sourceMultisig: Address): MigrationSource => ({ sourceMultisig, programAddress: TEST_PROGRAM });

/** A new mint (`payer` holds both authorities) and `owner`'s associated token account. */
async function mintTokens(payer: KeyPairSigner, owner: Address, amount: bigint, tokenProgram: Address) {
  const mint = await generateKeyPairSigner();
  const config = { programAddress: tokenProgram };
  const account = await findAssociatedTokenAddress(owner, mint.address, tokenProgram);
  await send(payer, [
    getCreateAccountInstruction({
      payer,
      newAccount: mint,
      lamports: await rpc.getMinimumBalanceForRentExemption(82n).send(),
      space: 82,
      programAddress: tokenProgram,
    }),
    getInitializeMint2Instruction(
      { mint: mint.address, decimals: 6, mintAuthority: payer.address, freezeAuthority: payer.address },
      config,
    ),
    await getCreateAssociatedTokenIdempotentInstructionAsync({ payer, owner, mint: mint.address, tokenProgram }),
    ...(amount > 0n ? [getMintToInstruction({ mint: mint.address, token: account, mintAuthority: payer, amount }, config)] : []),
  ]);
  return { mint: mint.address, account };
}

/** An initialized stake account with `authority` as staker and withdrawer (stake `Initialize`). */
async function createStake(
  payer: KeyPairSigner,
  authority: Address,
  lockupEpoch: bigint,
  custodian: Address = payer.address,
): Promise<Address> {
  const stake = await generateKeyPairSigner();
  const lockup = new Uint8Array(16);
  new DataView(lockup.buffer).setBigUint64(8, lockupEpoch, true);
  await send(payer, [
    getCreateAccountInstruction({
      payer,
      newAccount: stake,
      lamports: (await rpc.getMinimumBalanceForRentExemption(200n).send()) + 1_000_000_000n,
      space: 200,
      programAddress: STAKE_PROGRAM_ADDRESS,
    }),
    {
      programAddress: STAKE_PROGRAM_ADDRESS,
      accounts: [
        { address: stake.address, role: AccountRole.WRITABLE },
        { address: RENT_SYSVAR, role: AccountRole.READONLY },
      ],
      data: Uint8Array.from([
        ...[0, 0, 0, 0],
        ...addressEncoder.encode(authority),
        ...addressEncoder.encode(authority),
        ...lockup,
        ...addressEncoder.encode(custodian),
      ]),
    },
  ]);
  return stake.address;
}

// Token-2022 extension instructions, built from spl-token-2022-interface 3.1 (tag, sub-tag, data).
const T22 = TOKEN_2022_PROGRAM_ADDRESS;
const ACCOUNT_STATE_FROZEN = 2;
const t22 = (accounts: Instruction["accounts"], data: number[]): Instruction => ({
  programAddress: T22,
  accounts,
  data: Uint8Array.from(data),
});
const writable = (address: Address) => ({ address, role: AccountRole.WRITABLE });
const readonly = (address: Address) => ({ address, role: AccountRole.READONLY });
const signer = (signer: KeyPairSigner) => ({ address: signer.address, role: AccountRole.READONLY_SIGNER, signer });
const key = (address: Address) => [...addressEncoder.encode(address)];

/** A Token-2022 mint (`payer` holds the authorities) with `extensions` set before `InitializeMint2`. */
async function token2022Mint(payer: KeyPairSigner, space: number, extensions: (mint: Address) => Instruction[]) {
  const mint = await generateKeyPairSigner();
  await send(payer, [
    getCreateAccountInstruction({
      payer,
      newAccount: mint,
      lamports: await rpc.getMinimumBalanceForRentExemption(BigInt(space)).send(),
      space,
      programAddress: T22,
    }),
    ...extensions(mint.address),
    getInitializeMint2Instruction(
      { mint: mint.address, decimals: 6, mintAuthority: payer.address, freezeAuthority: payer.address },
      { programAddress: T22 },
    ),
  ]);
  return mint.address;
}

/** `owner`'s associated token account of a Token-2022 `mint`, with `amount` tokens. */
async function token2022Account(payer: KeyPairSigner, owner: Address, mint: Address, amount: bigint, thaw = false) {
  const account = await findAssociatedTokenAddress(owner, mint, T22);
  await send(payer, [
    await getCreateAssociatedTokenIdempotentInstructionAsync({ payer, owner, mint, tokenProgram: T22 }),
    ...(thaw ? [t22([writable(account), readonly(mint), signer(payer)], [11])] : []),
    ...(amount > 0n ? [getMintToInstruction({ mint, token: account, mintAuthority: payer, amount }, { programAddress: T22 })] : []),
  ]);
  return account;
}

/** A vote account with `withdrawer` as withdrawer (vote `InitializeAccount`, bincode tag 0). */
async function createVoteAccount(payer: KeyPairSigner, withdrawer: Address): Promise<Address> {
  const vote = await generateKeyPairSigner();
  const node = await generateKeyPairSigner();
  const space = 3762;
  await send(payer, [
    getCreateAccountInstruction({
      payer,
      newAccount: vote,
      lamports: await rpc.getMinimumBalanceForRentExemption(BigInt(space)).send(),
      space,
      programAddress: VOTE_PROGRAM_ADDRESS,
    }),
    {
      programAddress: VOTE_PROGRAM_ADDRESS,
      accounts: [
        writable(vote.address),
        readonly(RENT_SYSVAR),
        readonly(CLOCK_SYSVAR),
        signer(node),
      ],
      data: Uint8Array.from([0, 0, 0, 0, ...key(node.address), ...key(node.address), ...key(withdrawer), 0]),
    },
  ]);
  return vote.address;
}

/** A token account of `owner` at a new address (not the associated one): `InitializeAccount3`. */
async function plainTokenAccount(payer: KeyPairSigner, owner: Address, mint: Address, tokenProgram: Address) {
  const account = await generateKeyPairSigner();
  await send(payer, [
    getCreateAccountInstruction({
      payer,
      newAccount: account,
      lamports: await rpc.getMinimumBalanceForRentExemption(165n).send(),
      space: 165,
      programAddress: tokenProgram,
    }),
    { programAddress: tokenProgram, accounts: [writable(account.address), readonly(mint)], data: Uint8Array.from([18, ...key(owner)]) },
  ]);
  return account.address;
}

/** The token metadata `Initialize` instruction (spl-token-metadata-interface): name, symbol, uri. */
function initializeTokenMetadata(mint: Address, updateAuthority: Address, mintAuthority: KeyPairSigner): Instruction {
  const text = (value: string) => {
    const bytes = new TextEncoder().encode(value);
    return [bytes.length, 0, 0, 0, ...bytes];
  };
  const discriminator = createHash("sha256").update("spl_token_metadata_interface:initialize_account").digest().subarray(0, 8);
  return t22([writable(mint), readonly(updateAuthority), readonly(mint), signer(mintAuthority)], [
    ...discriminator,
    ...text("Vault"),
    ...text("VLT"),
    ...text(""),
  ]);
}

async function waitForSlotAfter(slot: bigint) {
  while ((await rpc.getSlot({ commitment: "confirmed" }).send()) <= slot) await new Promise((resolve) => setTimeout(resolve, 100));
}

const moved = (amount: bigint, closed = false) => ({ __kind: "Moved", amount, closed });
const skipped = (reason: MigrationSkipReason) => ({ __kind: "Skipped", reason });
const kind = {
  sol: { __kind: "Sol" },
  token: { __kind: "Token" },
  authority: (authority: TokenAuthorityKind): MigrationAssetKind => ({ __kind: "TokenAuthority", authority }),
  staker: { __kind: "StakeStaker" },
  withdrawer: { __kind: "StakeWithdrawer" },
  custodian: { __kind: "StakeCustodian" },
  voteWithdrawer: { __kind: "VoteWithdrawer" },
  upgrade: { __kind: "UpgradeAuthority" },
} as const;

/** Sends each execute instruction in order and returns its `Migration` event. */
async function executeAll(payer: KeyPairSigner, executes: Instruction[], tables: AddressLookupTables = {}) {
  const events: MigrationEvent[] = [];
  for (const execute of executes) events.push(await migrationEvent(await send(payer, [computeLimit, execute], tables)));
  return events;
}

/** A v4 multisig (one member, threshold 1) with a funded vault 0 and its successor. */
async function v4WithSuccessor(member: KeyPairSigner, sol: bigint) {
  const source = await createV4Multisig(member, {
    createKey: await generateKeyPairSigner(),
    members: [{ key: member.address, permissions: ALL_PERMISSIONS }],
    threshold: 1,
  });
  const sourceVault = (await sourceVaultOf(source)).address;
  await airdrop({ recipientAddress: sourceVault, lamports: lamports(sol), commitment: "confirmed" });
  await send(member, [computeLimit, await v4VaultTransaction(source, [await createFromInstruction(source)], member)]);
  return { source, sourceVault, ...(await successorOf(source)) };
}

describe("v4 to 4r migration on a local validator", () => {
  let payer: KeyPairSigner;

  beforeAll(async () => {
    payer = await fundedSigner(100n);
    await ensureProgramConfig(payer);
  });

  it("creates the successor and moves every asset class through one v4 batch, one class in each entry", async () => {
    // Arrange: the fixed v4 multisig, whose vault 0 is the validator's preloaded upgrade authority.
    const bytes = JSON.parse(readFileSync(join(__dirname, "fixtures", "migration-create-key.json"), "utf8"));
    const createKey = await createKeyPairSignerFromBytes(Uint8Array.from(bytes));
    const voter = await fundedSigner(1n);
    const members = [
      { key: payer.address, permissions: ALL_PERMISSIONS },
      { key: voter.address, permissions: { mask: 2 } },
    ];
    const source = await createV4Multisig(payer, { createKey, members, threshold: 1 });
    const sourceVault = (await sourceVaultOf(source)).address;
    expect(sourceVault).toBe(FIXED_V4_VAULT);
    const { multisig: successor, vault } = await successorOf(source);
    const from = migrationSource(source);

    await airdrop({ recipientAddress: sourceVault, lamports: lamports(5_000_000_000n), commitment: "confirmed" });
    const tokenA = await mintTokens(payer, sourceVault, 100n, TOKEN_PROGRAM_ADDRESS);
    const tokenB = await mintTokens(payer, sourceVault, 50n, TOKEN_2022_PROGRAM_ADDRESS);
    const frozen = await mintTokens(payer, sourceVault, 10n, TOKEN_PROGRAM_ADDRESS);
    const empty = await mintTokens(payer, sourceVault, 0n, TOKEN_PROGRAM_ADDRESS);
    await send(payer, [
      getFreezeAccountInstruction({ account: frozen.account, mint: frozen.mint, owner: payer }),
      getSetAuthorityInstruction({
        owned: tokenA.mint,
        owner: payer,
        authorityType: AuthorityType.MintTokens,
        newAuthority: some(sourceVault),
      }),
    ]);
    const stake = await createStake(payer, sourceVault, 0n);
    const lockedStake = await createStake(payer, sourceVault, 1_000_000n);
    const custodianStake = await createStake(payer, sourceVault, 0n, sourceVault);
    const lockedCustodianStake = await createStake(payer, sourceVault, 1_000_000n, sourceVault);
    const voteAccount = await createVoteAccount(payer, sourceVault);
    const [programData] = await getProgramDerivedAddress({
      programAddress: BPF_LOADER_UPGRADEABLE_ADDRESS,
      seeds: [addressEncoder.encode(UPGRADEABLE_PROGRAM)],
    });
    const tokenItem = (held: { mint: Address; account: Address }) => ({ sourceTokenAccount: held.account, mint: held.mint });

    // Act: one v4 vault transaction creates the successor, then one v4 batch (one vote) migrates.
    const create = await send(payer, [computeLimit, await v4VaultTransaction(source, [await createFromInstruction(source)], payer)]);
    const entries = await Promise.all([
      getMigrateTokensInstruction(from, {
        tokenProgram: TOKEN_PROGRAM_ADDRESS,
        closeSource: true,
        items: [tokenItem(tokenA), tokenItem(frozen), tokenItem(empty)],
      }),
      getMigrateTokensInstruction(from, { tokenProgram: TOKEN_2022_PROGRAM_ADDRESS, closeSource: true, items: [tokenItem(tokenB)] }),
      getMigrateTokenAuthoritiesInstruction(from, {
        tokenProgram: TOKEN_PROGRAM_ADDRESS,
        items: [
          { account: tokenA.mint, kind: TokenAuthorityKind.MintTokens },
          { account: frozen.mint, kind: TokenAuthorityKind.FreezeAccount },
        ],
      }),
      getMigrateStakesInstruction(from, [stake, lockedStake, custodianStake, lockedCustodianStake]),
      getMigrateVoteAccountsInstruction(from, [voteAccount]),
      getMigrateProgramsInstruction(from, [programData]),
      getMigrateSolInstruction(from),
    ]);
    const events = await executeAll(payer, await v4Batch(source, entries.map((entry) => [withEvents(entry)]), payer));

    // Assert: the successor mirrors the v4 config.
    const { data: v4Config } = await fetchMultisigChecked(rpc, source, v4);
    const { data: config } = await fetchMultisigChecked(rpc, successor, r4);
    expect(config.createKey).toBe(source);
    expect(config.members).toEqual(v4Config.members);
    expect([config.threshold, config.timeLock, config.transactionIndex]).toEqual([v4Config.threshold, v4Config.timeLock, 0n]);
    expect(await eventsOf(create)).toMatchObject([
      { __kind: "MultisigCreate", multisig: successor, createKey: source, creator: sourceVault },
    ]);

    // Assert: one scope for each entry, and the outcome of each asset.
    expect(events.map((event) => event.scope)).toEqual([
      MigrationScope.Tokens,
      MigrationScope.Tokens,
      MigrationScope.TokenAuthorities,
      MigrationScope.Stakes,
      MigrationScope.VoteAccounts,
      MigrationScope.Programs,
      MigrationScope.Sol,
    ]);
    const [tokens, tokens2022, authorities, stakes, votes, programs, sol] = events.map((event) => event.outcomes);
    expect(tokens).toEqual([
      { kind: kind.token, account: tokenA.account, result: moved(100n, true) },
      { kind: kind.token, account: frozen.account, result: skipped(MigrationSkipReason.Frozen) },
      { kind: kind.token, account: empty.account, result: moved(0n, true) },
    ]);
    expect(tokens2022).toEqual([{ kind: kind.token, account: tokenB.account, result: moved(50n, true) }]);
    expect(authorities).toEqual([
      { kind: kind.authority(TokenAuthorityKind.MintTokens), account: tokenA.mint, result: moved(0n) },
      { kind: kind.authority(TokenAuthorityKind.FreezeAccount), account: frozen.mint, result: skipped(MigrationSkipReason.NotAuthority) },
    ]);
    // The custodian moves when the vault holds it: as the withdrawer without a lockup in force
    // (before the withdrawer moves), else as the custodian (after the withdrawer moves).
    const stakeOutcomes = (account: Address, withdrawer: ReturnType<typeof moved | typeof skipped>, custodian: ReturnType<typeof moved | typeof skipped>) => [
      { kind: kind.staker, account, result: moved(0n) },
      { kind: kind.withdrawer, account, result: withdrawer },
      { kind: kind.custodian, account, result: custodian },
    ];
    const notAuthority = skipped(MigrationSkipReason.NotAuthority);
    expect(stakes).toEqual([
      ...stakeOutcomes(stake, moved(0n), notAuthority),
      ...stakeOutcomes(lockedStake, skipped(MigrationSkipReason.Locked), notAuthority),
      ...stakeOutcomes(custodianStake, moved(0n), moved(0n)),
      ...stakeOutcomes(lockedCustodianStake, moved(0n), moved(0n)),
    ]);
    expect(votes).toEqual([{ kind: kind.voteWithdrawer, account: voteAccount, result: moved(0n) }]);
    expect(programs).toEqual([{ kind: kind.upgrade, account: programData, result: moved(0n) }]);
    expect(sol).toMatchObject([{ kind: kind.sol, account: sourceVault, result: { __kind: "Moved" } }]);

    // Assert: the chain state.
    expect(await tokenBalance(await findAssociatedTokenAddress(vault, tokenA.mint, TOKEN_PROGRAM_ADDRESS))).toBe(100n);
    expect(await tokenBalance(await findAssociatedTokenAddress(vault, tokenB.mint, TOKEN_2022_PROGRAM_ADDRESS))).toBe(50n);
    expect(await Promise.all([tokenA.account, tokenB.account, empty.account].map(accountData))).toEqual([null, null, null]);
    expect(await tokenBalance(frozen.account)).toBe(10n);
    expect((await fetchMint(rpc, tokenA.mint)).data.mintAuthority).toEqual(some(vault));
    expect((await fetchMint(rpc, frozen.mint)).data.freezeAuthority).toEqual(some(payer.address));
    const programDataBytes = (await accountData(programData))!;
    expect([programDataBytes[12], addressAt(programDataBytes, 13)]).toEqual([1, vault]);
    const stakeBytes = (await accountData(stake))!;
    const lockedBytes = (await accountData(lockedStake))!;
    expect([addressAt(stakeBytes, 12), addressAt(stakeBytes, 44)]).toEqual([vault, vault]);
    expect([addressAt(lockedBytes, 12), addressAt(lockedBytes, 44)]).toEqual([vault, sourceVault]);
    for (const custodied of [custodianStake, lockedCustodianStake]) {
      const bytes = (await accountData(custodied))!;
      expect([addressAt(bytes, 12), addressAt(bytes, 44), addressAt(bytes, 92)]).toEqual([vault, vault, vault]);
    }
    expect(addressAt((await accountData(voteAccount))!, 36)).toBe(vault);
    const { value: sourceLamports } = await rpc.getBalance(sourceVault, { commitment: "confirmed" }).send();
    expect(sourceLamports).toBe(0n);
  });

  it("skips Token-2022 tokens that cannot move through a CPI", async () => {
    // Arrange: a v4 multisig with its successor, and five Token-2022 accounts of its vault.
    const member = await fundedSigner(20n);
    const { source, sourceVault: vault } = await v4WithSuccessor(member, 2_000_000_000n);
    const hook = await token2022Mint(member, 234, (mint) => [t22([writable(mint)], [36, 0, ...new Array(32).fill(0), ...key(UPGRADEABLE_PROGRAM)])]);
    const soulbound = await token2022Mint(member, 170, (mint) => [t22([writable(mint)], [32])]);
    const paused = await token2022Mint(member, 203, (mint) => [t22([writable(mint)], [44, 0, ...key(member.address)])]);
    const defaultFrozen = await token2022Mint(member, 171, (mint) => [t22([writable(mint)], [28, 0, ACCOUNT_STATE_FROZEN])]);
    const closable = await token2022Mint(member, 202, (mint) => [t22([writable(mint)], [25, 1, ...key(member.address)])]);
    const accounts = {
      hook: await token2022Account(member, vault, hook, 5n),
      soulbound: await token2022Account(member, vault, soulbound, 5n),
      paused: await token2022Account(member, vault, paused, 5n),
      defaultFrozen: await token2022Account(member, vault, defaultFrozen, 5n, true),
      closable: await token2022Account(member, vault, closable, 0n),
    };
    await send(member, [
      t22([writable(paused), signer(member)], [44, 1]),
      t22([writable(closable), writable(member.address), signer(member)], [9]),
    ]);
    const tokens = (closeSource: boolean, items: [Address, Address][]) =>
      getMigrateTokensInstruction(migrationSource(source), {
        tokenProgram: T22,
        closeSource,
        items: items.map(([sourceTokenAccount, mint]) => ({ sourceTokenAccount, mint })),
      });

    // Act
    const entries = [
      await tokens(false, [
        [accounts.hook, hook],
        [accounts.soulbound, soulbound],
        [accounts.paused, paused],
        [accounts.defaultFrozen, defaultFrozen],
      ]),
      await tokens(true, [[accounts.closable, closable]]),
    ];
    const [first, second] = await executeAll(member, await v4Batch(source, entries.map((entry) => [withEvents(entry)]), member));

    // Assert
    const outcome = (account: Address, reason: MigrationSkipReason) => ({ kind: kind.token, account, result: skipped(reason) });
    expect(first?.outcomes).toEqual([
      outcome(accounts.hook, MigrationSkipReason.Unsupported),
      outcome(accounts.soulbound, MigrationSkipReason.Unsupported),
      outcome(accounts.paused, MigrationSkipReason.Unsupported),
      outcome(accounts.defaultFrozen, MigrationSkipReason.Frozen),
    ]);
    expect(second?.outcomes).toEqual([outcome(accounts.closable, MigrationSkipReason.Missing)]);
    expect(await tokenBalance(accounts.defaultFrozen)).toBe(5n);
  });

  it("moves Token-2022 extension and metadata authorities and token account owners", async () => {
    // Arrange: a mint whose close, permanent delegate, metadata pointer and metadata update
    // authorities are the v4 vault (the mint and freeze authorities are not), and two accounts.
    const member = await fundedSigner(20n);
    const { source, sourceVault, vault } = await v4WithSuccessor(member, 2_000_000_000n);
    const mint = await generateKeyPairSigner();
    await send(member, [
      getCreateAccountInstruction({
        payer: member,
        newAccount: mint,
        lamports: await rpc.getMinimumBalanceForRentExemption(600n).send(),
        space: 306,
        programAddress: T22,
      }),
      t22([writable(mint.address)], [25, 1, ...key(sourceVault)]),
      t22([writable(mint.address)], [35, ...key(sourceVault)]),
      t22([writable(mint.address)], [39, 0, ...key(sourceVault), ...key(mint.address)]),
      getInitializeMint2Instruction(
        { mint: mint.address, decimals: 6, mintAuthority: member.address, freezeAuthority: member.address },
        { programAddress: T22 },
      ),
      initializeTokenMetadata(mint.address, sourceVault, member),
    ]);
    const plain = await plainTokenAccount(member, sourceVault, mint.address, T22);
    const associated = await token2022Account(member, sourceVault, mint.address, 0n);

    // Act: the inventory finds the mint only through `extraMints`; one entry moves every authority.
    const inventory = await getV4VaultInventory(rpc, {
      sourceMultisig: source,
      scans: { stakes: false, voteAccounts: false, programs: false },
      extraMints: [mint.address],
    });
    const items = [
      ...(inventory.mints[0]?.authorities ?? []).map((authority) => ({ account: mint.address, kind: authority })),
      { account: mint.address, kind: TokenAuthorityKind.MintTokens },
      { account: mint.address, kind: TokenAuthorityKind.Pause },
      { account: plain, kind: TokenAuthorityKind.AccountOwner },
      { account: associated, kind: TokenAuthorityKind.AccountOwner },
    ];
    const entry = await getMigrateTokenAuthoritiesInstruction(migrationSource(source), { tokenProgram: T22, items });
    const [event] = await executeAll(member, await v4Batch(source, [[withEvents(entry)]], member));

    // Assert
    expect(inventory.mints).toEqual([
      {
        mint: mint.address,
        tokenProgram: T22,
        authorities: [
          TokenAuthorityKind.CloseMint,
          TokenAuthorityKind.PermanentDelegate,
          TokenAuthorityKind.MetadataPointer,
          TokenAuthorityKind.MetadataUpdate,
        ],
      },
    ]);
    expect(event?.outcomes.map((outcome) => outcome.result)).toEqual([
      moved(0n),
      moved(0n),
      moved(0n),
      moved(0n),
      skipped(MigrationSkipReason.NotAuthority),
      skipped(MigrationSkipReason.Missing),
      moved(0n),
      skipped(MigrationSkipReason.Unsupported),
    ]);
    expect(parseMintAuthorities((await accountData(mint.address))!, vault)).toEqual(inventory.mints[0]?.authorities);
    expect(addressAt((await accountData(plain))!, 32)).toBe(vault);
    expect(addressAt((await accountData(associated))!, 32)).toBe(sourceVault);
  });

  it("plans, proposes and executes a whole vault, in fewer items with lookup tables", async () => {
    // Arrange: a v4 vault with 12 token accounts, a mint authority, a stake, a vote account and SOL;
    // on two accounts of a member, it is the close authority and the delegate.
    const member = await fundedSigner(30n);
    const source = await createV4Multisig(member, {
      createKey: await generateKeyPairSigner(),
      members: [{ key: member.address, permissions: ALL_PERMISSIONS }],
      threshold: 1,
    });
    const sourceVault = (await sourceVaultOf(source)).address;
    await airdrop({ recipientAddress: sourceVault, lamports: lamports(4_000_000_000n), commitment: "confirmed" });
    const held = [];
    for (let i = 0; i < 12; i++) held.push(await mintTokens(member, sourceVault, BigInt(i + 1), TOKEN_PROGRAM_ADDRESS));
    await send(member, [
      getSetAuthorityInstruction({
        owned: held[0]!.mint,
        owner: member,
        authorityType: AuthorityType.MintTokens,
        newAuthority: some(sourceVault),
      }),
    ]);
    const closeable = await mintTokens(member, member.address, 5n, TOKEN_PROGRAM_ADDRESS);
    const delegated = await mintTokens(member, member.address, 5n, TOKEN_PROGRAM_ADDRESS);
    await send(member, [
      getSetAuthorityInstruction({
        owned: closeable.account,
        owner: member,
        authorityType: AuthorityType.CloseAccount,
        newAuthority: some(sourceVault),
      }),
      getApproveInstruction({ source: delegated.account, delegate: sourceVault, owner: member, amount: 3n }),
    ]);
    const stake = await createStake(member, sourceVault, 0n);
    const voteAccount = await createVoteAccount(member, sourceVault);

    // Act: plan, put the item accounts in lookup tables, plan again with them, propose, execute.
    const plan = await planV4Migration(rpc, { sourceMultisig: source, programAddress: TEST_PROGRAM });
    const recentSlot = await rpc.getSlot({ commitment: "finalized" }).send();
    const created = await getCreateLookupTablesTransactions({
      addresses: getMigrationLookupTableAddresses(plan),
      authority: member,
      payer: member,
      recentSlot,
    });
    for (const transaction of created.transactions) await send(member, transaction);
    await waitForSlotAfter(await rpc.getSlot({ commitment: "confirmed" }).send());
    const tabled = await withMigrationLookupTables(plan, created.tables);
    const proposal = await getV4MigrationProposal(rpc, tabled, { member });
    for (const transaction of proposal.transactions) await send(member, [computeLimit, ...transaction]);
    await send(member, [
      computeLimit,
      await getV4VaultTransactionExecuteInstruction(rpc, { sourceMultisig: source, transactionIndex: proposal.createIndex!, member }),
    ]);
    const executes = await getV4BatchExecuteInstructions(rpc, {
      sourceMultisig: source,
      batchIndex: proposal.batchIndex!,
      member,
      addressLookupTables: created.tables,
    });
    const events = await executeAll(member, executes, created.tables);
    await send(
      member,
      Object.keys(created.tables).map((table) => getDeactivateLookupTableInstruction({ table: table as Address, authority: member })),
    );
    const after = await planV4Migration(rpc, { sourceMultisig: source, programAddress: TEST_PROGRAM });

    // Assert: the plan found everything; with the tables, the tokens need one item fewer.
    const delegateNote =
      `the vault is the delegate of token account ${delegated.account} (owner ${member.address}) for 3 tokens; ` +
      "this role cannot move, only the owner can change it";
    expect(plan.warnings).toEqual([delegateNote]);
    expect(plan.inventory.tokens).toHaveLength(12);
    const tokenRole = { tokenProgram: TOKEN_PROGRAM_ADDRESS, owner: member.address, frozen: false };
    expect(plan.inventory.tokenRoles).toHaveLength(2);
    expect(plan.inventory.tokenRoles).toEqual(
      expect.arrayContaining([
        { ...tokenRole, account: closeable.account, mint: closeable.mint, closeAuthority: true, delegatedAmount: null },
        { ...tokenRole, account: delegated.account, mint: delegated.mint, closeAuthority: false, delegatedAmount: 3n },
      ]),
    );
    expect(plan.inventory.stakes).toEqual([{ stake, staker: true, withdrawer: true, custodian: false }]);
    expect(plan.inventory.voteAccounts).toEqual([voteAccount]);
    expect(plan.inventory.mints).toEqual([
      { mint: held[0]!.mint, tokenProgram: TOKEN_PROGRAM_ADDRESS, authorities: [TokenAuthorityKind.MintTokens] },
    ]);
    const shape = (items: readonly MigrationItem[]) => items.map((item) => [item.group.class, "items" in item.group ? item.group.items.length : 1]);
    expect(shape(plan.items)).toEqual([
      ["tokens", 5],
      ["tokens", 5],
      ["tokens", 2],
      ["tokenAuthorities", 2],
      ["stakes", 1],
      ["voteAccounts", 1],
      ["sol", 1],
    ]);
    expect(shape(tabled.items)).toEqual([
      ["tokens", 6],
      ["tokens", 6],
      ["tokenAuthorities", 2],
      ["stakes", 1],
      ["voteAccounts", 1],
      ["sol", 1],
    ]);
    expect(events.map((event) => event.scope)).toEqual([
      MigrationScope.Tokens,
      MigrationScope.Tokens,
      MigrationScope.TokenAuthorities,
      MigrationScope.Stakes,
      MigrationScope.VoteAccounts,
      MigrationScope.Sol,
    ]);
    // Assert: everything moved, and a new plan has nothing left to do.
    const { vault } = await successorOf(source);
    for (const [i, h] of held.entries()) {
      expect(await tokenBalance(await findAssociatedTokenAddress(vault, h.mint, TOKEN_PROGRAM_ADDRESS))).toBe(BigInt(i + 1));
    }
    expect((await fetchMint(rpc, held[0]!.mint)).data.mintAuthority).toEqual(some(vault));
    expect(addressAt((await accountData(voteAccount))!, 36)).toBe(vault);
    expect(addressAt((await accountData(closeable.account))!, 133)).toBe(vault);
    expect(addressAt((await accountData(delegated.account))!, 76)).toBe(sourceVault);
    expect(after.warnings).toEqual([delegateNote]);
    expect(after.createSuccessor).toBeNull();
    expect(after.governanceMatches).toBe(true);
    expect(after.items).toEqual([]);
  });

  describe("guards", () => {
    let member: KeyPairSigner;
    let source: Address;
    const v4Executed = async (instruction: Instruction) =>
      simulatedErrorCode(member, [computeLimit, await v4VaultTransaction(source, [instruction], member)]);

    beforeAll(async () => {
      // A controlled v4 multisig: its config authority (`member`) can change the successor alone.
      member = await fundedSigner(20n);
      source = await createV4Multisig(member, {
        createKey: await generateKeyPairSigner(),
        members: [{ key: member.address, permissions: ALL_PERMISSIONS }],
        threshold: 1,
        configAuthority: member.address,
      });
      const sourceVault = (await sourceVaultOf(source)).address;
      await airdrop({ recipientAddress: sourceVault, lamports: lamports(2_000_000_000n), commitment: "confirmed" });
    });

    it("refuses to migrate before the successor exists", async () => {
      // Act
      const code = await v4Executed(await getMigrateSolInstruction(migrationSource(source)));

      // Assert
      expect(code).toBe(ACCOUNT_NOT_INITIALIZED);
    });

    it("refuses a creation fee above max_creation_fee", async () => {
      // Arrange: the program config authority raises the fee after the members approved 999.
      const authority = await programConfigAuthority();
      const [programConfig] = await findProgramConfigPda(r4);
      const setFee = (newMultisigCreationFee: bigint) =>
        send(member, [getProgramConfigSetMultisigCreationFeeInstruction({ programConfig, authority, newMultisigCreationFee }, r4)]);
      const create = await createFromInstruction(source, 999n);
      await setFee(1_000n);

      // Act
      const code = await v4Executed(create).finally(() => setFee(0n));

      // Assert
      expect(code).toBe(MIGRATION_CREATION_FEE_TOO_HIGH);
    });

    it("lets nobody create the successor with multisig_create_v2 (safety property S1)", async () => {
      // Arrange: multisig_create_v2 reaches the successor address only with create_key = the v4
      // multisig, a v4 PDA. No key exists for it, so each attempt passes it without a signature.
      const [programConfig] = await findProgramConfigPda(r4);
      const { data: config } = await fetchProgramConfigChecked(rpc, programConfig, r4);
      const { multisig: successor } = await successorOf(source);
      const withoutSignature = (instruction: Instruction): Instruction => ({
        ...instruction,
        accounts: instruction.accounts?.map((meta) =>
          meta.address === source && isSignerRole(meta.role) ? { address: source, role: downgradeRoleToNonSigner(meta.role) } : meta,
        ),
      });
      const createV2 = (creator: TransactionSigner) =>
        getMultisigCreateV2InstructionAsync(
          {
            treasury: config.treasury,
            createKey: createNoopSigner(source),
            creator,
            configAuthority: null,
            threshold: 1,
            members: [{ key: member.address, permissions: ALL_PERMISSIONS }],
            timeLock: 0,
            rentCollector: null,
            memo: null,
          },
          r4,
        );
      const direct = withoutSignature(await createV2(member));
      const inVault = await createV2(await sourceVaultOf(source));

      // Act: (1) a direct call; (2) a v4 vault transaction that names the v4 multisig as a signer;
      // (3) a v4 vault transaction that passes it as a plain account.
      const codes = [
        await simulatedErrorCode(member, [direct]),
        await simulatedErrorCode(member, [computeLimit, withoutSignature(await v4VaultTransaction(source, [inVault], member))]),
        await v4Executed(withoutSignature(inVault)),
      ];

      // Assert: 4r refuses the missing signature, and v4 refuses to sign as anything but a vault.
      expect(direct.accounts?.map((meta) => meta.address)).toContain(successor);
      expect(codes).toEqual([ACCOUNT_NOT_SIGNER, V4_INVALID_ACCOUNT, ACCOUNT_NOT_SIGNER]);
      expect((await fetchMaybeMultisig(rpc, successor)).exists).toBe(false);
    });

    it("creates the successor once", async () => {
      // Arrange
      await send(member, [computeLimit, await v4VaultTransaction(source, [await createFromInstruction(source)], member)]);

      // Act
      const code = await v4Executed(await createFromInstruction(source));

      // Assert
      const { data } = await fetchMultisigChecked(rpc, (await successorOf(source)).multisig, r4);
      expect(data.configAuthority).toBe(member.address);
      expect(code).toBe(ACCOUNT_ALREADY_IN_USE);
    });

    it("refuses a call that v4 did not sign", async () => {
      // Arrange: the member signs as `sourceVault` directly, without a v4 vault transaction.
      const { accounts, args, config } = await getMigrationAccounts(migrationSource(source));
      const direct = getMultisigMigrateSolInstruction({ ...accounts, ...args, sourceVault: member, keep: 0 }, config);

      // Act
      const code = await simulatedErrorCode(member, [direct]);

      // Assert
      expect(code).toBe(CONSTRAINT_SEEDS);
    });

    it("refuses a vault index that is not the signing vault", async () => {
      // Arrange: v4 signs for vault 0, but the arguments name vault 1.
      const { accounts, args, config } = await getMigrationAccounts(migrationSource(source));
      const [vault1] = await findVaultPda({ multisig: accounts.multisig, index: 1 }, r4);
      const wrongIndex = getMultisigMigrateSolInstruction({ ...accounts, ...args, vault: vault1, vaultIndex: 1, keep: 0 }, config);

      // Act
      const code = await v4Executed(wrongIndex);

      // Assert
      expect(code).toBe(CONSTRAINT_SEEDS);
    });

    it("refuses bad item accounts, a foreign token program and a keep below the rent minimum", async () => {
      // Arrange
      const from = migrationSource(source);
      const tokens = await getMigrateTokensInstruction(from, { tokenProgram: TOKEN_PROGRAM_ADDRESS, closeSource: false, items: [] });
      const partialItem = { ...tokens, accounts: [...tokens.accounts!, writable((await generateKeyPairSigner()).address)] };
      const { accounts, args, config } = await getMigrationAccounts(from);
      const kindsWithoutAccounts = getMultisigMigrateTokenAuthoritiesInstruction(
        { ...accounts, ...args, tokenProgram: TOKEN_PROGRAM_ADDRESS, items: [TokenAuthorityKind.MintTokens] },
        config,
      );
      const foreignProgram = await getMigrateTokensInstruction(from, { tokenProgram: STAKE_PROGRAM_ADDRESS, closeSource: false, items: [] });
      const keepTooLittle = await getMigrateSolInstruction(from, 1n);

      // Act
      const codes = [];
      for (const instruction of [partialItem, kindsWithoutAccounts, foreignProgram, keepTooLittle]) {
        codes.push(await v4Executed(instruction));
      }

      // Assert
      expect(codes).toEqual([
        MIGRATION_INVALID_ASSET_ACCOUNTS,
        MIGRATION_INVALID_ASSET_ACCOUNTS,
        INVALID_PROGRAM_ID,
        MIGRATION_INVALID_AMOUNT,
      ]);
    });

    it("stops every class when the successor governance drifts from v4", async () => {
      // Arrange: the config authority adds a member to the successor only.
      const { multisig } = await successorOf(source);
      await send(member, [
        getMultisigAddMemberInstruction(
          {
            multisig,
            configAuthority: member,
            rentPayer: member,
            systemProgram: SYSTEM_PROGRAM,
            newMember: { key: (await generateKeyPairSigner()).address, permissions: { mask: 2 } },
            memo: null,
          },
          r4,
        ),
      ]);
      const from = migrationSource(source);

      // Act
      const codes = [];
      for (const instruction of [
        await getMigrateSolInstruction(from),
        await getMigrateTokensInstruction(from, { tokenProgram: TOKEN_PROGRAM_ADDRESS, closeSource: false, items: [] }),
        await getMigrateStakesInstruction(from, []),
        await getMigrateProgramsInstruction(from, []),
      ]) {
        codes.push(await v4Executed(instruction));
      }

      // Assert
      expect(codes).toEqual(new Array(4).fill(MIGRATION_GOVERNANCE_MISMATCH));
    });
  });
});
