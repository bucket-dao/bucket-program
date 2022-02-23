import * as anchor from "@project-serum/anchor";
import { Idl, Provider, Wallet, Program } from "@project-serum/anchor";
import { Connection, PublicKey } from "@solana/web3.js";
import { BucketProgram } from "./types/bucket_program";
import { AccountUtils } from "./common/account_utils";

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
            this.bucketProgram = anchor.workspace.BucketProgram as Program<BucketProgram>;
        }
    }

    createBucket() {
        console.log("hello, i'm a bucket");
    }
}
