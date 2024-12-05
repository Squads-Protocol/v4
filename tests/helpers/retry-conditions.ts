import { PublicKey, Keypair, SystemProgram, Transaction } from "@solana/web3.js";
import { Token, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { Program, Provider } from "@project-serum/anchor";
import { SquadsMultisigProgram } from "../../target/types/squads_multisig_program";

export enum RetryScenario {
    InsufficientFunds,
    AccountNotInitialized,
    TokenAccountNotCreated,
    RentExemption,
}

export class RetryConditionManager {
    private tempState: {
        tokenMint?: Token;
        tokenAccount?: PublicKey;
        rentPayer?: Keypair;
    } = {};

    constructor(
        private program: Program<SquadsMultisigProgram>,
        private provider: Provider
    ) {}

    async setupConditions(scenario: RetryScenario) {
        switch (scenario) {
            case RetryScenario.InsufficientFunds:
                return this.setupFundingConditions();
            case RetryScenario.AccountNotInitialized:
                return this.setupAccountInitialization();
            case RetryScenario.TokenAccountNotCreated:
                return this.setupTokenAccount();
            case RetryScenario.RentExemption:
                return this.setupRentExemption();
            default:
                throw new Error("Unsupported retry scenario");
        }
    }

    async createRetryableInstruction(scenario: RetryScenario) {
        switch (scenario) {
            case RetryScenario.InsufficientFunds:
                return this.createInsufficientFundsInstruction();
            case RetryScenario.TokenAccountNotCreated:
                return this.createTokenAccountInstruction();
            default:
                throw new Error("Unsupported retry scenario");
        }
    }

    private async setupFundingConditions() {
        const rentPayer = Keypair.generate();
        const signature = await this.provider.connection.requestAirdrop(
            rentPayer.publicKey,
            2 * LAMPORTS_PER_SOL
        );
        await this.provider.connection.confirmTransaction(signature);
        this.tempState.rentPayer = rentPayer;
        return rentPayer;
    }

    private async setupAccountInitialization() {
        const space = 1000;
        const rentExemption = await this.provider.connection.getMinimumBalanceForRentExemption(space);
        
        const newAccount = Keypair.generate();
        const transaction = new Transaction().add(
            SystemProgram.createAccount({
                fromPubkey: this.provider.wallet.publicKey,
                newAccountPubkey: newAccount.publicKey,
                lamports: rentExemption,
                space,
                programId: this.program.programId,
            })
        );

        await this.provider.sendAndConfirm(transaction, [newAccount]);
        this.tempState.rentPayer = newAccount;
        return newAccount;
    }

    private async setupTokenAccount() {
        const mintAuthority = Keypair.generate();
        const decimals = 9;

        this.tempState.tokenMint = await Token.createMint(
            this.provider.connection,
            mintAuthority,
            mintAuthority.publicKey,
            null,
            decimals,
            TOKEN_PROGRAM_ID
        );

        this.tempState.tokenAccount = await this.tempState.tokenMint.createAccount(
            this.provider.wallet.publicKey
        );

        await this.tempState.tokenMint.mintTo(
            this.tempState.tokenAccount,
            mintAuthority,
            [],
            1000000000
        );

        return {
            mint: this.tempState.tokenMint,
            account: this.tempState.tokenAccount
        };
    }

    private async setupRentExemption() {
        const rentPayer = Keypair.generate();
        const signature = await this.provider.connection.requestAirdrop(
            rentPayer.publicKey,
            LAMPORTS_PER_SOL
        );
        await this.provider.connection.confirmTransaction(signature);
        this.tempState.rentPayer = rentPayer;
        return rentPayer;
    }

    private createInsufficientFundsInstruction() {
        if (!this.tempState.rentPayer) {
            throw new Error("Setup funding conditions first");
        }

        return SystemProgram.transfer({
            fromPubkey: this.tempState.rentPayer.publicKey,
            toPubkey: Keypair.generate().publicKey,
            lamports: LAMPORTS_PER_SOL
        });
    }

    private createTokenAccountInstruction() {
        if (!this.tempState.tokenAccount) {
            throw new Error("Setup token account first");
        }

        return Token.createTransferInstruction(
            TOKEN_PROGRAM_ID,
            this.tempState.tokenAccount,
            Keypair.generate().publicKey,
            this.provider.wallet.publicKey,
            [],
            100
        );
    }

    cleanup() {
        this.tempState = {};
    }
} 