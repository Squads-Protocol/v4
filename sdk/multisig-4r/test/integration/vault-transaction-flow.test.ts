import { readFileSync } from "node:fs";
import { join } from "node:path";

import { getTransferSolInstruction } from "@solana-program/system";
import {
  address,
  airdropFactory,
  appendTransactionMessageInstructions,
  createKeyPairSignerFromBytes,
  createNoopSigner,
  createSolanaRpc,
  createSolanaRpcSubscriptions,
  createTransactionMessage,
  generateKeyPairSigner,
  getSignatureFromTransaction,
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
} from "@solana/kit";
import { beforeAll, describe, expect, it } from "vitest";

import {
  fetchMaybeProgramConfig,
  fetchMultisigChecked,
  fetchProgramConfigChecked,
  fetchVaultTransactionChecked,
  findMultisigPda,
  findProgramConfigPda,
  findProposalPda,
  findTransactionPda,
  findVaultPda,
  getMultisigCreateV2InstructionAsync,
  getMultisigEventsFromTransaction,
  getProgramConfigInitInstructionAsync,
  getProposalApproveInstruction,
  getProposalCreateInstruction,
  getTransactionMessageBytes,
  getVaultTransactionCreateInstruction,
  getVaultTransactionExecuteInstructionWithAccounts,
  ProposalEventKind,
  TransactionEventKind,
  withEvents,
  type MultisigEvent,
} from "../../src";

// Runs against `solana-test-validator` with the program built with `--features testing`.
const TEST_PROGRAM = address("GyhGAqjokLwF9UXdQ2dR5Zwiup242j4mX4J1tSMKyAmD");
const config = { programAddress: TEST_PROGRAM };
const repoRoot = join(__dirname, "..", "..", "..", "..");

const rpc = createSolanaRpc(process.env.RPC_URL ?? "http://127.0.0.1:8899");
const rpcSubscriptions = createSolanaRpcSubscriptions(process.env.RPC_WS_URL ?? "ws://127.0.0.1:8900");
const sendAndConfirm = sendAndConfirmTransactionFactory({ rpc, rpcSubscriptions });
const airdrop = airdropFactory({ rpc, rpcSubscriptions });

async function send(payer: KeyPairSigner, instructions: Instruction[]) {
  const { value: blockhash } = await rpc.getLatestBlockhash().send();
  const message = pipe(
    createTransactionMessage({ version: 0 }),
    (m) => setTransactionMessageFeePayerSigner(payer, m),
    (m) => setTransactionMessageLifetimeUsingBlockhash(blockhash, m),
    (m) => appendTransactionMessageInstructions(instructions, m),
  );
  const signed = await signTransactionMessageWithSigners(message);
  await sendAndConfirm(signed as Parameters<typeof sendAndConfirm>[0], { commitment: "confirmed" });
  return getSignatureFromTransaction(signed);
}

/** The verified events of a confirmed transaction. */
async function eventsOf(signature: Signature, program: Address): Promise<MultisigEvent[]> {
  const transaction = await rpc
    .getTransaction(signature, { commitment: "confirmed", encoding: "json", maxSupportedTransactionVersion: 0 })
    .send();
  if (!transaction) throw new Error("transaction not found");
  return getMultisigEventsFromTransaction(transaction, program);
}

async function fundedSigner(sol: bigint): Promise<KeyPairSigner> {
  const signer = await generateKeyPairSigner();
  await airdrop({ recipientAddress: signer.address, lamports: lamports(sol * 1_000_000_000n), commitment: "confirmed" });
  return signer;
}

async function ensureProgramConfig(payer: KeyPairSigner) {
  const [programConfig] = await findProgramConfigPda(config);
  if ((await fetchMaybeProgramConfig(rpc, programConfig)).exists) return;
  const bytes = JSON.parse(readFileSync(join(repoRoot, "test-program-config-initializer-keypair.json"), "utf8"));
  const initializer = await createKeyPairSignerFromBytes(Uint8Array.from(bytes));
  await airdrop({ recipientAddress: initializer.address, lamports: lamports(1_000_000_000n), commitment: "confirmed" });
  const ix = await getProgramConfigInitInstructionAsync(
    { initializer, authority: payer.address, multisigCreationFee: 0, treasury: payer.address },
    config,
  );
  await send(payer, [ix]);
}

describe("vault transaction flow on a local validator", () => {
  let payer: KeyPairSigner;

  beforeAll(async () => {
    payer = await fundedSigner(10n);
    await ensureProgramConfig(payer);
  });

  it("creates a multisig, then proposes, approves and executes a SOL transfer from the vault", async () => {
    // Arrange: a 1-of-1 multisig with a funded vault.
    const createKey = await generateKeyPairSigner();
    const [multisig] = await findMultisigPda({ createKey: createKey.address }, config);
    const [programConfig] = await findProgramConfigPda(config);
    const { data: programConfigData } = await fetchProgramConfigChecked(rpc, programConfig, config);
    await send(payer, [
      await getMultisigCreateV2InstructionAsync(
        {
          treasury: programConfigData.treasury,
          createKey,
          creator: payer,
          configAuthority: null,
          threshold: 1,
          members: [{ key: payer.address, permissions: { mask: 7 } }],
          timeLock: 0,
          rentCollector: null,
          memo: null,
        },
        config,
      ),
    ]);
    const [vault] = await findVaultPda({ multisig, index: 0 }, config);
    const recipient = (await generateKeyPairSigner()).address;
    await send(payer, [getTransferSolInstruction({ source: payer, destination: vault, amount: 2_000_000_000n })]);

    // Act: propose, approve, execute.
    const transactionIndex = (await fetchMultisigChecked(rpc, multisig, config)).data.transactionIndex + 1n;
    const [transaction] = await findTransactionPda({ multisig, index: transactionIndex }, config);
    const [proposal] = await findProposalPda({ multisig, transactionIndex }, config);
    const transfer = getTransferSolInstruction({
      source: createNoopSigner(vault),
      destination: recipient,
      amount: 1_000_000n,
    });
    await send(payer, [
      getVaultTransactionCreateInstruction(
        {
          multisig,
          transaction,
          creator: payer,
          rentPayer: payer,
          vaultIndex: 0,
          ephemeralSigners: 0,
          transactionMessage: getTransactionMessageBytes({ vault, instructions: [transfer] }),
          memo: null,
        },
        config,
      ),
      getProposalCreateInstruction({ multisig, proposal, creator: payer, rentPayer: payer, transactionIndex, draft: false }, config),
      getProposalApproveInstruction({ multisig, member: payer, proposal, memo: null }, config),
    ]);
    const { data: vaultTransaction } = await fetchVaultTransactionChecked(rpc, transaction, config);
    const execute = await send(payer, [
      withEvents(
        await getVaultTransactionExecuteInstructionWithAccounts(
          { multisig, proposal, transaction, member: payer, message: vaultTransaction.message, vaultIndex: 0 },
          config,
        ),
      ),
    ]);

    // Assert
    const { value: received } = await rpc.getBalance(recipient, { commitment: "confirmed" }).send();
    expect(received).toBe(1_000_000n);
    const events = await eventsOf(execute, TEST_PROGRAM);
    expect(events).toMatchObject([
      { __kind: "Transaction", kind: TransactionEventKind.Execute, multisig, transaction, transactionIndex },
      { __kind: "Proposal", kind: ProposalEventKind.Execute, multisig, proposal, transactionIndex },
    ]);
  });

  it("refuses to decode a 4r-layout account owned by another program ID", async () => {
    // Arrange
    const [programConfig] = await findProgramConfigPda(config);

    // Act: the default program ID is the mainnet 4r program, not the local test program.
    const result = fetchProgramConfigChecked(rpc, programConfig);

    // Assert
    await expect(result).rejects.toThrow(/is owned by GyhGA/);
  });
});
