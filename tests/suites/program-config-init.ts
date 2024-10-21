import {
  LAMPORTS_PER_SOL,
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import * as multisig from "@sqds/multisig";
import assert from "assert";
import {
  createLocalhostConnection,
  generateFundedKeypair,
  getTestProgramConfigAuthority,
  getTestProgramConfigInitializer,
  getTestProgramId,
  getTestProgramTreasury,
} from "../utils";

const programId = getTestProgramId();
const programConfigInitializer = getTestProgramConfigInitializer();
const programConfigAuthority = getTestProgramConfigAuthority();
const programTreasury = getTestProgramTreasury();
const programConfigPda = multisig.getProgramConfigPda({ programId })[0];

const connection = createLocalhostConnection();

describe("Initialize Global ProgramConfig", () => {
  before(async () => {
    // Airdrop to the program config initializer
    const signature = await connection.requestAirdrop(
      programConfigInitializer.publicKey,
      LAMPORTS_PER_SOL
    );
    await connection.confirmTransaction(signature);
  });

  it("error: invalid initializer", async () => {
    const fakeInitializer = await generateFundedKeypair(connection);

    const initIx = multisig.generated.createProgramConfigInitInstruction(
      {
        programConfig: programConfigPda,
        initializer: fakeInitializer.publicKey,
      },
      {
        args: {
          authority: programConfigAuthority.publicKey,
          treasury: programTreasury,
          multisigCreationFee: 0,
        },
      },
      programId
    );

    const blockhash = (await connection.getLatestBlockhash()).blockhash;
    const message = new TransactionMessage({
      recentBlockhash: blockhash,
      payerKey: fakeInitializer.publicKey,
      instructions: [initIx],
    }).compileToV0Message();
    const tx = new VersionedTransaction(message);
    tx.sign([fakeInitializer]);

    await assert.rejects(
      () =>
        connection
          .sendRawTransaction(tx.serialize())
          .catch(multisig.errors.translateAndThrowAnchorError),
      /Unauthorized: Attempted to perform an unauthorized action/
    );
  });

  it("error: `authority` is PublicKey.default", async () => {
    const initIx = multisig.generated.createProgramConfigInitInstruction(
      {
        programConfig: programConfigPda,
        initializer: programConfigInitializer.publicKey,
      },
      {
        args: {
          authority: PublicKey.default,
          treasury: programTreasury,
          multisigCreationFee: 0,
        },
      },
      programId
    );

    const blockhash = (await connection.getLatestBlockhash()).blockhash;
    const message = new TransactionMessage({
      recentBlockhash: blockhash,
      payerKey: programConfigInitializer.publicKey,
      instructions: [initIx],
    }).compileToV0Message();
    const tx = new VersionedTransaction(message);
    tx.sign([programConfigInitializer]);

    await assert.rejects(
      () =>
        connection
          .sendRawTransaction(tx.serialize())
          .catch(multisig.errors.translateAndThrowAnchorError),
      /InvalidAccount: Invalid account provided/
    );
  });

  it("error: `treasury` is PublicKey.default", async () => {
    const initIx = multisig.generated.createProgramConfigInitInstruction(
      {
        programConfig: programConfigPda,
        initializer: programConfigInitializer.publicKey,
      },
      {
        args: {
          authority: programConfigAuthority.publicKey,
          treasury: PublicKey.default,
          multisigCreationFee: 0,
        },
      },
      programId
    );

    const blockhash = (await connection.getLatestBlockhash()).blockhash;
    const message = new TransactionMessage({
      recentBlockhash: blockhash,
      payerKey: programConfigInitializer.publicKey,
      instructions: [initIx],
    }).compileToV0Message();
    const tx = new VersionedTransaction(message);
    tx.sign([programConfigInitializer]);

    await assert.rejects(
      () =>
        connection
          .sendRawTransaction(tx.serialize())
          .catch(multisig.errors.translateAndThrowAnchorError),
      /InvalidAccount: Invalid account provided/
    );
  });

  it("initialize program config", async () => {
    const initIx = multisig.generated.createProgramConfigInitInstruction(
      {
        programConfig: programConfigPda,
        initializer: programConfigInitializer.publicKey,
      },
      {
        args: {
          authority: programConfigAuthority.publicKey,
          treasury: programTreasury,
          multisigCreationFee: 0,
        },
      },
      programId
    );

    const blockhash = (await connection.getLatestBlockhash()).blockhash;
    const message = new TransactionMessage({
      recentBlockhash: blockhash,
      payerKey: programConfigInitializer.publicKey,
      instructions: [initIx],
    }).compileToV0Message();
    const tx = new VersionedTransaction(message);
    tx.sign([programConfigInitializer]);
    const sig = await connection.sendRawTransaction(tx.serialize(), { skipPreflight: true });
    await connection.confirmTransaction(sig);

    const programConfigData =
      await multisig.accounts.ProgramConfig.fromAccountAddress(
        connection,
        programConfigPda
      );

    assert.strictEqual(
      programConfigData.authority.toBase58(),
      programConfigAuthority.publicKey.toBase58()
    );
    assert.strictEqual(programConfigData.multisigCreationFee.toString(), "0");
    assert.strictEqual(
      programConfigData.treasury.toBase58(),
      programTreasury.toBase58()
    );
  });

  it("error: initialize program config twice", async () => {
    const initIx = multisig.generated.createProgramConfigInitInstruction(
      {
        programConfig: programConfigPda,
        initializer: programConfigInitializer.publicKey,
      },
      {
        args: {
          authority: programConfigAuthority.publicKey,
          treasury: programTreasury,
          multisigCreationFee: 0,
        },
      },
      programId
    );

    const blockhash = (await connection.getLatestBlockhash()).blockhash;
    const message = new TransactionMessage({
      recentBlockhash: blockhash,
      payerKey: programConfigInitializer.publicKey,
      instructions: [initIx],
    }).compileToV0Message();
    const tx = new VersionedTransaction(message);
    tx.sign([programConfigInitializer]);

    const err = await connection
      .sendRawTransaction(tx.serialize())
      .catch((err) => {
        return err;
      });

    assert.ok(multisig.errors.isErrorWithLogs(err));
    assert.ok(
      err.logs.find((line) => {
        return line.includes("already in use");
      })
    );
  });
});
