import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { PublicKey, Keypair } from "@solana/web3.js";
import { expect } from "chai";
import { SquadsMultisigProgram } from "../target/types/squads_multisig_program";

describe("Dynamic Multisig", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace
    .SquadsMultisigProgram as Program<SquadsMultisigProgram>;

  it("Creates a dynamic multisig", async () => {
    const createKey = Keypair.generate();
    const [multisigPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("squad"), createKey.publicKey.toBuffer()],
      program.programId
    );

    const members = [
      {
        key: provider.wallet.publicKey,
        permissions: { mask: 7 }, // All permissions
      },
    ];

    await program.methods
      .createDynamicMultisig(75, 0, members)
      .accounts({
        creator: provider.wallet.publicKey,
        createKey: createKey.publicKey,
        multisig: multisigPda,
      })
      .signers([createKey])
      .rpc();

    const multisig = await program.account.dynamicMultisig.fetch(multisigPda);
    expect(multisig.thresholdRatio).to.equal(75);
    expect(multisig.members.length).to.equal(1);
  });

  // Add more tests...
}); 