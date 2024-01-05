import {
  createInitializeMint2Instruction,
  getMinimumBalanceForRentExemptMint,
  getMint,
  MINT_SIZE,
  TOKEN_2022_PROGRAM_ID,
} from "@solana/spl-token";
import { SystemProgram, TransactionMessage } from "@solana/web3.js";
import * as multisig from "@sqds/multisig";
import assert from "assert";
import {
  createAutonomousMultisig,
  createLocalhostConnection,
  generateMultisigMembers,
  getTestProgramId,
  TestMembers,
} from "../../utils";

const { Multisig } = multisig.accounts;

const programId = getTestProgramId();

describe("Examples / Create Mint", () => {
  const connection = createLocalhostConnection();

  let members: TestMembers;
  before(async () => {
    members = await generateMultisigMembers(connection);
  });

  it("should create a mint", async () => {
    const [multisigPda] = await createAutonomousMultisig({
      connection,
      members,
      threshold: 2,
      timeLock: 0,
      programId,
    });

    let multisigAccount = await Multisig.fromAccountAddress(
      connection,
      multisigPda
    );

    const transactionIndex =
      multisig.utils.toBigInt(multisigAccount.transactionIndex) + 1n;

    const [transactionPda] = multisig.getTransactionPda({
      multisigPda,
      index: transactionIndex,
      programId,
    });

    // Default vault, index 0.
    const [vaultPda] = multisig.getVaultPda({
      multisigPda,
      index: 0,
      programId,
    });

    const lamportsForMintRent = await getMinimumBalanceForRentExemptMint(
      connection
    );

    // Vault will pay for the Mint account rent, airdrop this amount.
    const airdropSig = await connection.requestAirdrop(
      vaultPda,
      lamportsForMintRent
    );
    await connection.confirmTransaction(airdropSig);

    // Mint account is a signer in the SystemProgram.createAccount ix,
    // so we use an Ephemeral Signer provided by the Multisig program as the Mint account.
    const [mintPda, mintBump] = multisig.getEphemeralSignerPda({
      transactionPda,
      ephemeralSignerIndex: 0,
      programId,
    });

    const testTransactionMessage = new TransactionMessage({
      payerKey: vaultPda,
      recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
      instructions: [
        SystemProgram.createAccount({
          fromPubkey: vaultPda,
          newAccountPubkey: mintPda,
          space: MINT_SIZE,
          lamports: lamportsForMintRent,
          programId: TOKEN_2022_PROGRAM_ID,
        }),
        createInitializeMint2Instruction(
          mintPda,
          9,
          vaultPda,
          vaultPda,
          TOKEN_2022_PROGRAM_ID
        ),
      ],
    });

    // Create VaultTransaction account.
    let signature = await multisig.rpc.vaultTransactionCreate({
      connection,
      feePayer: members.proposer,
      multisigPda,
      transactionIndex,
      creator: members.proposer.publicKey,
      vaultIndex: 0,
      ephemeralSigners: 1,
      transactionMessage: testTransactionMessage,
      memo: "Create new mint",
      programId,
    });
    await connection.confirmTransaction(signature);

    // Create Proposal account.
    signature = await multisig.rpc.proposalCreate({
      connection,
      feePayer: members.voter,
      multisigPda,
      transactionIndex,
      creator: members.voter,
      programId,
    });
    await connection.confirmTransaction(signature);

    // Approve 1.
    signature = await multisig.rpc.proposalApprove({
      connection,
      feePayer: members.voter,
      multisigPda,
      transactionIndex,
      member: members.voter,
      memo: "LGTM",
      programId,
    });
    await connection.confirmTransaction(signature);

    // Approve 2.
    signature = await multisig.rpc.proposalApprove({
      connection,
      feePayer: members.almighty,
      multisigPda,
      transactionIndex,
      member: members.almighty,
      memo: "LGTM too",
      programId,
    });
    await connection.confirmTransaction(signature);

    // Execute.
    signature = await multisig.rpc.vaultTransactionExecute({
      connection,
      feePayer: members.executor,
      multisigPda,
      transactionIndex,
      member: members.executor.publicKey,
      signers: [members.executor],
      sendOptions: { skipPreflight: true },
      programId,
    });
    await connection.confirmTransaction(signature);

    // Assert the Mint account is initialized.
    const mintAccount = await getMint(
      connection,
      mintPda,
      undefined,
      TOKEN_2022_PROGRAM_ID
    );
    assert.ok(mintAccount.isInitialized);
    assert.strictEqual(
      mintAccount.mintAuthority?.toBase58(),
      vaultPda.toBase58()
    );
    assert.strictEqual(mintAccount.decimals, 9);
    assert.strictEqual(mintAccount.supply, 0n);
  });
});
