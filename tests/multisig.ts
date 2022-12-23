import { Connection, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import * as multisig from "@sqds/multisig";
import { Multisig, Role } from "@sqds/multisig";
import * as assert from "assert";

describe("multisig", () => {
  const connection = new Connection("http://127.0.0.1:8899", "confirmed");

  // Used only for paying for creation of multisigs, it's not actually a member of any of them.
  const creator = Keypair.generate();
  console.log("creator:", creator.publicKey.toBase58());

  const members = [Keypair.generate(), Keypair.generate(), Keypair.generate()];
  console.log(
    "members:",
    JSON.stringify(
      members.map((m) => m.publicKey),
      null,
      2
    )
  );

  before(async () => {
    // Airdropped 10 SOL to creator.
    const sig = await connection.requestAirdrop(
      creator.publicKey,
      10 * LAMPORTS_PER_SOL
    );
    await connection.confirmTransaction(sig);

    // Airdrop 100 SOL to each member.
    await Promise.all(
      members.map(async (member) => {
        const sig = await connection.requestAirdrop(
          member.publicKey,
          100 * LAMPORTS_PER_SOL
        );
        await connection.confirmTransaction(sig);
      })
    );
  });

  describe("create", () => {
    it("new multisig", async () => {
      const createKey = Keypair.generate().publicKey;

      const [multisigPda, multisigBump] = multisig.getMultisigPda({
        createKey,
      });
      const [configAuthority] = multisig.getAuthorityPda({
        multisigPda,
        index: 0,
      });

      const signature = await multisig.rpc.create({
        connection,
        creator,
        multisigPda,
        configAuthority,
        threshold: 1,
        members: members.map((m) => ({ key: m.publicKey, role: Role.All })),
        createKey,
        allowExternalSigners: false,
      });

      await connection.confirmTransaction(signature);

      const multisigAccount = await Multisig.fromAccountAddress(
        connection,
        multisigPda
      );

      assert.strictEqual(
        multisigAccount.configAuthority.toBase58(),
        configAuthority.toBase58()
      );
      assert.strictEqual(multisigAccount.threshold, 1);
      assert.deepEqual(
        multisigAccount.members,
        members
          .map((m) => ({ key: m.publicKey, role: Role.All }))
          .sort((a, b) => a.key.toBuffer().compare(b.key.toBuffer()))
      );
      assert.strictEqual(multisigAccount.authorityIndex, 1);
      assert.strictEqual(multisigAccount.transactionIndex.toString(), "0");
      assert.strictEqual(multisigAccount.staleTransactionIndex.toString(), "0");
      assert.strictEqual(multisigAccount.allowExternalExecute, false);
      assert.strictEqual(
        multisigAccount.createKey.toBase58(),
        createKey.toBase58()
      );
      assert.strictEqual(multisigAccount.bump, multisigBump);
    });

    it("error: duplicate member");
    it("error: empty members");
    it("error: too many members");
    it("error: invalid threshold (< 1)");
    it("error: invalid threshold (> members.length)");
  });
});
