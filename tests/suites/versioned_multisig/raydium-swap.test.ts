import {
    createLocalhostConnection
} from "../../utils";

import * as versionedMultisig from "../../../sdk/versioned_multisig";
import { ProgramConfig } from "../../../sdk/versioned_multisig/lib/accounts";
import { VersionedMultisigTestHelper } from "../../helpers/versioned-multisig";
import { getVersionedTestProgramId } from "./versioned-utils";
import { LAMPORTS_PER_SOL } from '@solana/web3.js';

const programId = getVersionedTestProgramId();
const connection = createLocalhostConnection();

describe("Versioned Multisig Creation", () => {
    let programConfig: ProgramConfig;
    let helper: VersionedMultisigTestHelper;

    before(async () => {
        console.log("programId", programId);
        // console.log("connection", connection);
        const programConfigPda = versionedMultisig.getProgramConfigPda({ programId })[0];
        programConfig = await versionedMultisig.accounts.ProgramConfig.fromAccountAddress(
            connection,
            programConfigPda
        );
        helper = new VersionedMultisigTestHelper(connection);
    });

    describe("Basic Creation", () => {
        it("Creates a versioned multisig with basic configuration", async () => {
            const members = helper.generateMembers(3);
            const threshold = 2;
            
            const { multisigPda } = await helper.createVersionedMultisig(
                members,
                threshold
            );

            const multisigAccount = await versionedMultisig.accounts.VersionedMultisig.fromAccountAddress(
                connection, 
                multisigPda
            );

            await helper.airdrop(members[0].key, 1 * LAMPORTS_PER_SOL);
            await helper.airdrop(members[1].key, 1 * LAMPORTS_PER_SOL);

            const {message, addressLookupTableAccounts} = await helper.createVersionedVaultSwapMessage(multisigPda, members[0].keyPair);
            console.log("addressLookupTableAccounts", addressLookupTableAccounts);
            const swapVault = await helper.createVersionedVaultTransactionWithMessage(multisigPda, members[0].keyPair, message, addressLookupTableAccounts, JSON.stringify({
                type:"Swap",
                inputMint: "So11111111111111111111111111111111111111112",
                outputMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
                amount: 1 * LAMPORTS_PER_SOL
            }));
            const { proposalPda } = await helper.createVersionedProposal(multisigPda, members[0].keyPair, 0);
            

        });



        });
});