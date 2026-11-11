import { readFileSync } from "node:fs";
import { join } from "node:path";

import { getSetComputeUnitLimitInstruction } from "@solana-program/compute-budget";
import { getCreateAccountInstruction, getTransferSolInstruction } from "@solana-program/system";
import {
  getCreateAssociatedTokenIdempotentInstructionAsync,
  getInitializeMint2Instruction,
  getMintToInstruction,
} from "@solana-program/token";
import {
  AccountRole,
  address,
  airdropFactory,
  appendTransactionMessageInstructions,
  createKeyPairSignerFromBytes,
  createNoopSigner,
  createSolanaRpc,
  createSolanaRpcSubscriptions,
  createTransactionMessage,
  downgradeRoleToNonSigner,
  generateKeyPairSigner,
  getAddressDecoder,
  getAddressEncoder,
  getBase64EncodedWireTransaction,
  getProgramDerivedAddress,
  getSignatureFromTransaction,
  isSignerRole,
  lamports,
  pipe,
  sendAndConfirmTransactionFactory,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
  type Address,
  type Instruction,
  type KeyPairSigner,
  type Signature,
  type TransactionSigner,
} from "@solana/kit";
import { beforeAll, describe, expect, it } from "vitest";

import {
  BPF_LOADER_UPGRADEABLE_ADDRESS,
  decodeV3Instruction,
  decodeV3Multisig,
  fetchMaybeMultisig,
  fetchMaybeProgramConfig,
  fetchMultisigChecked,
  fetchProgramConfigChecked,
  findAssociatedTokenAddress,
  findMultisigPda,
  findProgramConfigPda,
  findSuccessorPda,
  findV3AuthorityPda,
  findV3DelegatePda,
  findV3InstructionPda,
  findV3MultisigPda,
  findV3RolesManagerPda,
  findV3RolesUserPda,
  findV3TransactionPda,
  getMigrateSolInstruction,
  getMigrationAccounts,
  getMultisigCreateFromInstructionAsync,
  getMultisigCreateFromV3Instruction,
  getMultisigCreateV2InstructionAsync,
  getMultisigEventsFromTransaction,
  getMultisigMigrateV3SolInstruction,
  getProgramConfigInitInstructionAsync,
  getV3ActivateTransactionInstruction,
  getV3AddInstructionInstruction,
  getV3AddMemberInstruction,
  getV3ApproveTransactionInstruction,
  getV3CreateInstruction,
  getV3CreateTransactionInstruction,
  getV3ExecuteInstructions,
  getV3ExecuteTransactionInstruction,
  getV3MigrationProposal,
  LEGACY_V4_PROGRAM_ADDRESS,
  planV3Migration,
  STAKE_PROGRAM_ADDRESS,
  TOKEN_2022_PROGRAM_ADDRESS,
  TOKEN_PROGRAM_ADDRESS,
  V3_ROLES_PROGRAM_ADDRESS,
  V3DelegateMembersError,
  V3Role,
  VOTE_PROGRAM_ADDRESS,
  type MigrationEvent,
  type MultisigEvent,
  type V3MigrationSource,
} from "../../src";

// Needs the 4r testing build, the mainnet v3 and roles programs, and an upgradeable program with
// FIXED_V3_AUTHORITY as authority. Validator flags: tests/fixtures/v3-mainnet/README.md.
const TEST_PROGRAM = address("GyhGAqjokLwF9UXdQ2dR5Zwiup242j4mX4J1tSMKyAmD");
/** The v3 multisig of create key [0x33; 32], its authority 1, and a program it can upgrade. */
const FIXED_V3_CREATE_KEY = address("4Ss5JMkXAD9Z7cktFEdrqeMuT6jGMF1pVozTyPHZ6zT4");
const FIXED_V3_AUTHORITY = address("2JbpQGYRrGfgHjU8akLGq2RdK8U2hruXBVhWLLRa6exf");
const V3_UPGRADEABLE_PROGRAM = address("5bV6jUfhDHCQVA1WfKBUnXUsboJgoKgkzkKcxr3joew5");
const RENT_SYSVAR = address("SysvarRent111111111111111111111111111111111");
const CLOCK_SYSVAR = address("SysvarC1ock11111111111111111111111111111111");
const SYSTEM_PROGRAM = address("11111111111111111111111111111111");
const r4 = { programAddress: TEST_PROGRAM };
const repoRoot = join(__dirname, "..", "..", "..", "..");

// Anchor, v3 and 4r error codes.
const CONSTRAINT_SEEDS = 2006;
const ACCOUNT_NOT_SIGNER = 3010;
const ACCOUNT_NOT_INITIALIZED = 3012;
const V3_INVALID_AUTHORITY_INDEX = 6004;
const INVALID_ACCOUNT = 6014;
const MIGRATION_GOVERNANCE_MISMATCH = 6046;
const MIGRATION_INVALID_AUTHORITY_INDEX = 6051;

const rpc = createSolanaRpc(process.env.RPC_URL ?? "http://127.0.0.1:8899");
const rpcSubscriptions = createSolanaRpcSubscriptions(process.env.RPC_WS_URL ?? "ws://127.0.0.1:8900");
const sendAndConfirm = sendAndConfirmTransactionFactory({ rpc, rpcSubscriptions });
const airdrop = airdropFactory({ rpc, rpcSubscriptions });
const addressEncoder = getAddressEncoder();
const computeLimit = getSetComputeUnitLimitInstruction({ units: 1_400_000 });
const writable = (address: Address) => ({ address, role: AccountRole.WRITABLE });
const readonly = (address: Address) => ({ address, role: AccountRole.READONLY });
const signerMeta = (signer: KeyPairSigner) => ({ address: signer.address, role: AccountRole.READONLY_SIGNER, signer });
const keyBytes = (value: Address) => [...addressEncoder.encode(value)];
const addressAt = (data: Uint8Array, offset: number) => getAddressDecoder().decode(data.slice(offset, offset + 32));

async function signed(payer: KeyPairSigner, instructions: Instruction[]) {
  const { value: blockhash } = await rpc.getLatestBlockhash().send();
  const message = pipe(
    createTransactionMessage({ version: 0 }),
    (m) => setTransactionMessageFeePayerSigner(payer, m),
    (m) => setTransactionMessageLifetimeUsingBlockhash(blockhash, m),
    (m) => appendTransactionMessageInstructions(instructions, m),
  );
  return signTransactionMessageWithSigners(message);
}

async function send(payer: KeyPairSigner, instructions: Instruction[]): Promise<Signature> {
  const transaction = await signed(payer, instructions);
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

/** `instruction` with `account` as a plain account: a direct call cannot sign for a PDA. */
const withoutSignature = (instruction: Instruction, account: Address): Instruction => ({
  ...instruction,
  accounts: instruction.accounts?.map((meta) =>
    meta.address === account && isSignerRole(meta.role) ? { address: account, role: downgradeRoleToNonSigner(meta.role) } : meta,
  ),
});

async function eventsOf(signature: Signature): Promise<MultisigEvent[]> {
  const transaction = await rpc
    .getTransaction(signature, { commitment: "confirmed", encoding: "json", maxSupportedTransactionVersion: 0 })
    .send();
  if (!transaction) throw new Error("transaction not found");
  return getMultisigEventsFromTransaction(transaction, TEST_PROGRAM);
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

async function balance(account: Address): Promise<bigint> {
  return (await rpc.getBalance(account, { commitment: "confirmed" }).send()).value;
}

async function tokenBalance(account: Address): Promise<bigint> {
  const { value } = await rpc.getTokenAccountBalance(account, { commitment: "confirmed" }).send();
  return BigInt(value.amount);
}

async function ensureProgramConfig(payer: KeyPairSigner) {
  const [programConfig] = await findProgramConfigPda(r4);
  if ((await fetchMaybeProgramConfig(rpc, programConfig)).exists) return;
  const bytes = JSON.parse(readFileSync(join(repoRoot, "test-program-config-initializer-keypair.json"), "utf8"));
  const initializer = await createKeyPairSignerFromBytes(Uint8Array.from(bytes));
  await airdrop({ recipientAddress: initializer.address, lamports: lamports(1_000_000_000n), commitment: "confirmed" });
  const ix = await getProgramConfigInitInstructionAsync(
    { initializer, authority: initializer.address, multisigCreationFee: 0, treasury: payer.address },
    r4,
  );
  await send(payer, [ix]);
}

/** A v3 multisig with `members` and `threshold`; a random create key unless one is given. */
async function createV3Multisig(payer: KeyPairSigner, members: Address[], threshold: number, createKey?: Address): Promise<Address> {
  const key = createKey ?? (await generateKeyPairSigner()).address;
  const multisig = await findV3MultisigPda(key);
  await send(payer, [getV3CreateInstruction({ multisig, creator: payer, threshold, createKey: key, members })]);
  return multisig;
}

/**
 * One v3 transaction of `authorityIndex` with `instructions`: `creator` creates, attaches and
 * activates it, then each approver approves. Returns its index, address and instruction accounts.
 */
async function v3Propose(multisig: Address, authorityIndex: number, instructions: Instruction[], creator: KeyPairSigner, approvers: KeyPairSigner[]) {
  const transactionIndex = decodeV3Multisig((await accountData(multisig))!)!.transactionIndex + 1;
  const transaction = await findV3TransactionPda(multisig, transactionIndex);
  await send(creator, [getV3CreateTransactionInstruction({ multisig, transaction, creator, authorityIndex })]);
  const instructionAccounts: Address[] = [];
  for (const [i, instruction] of instructions.entries()) {
    const instructionAccount = await findV3InstructionPda(transaction, i + 1);
    instructionAccounts.push(instructionAccount);
    await send(creator, [getV3AddInstructionInstruction({ multisig, transaction, instructionAccount, creator, instruction })]);
  }
  await send(creator, [getV3ActivateTransactionInstruction({ multisig, transaction, member: creator })]);
  for (const approver of approvers) await send(approver, [getV3ApproveTransactionInstruction({ multisig, transaction, member: approver })]);
  return { transactionIndex, transaction, instructionAccounts };
}

/** Runs every attached instruction of an approved v3 transaction, one at a time. */
async function v3ExecuteEach(multisig: Address, transactionIndex: number, member: KeyPairSigner): Promise<Signature[]> {
  const executes = await getV3ExecuteInstructions(rpc, { sourceMultisig: multisig, transactionIndex, member });
  const signatures: Signature[] = [];
  for (const execute of executes) signatures.push(await send(member, [computeLimit, execute]));
  return signatures;
}

/** Proposes, approves and runs a v3 config transaction (authority 0) with `execute_transaction`. */
async function v3Config(multisig: Address, instructions: Instruction[], member: KeyPairSigner) {
  const { transaction, instructionAccounts } = await v3Propose(multisig, 0, instructions, member, [member]);
  const attached = await Promise.all(
    instructionAccounts.map(async (instructionAccount) => ({
      instructionAccount,
      instruction: decodeV3Instruction((await accountData(instructionAccount))!)!,
    })),
  );
  await send(member, [computeLimit, getV3ExecuteTransactionInstruction({ multisig, transaction, member, attached })]);
}

/** Adds `newMember` to a v3 multisig. v3 grows the account by 10 keys and needs the rent first. */
async function v3AddMember(payer: KeyPairSigner, multisig: Address, newMember: Address, member: KeyPairSigner) {
  await send(payer, [getTransferSolInstruction({ source: payer, destination: multisig, amount: 10_000_000n })]);
  await v3Config(multisig, [getV3AddMemberInstruction(multisig, newMember)], member);
}

const v3Source = (sourceMultisig: Address, authorityIndex = 1): V3MigrationSource => ({
  lineage: "v3",
  sourceMultisig,
  authorityIndex,
  programAddress: TEST_PROGRAM,
});

/** `multisig_create_from_v3`; v3 signs as the authority, unless a direct call passes `signer`. */
async function createFromV3(sourceMultisig: Address, authorityIndex = 1, signer?: TransactionSigner): Promise<Instruction> {
  const [programConfig] = await findProgramConfigPda(r4);
  const { data: config } = await fetchProgramConfigChecked(rpc, programConfig, r4);
  const [multisig] = await findSuccessorPda({ sourceMultisig }, r4);
  return getMultisigCreateFromV3Instruction(
    {
      programConfig,
      treasury: config.treasury,
      sourceMultisig,
      sourceVault: signer ?? createNoopSigner(await findV3AuthorityPda(sourceMultisig, authorityIndex)),
      multisig,
      authorityIndex,
      maxCreationFee: 0,
      memo: null,
    },
    r4,
  );
}

/** A v3 multisig (one member) with a funded authority 1 and, unless `successor` is false, its successor. */
async function v3WithSuccessor(member: KeyPairSigner, successor = true) {
  const source = await createV3Multisig(member, [member.address], 1);
  const authority = await findV3AuthorityPda(source, 1);
  await airdrop({ recipientAddress: authority, lamports: lamports(1_000_000_000n), commitment: "confirmed" });
  if (successor) {
    const { transactionIndex } = await v3Propose(source, 1, [await createFromV3(source)], member, [member]);
    await v3ExecuteEach(source, transactionIndex, member);
  }
  return { source, authority, successor: (await findSuccessorPda({ sourceMultisig: source }, r4))[0] };
}

/** A mint (`payer` holds both authorities) and `owner`'s associated token account with `amount`. */
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
    getInitializeMint2Instruction({ mint: mint.address, decimals: 6, mintAuthority: payer.address, freezeAuthority: null }, config),
    await getCreateAssociatedTokenIdempotentInstructionAsync({ payer, owner, mint: mint.address, tokenProgram }),
    getMintToInstruction({ mint: mint.address, token: account, mintAuthority: payer, amount }, config),
  ]);
  return { mint: mint.address, account };
}

/** A Token mint whose mint authority is `authority`. */
async function mintWithAuthority(payer: KeyPairSigner, authority: Address): Promise<Address> {
  const mint = await generateKeyPairSigner();
  await send(payer, [
    getCreateAccountInstruction({
      payer,
      newAccount: mint,
      lamports: await rpc.getMinimumBalanceForRentExemption(82n).send(),
      space: 82,
      programAddress: TOKEN_PROGRAM_ADDRESS,
    }),
    getInitializeMint2Instruction({ mint: mint.address, decimals: 0, mintAuthority: authority, freezeAuthority: null }),
  ]);
  return mint.address;
}

/** An initialized stake account with `authority` as staker and withdrawer, no lockup. */
async function createStake(payer: KeyPairSigner, authority: Address): Promise<Address> {
  const stake = await generateKeyPairSigner();
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
      accounts: [writable(stake.address), readonly(RENT_SYSVAR)],
      data: Uint8Array.from([0, 0, 0, 0, ...keyBytes(authority), ...keyBytes(authority), ...new Array(16).fill(0), ...keyBytes(payer.address)]),
    },
  ]);
  return stake.address;
}

/** A vote account with `withdrawer` as withdrawer (vote `InitializeAccount`). */
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
      accounts: [writable(vote.address), readonly(RENT_SYSVAR), readonly(CLOCK_SYSVAR), signerMeta(node)],
      data: Uint8Array.from([0, 0, 0, 0, ...keyBytes(node.address), ...keyBytes(node.address), ...keyBytes(withdrawer), 0]),
    },
  ]);
  return vote.address;
}

const programDataOf = async (program: Address) =>
  (await getProgramDerivedAddress({ programAddress: BPF_LOADER_UPGRADEABLE_ADDRESS, seeds: [addressEncoder.encode(program)] }))[0];

describe("v3 to 4r migration on a local validator", () => {
  let payer: KeyPairSigner;
  let member2: KeyPairSigner;

  beforeAll(async () => {
    payer = await fundedSigner(100n);
    member2 = await fundedSigner(5n);
    await ensureProgramConfig(payer);
  });

  it("plans, proposes and executes a whole v3 authority, one instruction at a time", async () => {
    // Arrange: the fixed v3 multisig (2 of 2) holds every class in authority 1.
    const source = await createV3Multisig(payer, [payer.address, member2.address], 2, FIXED_V3_CREATE_KEY);
    expect(await findV3AuthorityPda(source, 1)).toBe(FIXED_V3_AUTHORITY);
    await airdrop({ recipientAddress: FIXED_V3_AUTHORITY, lamports: lamports(3_000_000_000n), commitment: "confirmed" });
    const token = await mintTokens(payer, FIXED_V3_AUTHORITY, 1_000n, TOKEN_PROGRAM_ADDRESS);
    const token22 = await mintTokens(payer, FIXED_V3_AUTHORITY, 500n, TOKEN_2022_PROGRAM_ADDRESS);
    const mint = await mintWithAuthority(payer, FIXED_V3_AUTHORITY);
    const stake = await createStake(payer, FIXED_V3_AUTHORITY);
    const vote = await createVoteAccount(payer, FIXED_V3_AUTHORITY);
    const programData = await programDataOf(V3_UPGRADEABLE_PROGRAM);

    // Act: plan, propose (payer approves), the second member approves, payer executes each.
    const plan = await planV3Migration(rpc, { sourceMultisig: source, authorityIndex: 1, programAddress: TEST_PROGRAM });
    const proposal = await getV3MigrationProposal(rpc, plan, { member: payer });
    for (const transaction of proposal.transactions) await send(payer, transaction);
    const transaction = await findV3TransactionPda(source, proposal.transactionIndex);
    await send(member2, [getV3ApproveTransactionInstruction({ multisig: source, transaction, member: member2 })]);
    const signatures = await v3ExecuteEach(source, proposal.transactionIndex, payer);

    // Assert: the successor mirrors v3 governance, and vault 0 holds every asset.
    const { data: successor } = await fetchMultisigChecked(rpc, plan.successor, r4);
    const vault = plan.vault;
    expect(plan.vaultIndex).toBe(0);
    expect(plan.memberReport.risk).toBe("none");
    expect(successor.members.map((m) => [m.key, m.permissions.mask])).toEqual(
      [payer.address, member2.address].sort().map((key) => [key, 7]),
    );
    expect([successor.threshold, successor.timeLock, successor.configAuthority, successor.rentCollector.__option]).toEqual([
      2,
      0,
      SYSTEM_PROGRAM,
      "None",
    ]);
    expect(await tokenBalance(await findAssociatedTokenAddress(vault, token.mint, TOKEN_PROGRAM_ADDRESS))).toBe(1_000n);
    expect(await tokenBalance(await findAssociatedTokenAddress(vault, token22.mint, TOKEN_2022_PROGRAM_ADDRESS))).toBe(500n);
    expect(await accountData(token.account)).toBeNull();
    expect(addressAt((await accountData(mint))!, 4)).toBe(vault);
    expect([addressAt((await accountData(stake))!, 12), addressAt((await accountData(stake))!, 44)]).toEqual([vault, vault]);
    expect(addressAt((await accountData(vote))!, 36)).toBe(vault);
    expect(addressAt((await accountData(programData))!, 13)).toBe(vault);
    expect(await balance(FIXED_V3_AUTHORITY)).toBe(0n);
    expect(await balance(vault)).toBeGreaterThan(2_000_000_000n);
    const migrations = (await Promise.all(signatures.slice(1).map(eventsOf)))
      .flat()
      .filter((event): event is { __kind: "Migration" } & MigrationEvent => event.__kind === "Migration");
    expect(migrations.length).toBe(signatures.length - 1);
    migrations.forEach((event) => {
      expect(event.source).toEqual({ __kind: "V3", authorityIndex: 1 });
      expect([event.vaultIndex, event.sourceVault, event.vault]).toEqual([0, FIXED_V3_AUTHORITY, vault]);
    });
  });

  describe("guards", () => {
    it("lets nobody create the successor with multisig_create_v2 or a v3 authority-0 transaction (S1)", async () => {
      // Arrange: create_key would have to be the v3 multisig, a v3 PDA without a key.
      const source = await createV3Multisig(payer, [payer.address], 1);
      const [successor] = await findSuccessorPda({ sourceMultisig: source }, r4);
      const [programConfig] = await findProgramConfigPda(r4);
      const { data: config } = await fetchProgramConfigChecked(rpc, programConfig, r4);
      const createV2 = await getMultisigCreateV2InstructionAsync(
        {
          treasury: config.treasury,
          createKey: createNoopSigner(source),
          creator: payer,
          configAuthority: null,
          threshold: 1,
          members: [{ key: payer.address, permissions: { mask: 7 } }],
          timeLock: 0,
          rentCollector: null,
          memo: null,
        },
        r4,
      );
      const unsigned = withoutSignature(createV2, source);
      const zeroIndex = 1 + decodeV3Multisig((await accountData(source))!)!.transactionIndex;
      const transaction = await findV3TransactionPda(source, zeroIndex);
      await send(payer, [getV3CreateTransactionInstruction({ multisig: source, transaction, creator: payer, authorityIndex: 0 })]);
      const attachTo4r = getV3AddInstructionInstruction({
        multisig: source,
        transaction,
        instructionAccount: await findV3InstructionPda(transaction, 1),
        creator: payer,
        instruction: unsigned,
      });

      // Act: (1) a direct call; (2) a v3 authority-0 transaction, where the v3 multisig signs.
      const codes = [await simulatedErrorCode(payer, [unsigned]), await simulatedErrorCode(payer, [attachTo4r])];

      // Assert: 4r refuses the missing signature; v3 signs as its multisig only into itself.
      expect(unsigned.accounts?.map((meta) => meta.address)).toContain(successor);
      expect(codes).toEqual([ACCOUNT_NOT_SIGNER, V3_INVALID_AUTHORITY_INDEX]);
      expect((await fetchMaybeMultisig(rpc, successor)).exists).toBe(false);
    });

    it("refuses a source multisig of the other lineage", async () => {
      // Arrange: a v4 multisig for the v3 instruction, and a v3 multisig for the v4 one.
      const v3 = await createV3Multisig(payer, [payer.address], 1);
      const createKey = await generateKeyPairSigner();
      const [v4] = await findMultisigPda({ createKey: createKey.address }, { programAddress: LEGACY_V4_PROGRAM_ADDRESS });
      const [v4Config] = await findProgramConfigPda({ programAddress: LEGACY_V4_PROGRAM_ADDRESS });
      const { data: v4ConfigData } = await fetchProgramConfigChecked(rpc, v4Config, { programAddress: LEGACY_V4_PROGRAM_ADDRESS });
      await send(payer, [
        await getMultisigCreateV2InstructionAsync(
          {
            treasury: v4ConfigData.treasury,
            createKey,
            creator: payer,
            configAuthority: null,
            threshold: 1,
            members: [{ key: payer.address, permissions: { mask: 7 } }],
            timeLock: 0,
            rentCollector: null,
            memo: null,
          },
          { programAddress: LEGACY_V4_PROGRAM_ADDRESS },
        ),
      ]);
      const v3FromV4 = await createFromV3(v4, 1, payer);
      const v4FromV3 = await getMultisigCreateFromInstructionAsync(
        {
          sourceMultisig: v3,
          sourceVault: payer,
          multisig: (await findSuccessorPda({ sourceMultisig: v3 }, r4))[0],
          treasury: payer.address,
          vaultIndex: 0,
          configAuthorityVaultIndex: null,
          rentCollectorVaultIndex: null,
          maxCreationFee: 0,
          memo: null,
        },
        r4,
      );

      // Act
      const codes = [await simulatedErrorCode(payer, [v3FromV4]), await simulatedErrorCode(payer, [v4FromV3])];

      // Assert: the successor size reads the source layout first (Anchor runs `init` before the
      // `owner` constraint), and a multisig of the other lineage does not decode.
      expect(codes).toEqual([INVALID_ACCOUNT, INVALID_ACCOUNT]);
    });

    it("refuses authority indexes outside 1 to 256 and calls that v3 did not sign", async () => {
      // Arrange
      const { source } = await v3WithSuccessor(payer);
      const fresh = await createV3Multisig(payer, [payer.address], 1);
      const createZero = await createFromV3(fresh, 1, payer);
      const zeroData = Uint8Array.from(createZero.data!);
      zeroData.set([0, 0, 0, 0], 8);
      const { accounts } = await getMigrationAccounts(v3Source(source));
      const sol = (authorityIndex: number, sourceVault: TransactionSigner) =>
        getMultisigMigrateV3SolInstruction({ ...accounts, sourceVault, authorityIndex, keep: 0, memo: null }, r4);

      // Act
      const codes = [
        await simulatedErrorCode(payer, [{ ...createZero, data: zeroData }]),
        await simulatedErrorCode(payer, [sol(257, payer)]),
        await simulatedErrorCode(payer, [sol(1, payer)]),
      ];

      // Assert: the range check is the first constraint; with index 1, the wrong signer fails the v3 seeds.
      expect(codes).toEqual([MIGRATION_INVALID_AUTHORITY_INDEX, MIGRATION_INVALID_AUTHORITY_INDEX, CONSTRAINT_SEEDS]);
    });

    it("refuses to migrate before the successor exists", async () => {
      // Arrange
      const { source } = await v3WithSuccessor(payer, false);
      const { transactionIndex } = await v3Propose(source, 1, [await getMigrateSolInstruction(v3Source(source))], payer, [payer]);

      // Act
      const [execute] = await getV3ExecuteInstructions(rpc, { sourceMultisig: source, transactionIndex, member: payer });
      const code = await simulatedErrorCode(payer, [computeLimit, execute!]);

      // Assert
      expect(code).toBe(ACCOUNT_NOT_INITIALIZED);
    });

    it("stops every class when the v3 members drift from the successor", async () => {
      // Arrange: after the successor exists, v3 adds a member.
      const { source } = await v3WithSuccessor(payer);
      await v3AddMember(payer, source, member2.address, payer);
      const { transactionIndex } = await v3Propose(source, 1, [await getMigrateSolInstruction(v3Source(source))], payer, [payer]);

      // Act
      const [execute] = await getV3ExecuteInstructions(rpc, { sourceMultisig: source, transactionIndex, member: payer });
      const code = await simulatedErrorCode(payer, [computeLimit, execute!]);

      // Assert
      expect(code).toBe(MIGRATION_GOVERNANCE_MISMATCH);
    });

    it("mirrors the v3 governance at execution, after an approval and a v3 member change", async () => {
      // Arrange: the creation is approved, then v3 adds a member (v3 keeps the approval).
      const { source, successor } = await v3WithSuccessor(payer, false);
      const { transactionIndex } = await v3Propose(source, 1, [await createFromV3(source)], payer, [payer]);
      await v3AddMember(payer, source, member2.address, payer);

      // Act
      await v3ExecuteEach(source, transactionIndex, payer);

      // Assert
      const { data } = await fetchMultisigChecked(rpc, successor, r4);
      expect(data.members.map((m) => m.key)).toEqual([payer.address, member2.address].sort());
    });

    it("the planner refuses a v3 multisig with a roles delegate member", async () => {
      // Arrange: a roles user for `member2`, and its delegate as a v3 member.
      const source = await createV3Multisig(payer, [payer.address], 1);
      const manager = await findV3RolesManagerPda(source);
      const user = await findV3RolesUserPda(source, 1);
      const delegate = await findV3DelegatePda(user, member2.address);
      const hex = (value: string) => Uint8Array.from(Buffer.from(value, "hex"));
      await send(payer, [
        {
          programAddress: V3_ROLES_PROGRAM_ADDRESS,
          accounts: [writable(manager), readonly(source), { ...signerMeta(payer), role: AccountRole.WRITABLE_SIGNER }, readonly(SYSTEM_PROGRAM)],
          data: hex("bc3784e568bbcb3e"),
        },
      ]);
      const authority = await findV3AuthorityPda(source, 1);
      const nextIndex = 1 + decodeV3Multisig((await accountData(source))!)!.transactionIndex;
      const transaction = await findV3TransactionPda(source, nextIndex);
      const name = new TextEncoder().encode("bob");
      const addUser: Instruction = {
        programAddress: V3_ROLES_PROGRAM_ADDRESS,
        accounts: [
          writable(user),
          writable(manager),
          readonly(source),
          { address: payer.address, role: AccountRole.WRITABLE_SIGNER },
          { address: authority, role: AccountRole.READONLY_SIGNER },
          readonly(transaction),
          readonly(RENT_SYSVAR),
          readonly(SYSTEM_PROGRAM),
        ],
        data: Uint8Array.from([...hex("0fc803a8b829bdb0"), ...keyBytes(member2.address), V3Role.Vote, name.length, 0, 0, 0, ...name]),
      };
      const { transactionIndex } = await v3Propose(source, 1, [addUser], payer, [payer]);
      await v3ExecuteEach(source, transactionIndex, payer);
      await v3AddMember(payer, source, delegate, payer);

      // Act
      const error = await planV3Migration(rpc, { sourceMultisig: source, programAddress: TEST_PROGRAM }).catch((e: unknown) => e);

      // Assert
      expect(error).toBeInstanceOf(V3DelegateMembersError);
      expect((error as V3DelegateMembersError).delegates).toEqual([
        { delegate, user, originKey: member2.address, role: V3Role.Vote, name: "bob" },
      ]);
    });
  });
});
