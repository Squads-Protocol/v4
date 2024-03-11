import Image from "next/image";
import * as multisig from "@sqds/multisig";
import { Keypair } from "@solana/web3.js";

export default function Home() {
  const createKey = Keypair.generate().publicKey;
  const multisigPda = multisig.getMultisigPda({ createKey })[0].toBase58();
  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24">
      Hello world, {multisigPda}
    </main>
  );
}
