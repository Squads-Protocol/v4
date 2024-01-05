import { Keypair, PublicKey } from "@solana/web3.js";
import {
  createControlledMultisig,
  createLocalhostConnection,
  generateFundedKeypair,
  generateMultisigMembers,
  getTestProgramId,
  TestMembers,
} from "../../utils";
import * as multisig from "@sqds/multisig";
import assert from "assert";

const { Multisig } = multisig.accounts;

const programId = getTestProgramId();
const connection = createLocalhostConnection();

describe("Instructions / multisig_set_rent_collector", () => {
  let members: TestMembers;
  let multisigPda: PublicKey;
  let configAuthority: Keypair;

  before(async () => {
    configAuthority = await generateFundedKeypair(connection);

    members = await generateMultisigMembers(connection);

    // Create new controlled multisig with no rent_collector.
    multisigPda = (
      await createControlledMultisig({
        connection,
        createKey: Keypair.generate(),
        configAuthority: configAuthority.publicKey,
        members,
        threshold: 1,
        timeLock: 0,
        programId,
      })
    )[0];
  });

  it("set `rent_collector` for the controlled multisig", async () => {
    const multisigAccountInfoPreExecution = await connection.getAccountInfo(
      multisigPda
    )!;

    const vaultPda = multisig.getVaultPda({
      multisigPda,
      index: 0,
      programId,
    })[0];

    const signature = await multisig.rpc.multisigSetRentCollector({
      connection,
      multisigPda,
      feePayer: configAuthority,
      configAuthority: configAuthority.publicKey,
      newRentCollector: vaultPda,
      rentPayer: configAuthority.publicKey,
      programId,
      signers: [configAuthority],
    });
    await connection.confirmTransaction(signature, "confirmed");

    // Verify the multisig account.
    const multisigAccountInfoPostExecution = await connection.getAccountInfo(
      multisigPda
    );
    const [multisigAccountPostExecution] = Multisig.fromAccountInfo(
      multisigAccountInfoPostExecution!
    );
    // The rentCollector should be updated.
    assert.strictEqual(
      multisigAccountPostExecution.rentCollector?.toBase58(),
      vaultPda.toBase58()
    );
    // The stale transaction index should NOT be updated and remain 0.
    assert.strictEqual(
      multisigAccountPostExecution.staleTransactionIndex.toString(),
      "0"
    );
    // multisig space should not be reallocated because we allocate 32 bytes for potential rent_collector when we create multisig.
    assert.ok(
      multisigAccountInfoPostExecution!.data.length ===
        multisigAccountInfoPreExecution!.data.length
    );
  });

  it("unset `rent_collector` for the controlled multisig", async () => {
    const signature = await multisig.rpc.multisigSetRentCollector({
      connection,
      multisigPda,
      feePayer: configAuthority,
      configAuthority: configAuthority.publicKey,
      newRentCollector: null,
      rentPayer: configAuthority.publicKey,
      programId,
      signers: [configAuthority],
    });
    await connection.confirmTransaction(signature, "confirmed");

    // Make sure the rent_collector was unset correctly.
    const multisigAccount = await Multisig.fromAccountAddress(
      connection,
      multisigPda
    );
    assert.strictEqual(multisigAccount.rentCollector, null);
  });
});
