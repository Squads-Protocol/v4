"use client";
import Image from "next/image";
import * as multisig from "@sqds/multisig";
import * as anchor from "@coral-xyz/anchor";
import { useAnchorWallet, useWallet } from "@solana/wallet-adapter-react";
import { use, useEffect, useState } from "react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import idl from "../src/squads_modules_program.json";
import { SquadsModulesProgram } from "@/src/squads_modules_program";

type Squad = {
  accountInfo: anchor.web3.AccountInfo<Buffer>;
  multisigData: multisig.accounts.Multisig;
};

export default function Home() {
  const wallet = useWallet();

  const [multisigPubkey, setMultisigPubkey] = useState<anchor.web3.PublicKey>();
  const [multisigData, setMultisigData] = useState<Squad | undefined>(
    undefined
  );
  const anchorWallet = useAnchorWallet();

  const connection = new anchor.web3.Connection(
    anchor.web3.clusterApiUrl("devnet")
  );

  const provider = new anchor.AnchorProvider(connection, anchorWallet!, {
    commitment: "confirmed",
    skipPreflight: true,
  });

  const program = new anchor.Program<SquadsModulesProgram>(
    // @ts-ignore
    idl,
    new anchor.web3.PublicKey("CWkz6sLyq6Kpj2TfNZadKBXREDcf9QTcC4auLYn7vCrZ"),
    provider
  );

  useEffect(() => {
    startMultisigWebsocket();
    if (wallet.publicKey) {
      const multisigPda = multisig.getMultisigPda({
        createKey: wallet.publicKey,
      })[0];
      setMultisigPubkey(multisigPda);
    }
  }, [wallet.publicKey]);

  useEffect(() => {
    if (multisigPubkey) {
      console.log("Multisig key", multisigPubkey.toBase58());
      const fetchMultisigData = async () => {
        let multisigPda = multisig.getMultisigPda({
          createKey: wallet.publicKey!,
        })[0];
        let multisigAccountInfo = await connection.getAccountInfo(multisigPda);
        if (!multisigAccountInfo?.data) {
          return;
        }
        let accountData =
          multisig.accounts.Multisig.fromAccountInfo(multisigAccountInfo)[0];
        setMultisigData({
          accountInfo: multisigAccountInfo,
          multisigData: accountData,
        });
      };

      fetchMultisigData();
    }
  }, [multisigPubkey]);

  const startMultisigWebsocket = async () => {
    if (!multisigPubkey) {
      return;
    }
    const subscriptionId = await connection.onAccountChange(
      multisigPubkey,
      (updatedAccountInfo) => {
        if (updatedAccountInfo.data) {
          const multisigData =
            multisig.accounts.Multisig.fromAccountInfo(updatedAccountInfo)[0];
          setMultisigData({ accountInfo: updatedAccountInfo, multisigData });
        }
      },
      "confirmed"
    );
  };

  const createSquad = async () => {
    const multisigPda = multisig.getMultisigPda({
      createKey: wallet.publicKey!,
    })[0];

    const createSquadInstruction = multisig.instructions.multisigCreate({
      configAuthority: wallet.publicKey!,
      creator: wallet.publicKey!,
      members: [
        {
          key: wallet.publicKey!,
          permissions: multisig.types.Permissions.fromPermissions([
            multisig.types.Permission.Initiate,
            multisig.types.Permission.Vote,
            multisig.types.Permission.Execute,
          ]),
        },
      ],
      multisigPda,
      createKey: wallet.publicKey!,
      threshold: 1,
      timeLock: 0,
    });

    const moduleManagerPubkey = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("modules_manager"), multisigPda.toBuffer()],
      program.programId
    )[0];

    const addModuleWithConfigAuthorityInstruction = await program.methods
      .createModulesManager()
      .accounts({
        signer: wallet.publicKey!,
        multisig: multisigPda,
        modulesManager: moduleManagerPubkey,
        squadsProgram: multisig.PROGRAM_ADDRESS,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .instruction();

    const tx = new anchor.web3.Transaction();

    tx.add(createSquadInstruction, addModuleWithConfigAuthorityInstruction);

    const signature = await wallet.sendTransaction(tx, connection, {
      skipPreflight: true,
    });
    console.log("Signature", signature);
  };

  const createTransferTransaction = async () => {
    let vaultPda = multisig.getVaultPda({
      multisigPda: multisigPubkey!,
      index: 1,
    })[0];

    const instruction = anchor.web3.SystemProgram.transfer({
      // The transfer is being signed from the Squads Vault, that is why we use the VaultPda
      fromPubkey: vaultPda,
      toPubkey: anchorWallet!.publicKey,
      lamports: 0.001 * anchor.web3.LAMPORTS_PER_SOL,
    });
    // This message contains the instructions that the transaction is going to execute
    const transferMessage = new anchor.web3.TransactionMessage({
      payerKey: vaultPda,
      recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
      instructions: [instruction],
    });

    const newTransactionIndex =
      Number(multisigData?.multisigData.transactionIndex) + 1;

    console.log("newTransactionIndex", newTransactionIndex);

    const transferInstruction = multisig.instructions.vaultTransactionCreate({
      multisigPda: multisigPubkey!,
      vaultIndex: 1,
      creator: anchorWallet!.publicKey,
      // @ts-ignore
      transactionIndex: newTransactionIndex,
      transactionMessage: transferMessage,
      ephemeralSigners: 0,
    });

    const createProposalInstruction = multisig.instructions.proposalCreate({
      creator: anchorWallet!.publicKey,
      multisigPda: multisigPubkey!,
      // @ts-ignore
      transactionIndex: newTransactionIndex,
    });

    const voteOnProposal = multisig.instructions.proposalApprove({
      member: anchorWallet!.publicKey,
      multisigPda: multisigPubkey!,
      // @ts-ignore
      transactionIndex: newTransactionIndex,
    });

    const signature = await wallet.sendTransaction(
      new anchor.web3.Transaction()
        .add(transferInstruction)
        .add(createProposalInstruction)
        .add(voteOnProposal),
      connection,
      { skipPreflight: true }
    );
    console.log("Signature", signature);
  };

  const executeThroughModuleProgram = async () => {
    const moduleManagerPubkey = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("modules_manager"), multisigPubkey!.toBuffer()],
      program.programId
    )[0];
    if (!multisigData?.multisigData.transactionIndex) {
      return;
    }
    const transactionIndex = Number(
      multisigData?.multisigData.transactionIndex
    );

    const transactionPda = multisig.getTransactionPda({
      multisigPda: multisigPubkey!,
      // @ts-ignore
      index: transactionIndex,
    })[0];
    console.log(transactionPda.toBase58());

    console.log(transactionIndex);

    const proposalPda = multisig.getProposalPda({
      multisigPda: multisigPubkey!,
      // @ts-ignore
      transactionIndex: transactionIndex,
    })[0];
    console.log("proposal", proposalPda.toBase58());

    const vaultPda = multisig.getVaultPda({
      index: 1,
      multisigPda: multisigPubkey!,
    })[0];

    const instruction = await program.methods
      .executeVaultTransaction()
      .accounts({
        modulesManager: moduleManagerPubkey,
        multisig: multisigPubkey!,
        signer: wallet.publicKey!,
        squadsProgram: multisig.PROGRAM_ADDRESS,
        systemProgram: anchor.web3.SystemProgram.programId,
        vaultTransaction: transactionPda,
        proposal: proposalPda,
      })
      .remainingAccounts([
        {
          pubkey: vaultPda,
          isWritable: true,
          isSigner: false,
        },
        {
          pubkey: wallet.publicKey!,
          isWritable: true,
          isSigner: false,
        },
        {
          pubkey: anchor.web3.SystemProgram.programId,
          isWritable: false,
          isSigner: false,
        },
      ])
      .rpc({ skipPreflight: true });
  };

  const addModule = async () => {
    const discriminator = [133, 161, 141, 48, 120, 198, 88, 150];
    console.log(Buffer.from(discriminator));
    const moduleProgram = new anchor.web3.PublicKey(
      "3z3PNrpRoJrvKH8iTaFstnMAemEmMZht69V2nBSFtGJM"
    );

    const modulesManagerPubkey = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("modules_manager"), multisigPubkey!.toBuffer()],
      program.programId
    )[0];

    const signature = await program.methods
      .addModule({
        name: "verify",
        program: moduleProgram,
        discriminator: Buffer.from(discriminator),
      })
      .accounts({
        modulesManager: modulesManagerPubkey,
        multisig: multisigPubkey!,
        signer: wallet.publicKey!,
      })
      .rpc();

    console.log("signature: ", signature);
  };

  const executeWithModuleWhitelist = async () => {
    const modulesManagerPubkey = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("modules_manager"), multisigPubkey!.toBuffer()],
      program.programId
    )[0];

    const currentProposal = multisigData?.multisigData.transactionIndex;

    const proposalPda = multisig.getProposalPda({
      multisigPda: multisigPubkey!,
      // @ts-ignore
      transactionIndex: currentProposal,
    })[0];

    const transactionPda = multisig.getTransactionPda({
      multisigPda: multisigPubkey!,
      // @ts-ignore
      index: currentProposal,
    })[0];

    const squadVaultPda = multisig.getVaultPda({
      multisigPda: multisigPubkey!,
      index: 1,
    })[0];

    const signature = program.methods
      .executeModuleVaultTransaction()
      .accounts({
        modulesManager: modulesManagerPubkey,
        multisig: multisigPubkey!,
        signer: wallet.publicKey!,
        proposal: proposalPda,
        squadsProgram: multisig.PROGRAM_ADDRESS,
        systemProgram: anchor.web3.SystemProgram.programId,
        vaultTransaction: transactionPda,
      })
      .remainingAccounts([
        {
          pubkey: squadVaultPda,
          isWritable: true,
          isSigner: false,
        },
        {
          pubkey: wallet.publicKey!,
          isWritable: true,
          isSigner: false,
        },
        {
          pubkey: anchor.web3.SystemProgram.programId,
          isWritable: false,
          isSigner: false,
        },
        {
          pubkey: new anchor.web3.PublicKey(
            "3z3PNrpRoJrvKH8iTaFstnMAemEmMZht69V2nBSFtGJM"
          ),
          isSigner: false,
          isWritable: false,
        },
      ])
      .rpc();
  };

  const addMemberToMultisig = async () => {
    const modulesManagerPubkey = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("modules_manager"), multisigPubkey!.toBuffer()],
      program.programId
    )[0];
    const newTransactionIndex =
      Number(multisigData?.multisigData.transactionIndex) + 1;
    const createAddMemberInstruction =
      multisig.instructions.configTransactionCreate({
        actions: [
          {
            __kind: "AddMember",
            newMember: {
              key: anchor.web3.Keypair.generate().publicKey,
              permissions: multisig.types.Permissions.fromPermissions([
                multisig.types.Permission.Initiate,
                multisig.types.Permission.Vote,
                multisig.types.Permission.Execute,
              ]),
            },
          },
        ],
        creator: wallet.publicKey!,
        multisigPda: multisigPubkey!,
        // @ts-ignore
        transactionIndex: newTransactionIndex,
      });

    const configTransactionPda = multisig.getTransactionPda({
      // @ts-ignore
      index: newTransactionIndex,
      multisigPda: multisigPubkey!,
    })[0];

    const proposalPda = multisig.getProposalPda({
      multisigPda: multisigPubkey!,
      // @ts-ignore
      transactionIndex: newTransactionIndex,
    })[0];

    const executeConfigTransactionInstruction = await program.methods
      .executeConfigTransaction()
      .accounts({
        modulesManager: modulesManagerPubkey,
        configTransaction: configTransactionPda,
        multisig: multisigPubkey!,
        signer: wallet.publicKey!,
        proposal: proposalPda,
        squadsProgram: multisig.PROGRAM_ADDRESS,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .instruction();

    let addMemberTransaction = new anchor.web3.Transaction();
    addMemberTransaction.add(createAddMemberInstruction);
    addMemberTransaction.add(executeConfigTransactionInstruction);

    const signature = await wallet.sendTransaction(
      addMemberTransaction,
      connection,
      {
        skipPreflight: true,
      }
    );

    console.log("Signature", signature);
  };

  return (
    <div>
      <h1>Squads Modules demo</h1>
      <WalletMultiButton />
      {wallet.connected ? (
        <div>
          <p>Wallet address: {wallet.publicKey?.toBase58()}</p>
          {multisigData?.accountInfo.data ? (
            <div>
              <p>
                Multisig vault key:{" "}
                {multisig
                  .getVaultPda({
                    multisigPda: multisigPubkey!,
                    index: 1,
                  })[0]
                  .toBase58()}
              </p>
              <button onClick={createTransferTransaction}>
                Create a new transaction
              </button>
              <br />
              <button onClick={executeThroughModuleProgram}>
                Execute through module program
              </button>
              <br />
              <button onClick={addModule}>Add a module</button>
              <br />
              <button onClick={executeWithModuleWhitelist}>
                Execute through whitelist
              </button>
              <br />
              <button onClick={addMemberToMultisig}>Add member</button>
            </div>
          ) : (
            <div>
              <p>You don't have a multisig yet</p>
              <button onClick={createSquad}>Create one</button>
            </div>
          )}
        </div>
      ) : (
        <p>Wallet not connected</p>
      )}
    </div>
  );
}
