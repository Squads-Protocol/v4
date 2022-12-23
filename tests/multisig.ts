import { Connection, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import * as multisig from "@sqds/multisig";

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
      const signature = await multisig.rpc.create({
        connection,
        creator,
        configAuthority: creator.publicKey,
        members: members.map((m) => m.publicKey),
      });

      await connection.confirmTransaction(signature);
    });
  });
});
