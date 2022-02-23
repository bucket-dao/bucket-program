import * as anchor from "@project-serum/anchor";
import { Idl, Provider, Wallet, Program } from "@project-serum/anchor";
import {
    SystemProgram,
    Connection,
    Keypair,
    PublicKey,
} from "@solana/web3.js";
import { MintLayout, Token, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import {
    generateCrateAddress,
    CRATE_ADDRESSES,
} from "@crateprotocol/crate-sdk";

import { BucketProgram } from "./types/bucket_program";
import { AccountUtils } from "./common/account-utils";
import { getSignersFromPayer } from './common/util';

export class BucketClient extends AccountUtils {
    wallet: Wallet;
    provider!: Provider;
    bucketProgram!: Program<BucketProgram>;

    constructor(
        conn: Connection,
        // @ts-ignore
        wallet: anchor.Wallet,
        idl?: Idl,
        programId?: PublicKey
    ) {
        super(conn);
        this.wallet = wallet;
        this.setProvider();
        this.setBucketProgram(idl, programId);
    }

    setProvider() {
        this.provider = new Provider(
            this.conn,
            this.wallet,
            Provider.defaultOptions()
        );
        anchor.setProvider(this.provider);
    }

    setBucketProgram(idl?: Idl, programId?: PublicKey) {
        // instantiating program depends on the environment
        if (idl && programId) {
            // means running in prod
            this.bucketProgram = new Program<BucketProgram>(
                idl as any,
                programId,
                this.provider
            );
        } else {
            // means running inside test suite
            // @ts-ignore
            this.bucketProgram = anchor.workspace
                .BucketProgram as Program<BucketProgram>;
        }
    }

    generateBucketAddress = async (
        mint: PublicKey,
        programID: PublicKey = this.bucketProgram.programId
    ): Promise<[PublicKey, number]> => {
        return this.findProgramAddress(programID, ["Bucket", mint]);
    };

    generateIssueAuthority = async (programID: PublicKey = this.bucketProgram.programId) => {
        return this.findProgramAddress(programID, ["Issue"]);
    };

    generateWithdrawAuthority = async (
        programID: PublicKey = this.bucketProgram.programId
    ) => {
        return this.findProgramAddress(programID, ["Withdraw"]);
    };

    createBucket = async (
        mint: Keypair,
        payer: PublicKey | Keypair,
        decimals: number = 9
    ) => {
        const [crateKey, crateBump] = await generateCrateAddress(
            mint.publicKey
        );
        const [bucketKey, bucketBump] = await this.generateBucketAddress(
            crateKey
        );
        const [issueAuthority, _issueBump] =
            await this.generateIssueAuthority();
        const [withdrawAuthority, _withdrawBump] =
            await this.generateWithdrawAuthority();

        const signerInfo = getSignersFromPayer(payer);
        const crateATA = await this.getOrCreateATA(
            mint.publicKey,
            crateKey,
            signerInfo.payer,
            this.provider.connection
        );

        return this.bucketProgram.rpc.createBucket(bucketBump, crateBump, {
            accounts: {
                crateMint: mint.publicKey,
                payer: signerInfo.payer,
                bucket: bucketKey,
                crateToken: crateKey,
                issueAuthority,
                withdrawAuthority,
                systemProgram: SystemProgram.programId,
                crateTokenProgram: CRATE_ADDRESSES.CrateToken,
            },
            preInstructions: [
                SystemProgram.createAccount({
                    fromPubkey: signerInfo.payer,
                    newAccountPubkey: mint.publicKey,
                    space: MintLayout.span,
                    lamports: await Token.getMinBalanceRentForExemptMint(
                        this.provider.connection
                    ),
                    programId: TOKEN_PROGRAM_ID,
                }),
                Token.createInitMintInstruction(
                    TOKEN_PROGRAM_ID,
                    mint.publicKey,
                    decimals,
                    crateKey, // mintAuthority
                    crateKey  // freezeAuthority
                ),
                ...(crateATA.instruction ? [crateATA.instruction] : []),
            ],
            signers: [mint, ...signerInfo.signers],
        });
    };
}
