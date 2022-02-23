import * as anchor from "@project-serum/anchor";
import { Idl, Provider, Wallet, Program } from "@project-serum/anchor";
import { SystemProgram, Connection, Keypair, PublicKey } from "@solana/web3.js";
import { BucketProgram } from "./types/bucket_program";
import { AccountUtils } from "./common/account_utils";
import { BUCKET_PROG_ID } from ".";
import {
  generateCrateAddress,
  CRATE_ADDRESSES,
} from "@crateprotocol/crate-sdk";

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
    bucketTokenAccount: PublicKey,
    programID: PublicKey = BUCKET_PROG_ID
  ): Promise<[PublicKey, number]> => {
    return this.findProgramAddress(programID, ["Bucket", bucketTokenAccount]);
  };

  generateIssueAuthority = async (programID: PublicKey = BUCKET_PROG_ID) => {
    return this.findProgramAddress(programID, ["Issue"]);
  };
  generateWithdrawAuthority = async (programID: PublicKey = BUCKET_PROG_ID) => {
    return this.findProgramAddress(programID, ["Withdraw"]);
  };

  createBucket = async (
    mintKP: Keypair,
    payer: PublicKey = this.provider.wallet.publicKey
  ) => {
    const [crateKey, crateBump] = await generateCrateAddress(mintKP.publicKey);
    const [bucketKey, bucketBump] = await this.generateBucketAddress(crateKey);
    const [issueAuthority, _issueBump] = await this.generateIssueAuthority();
    const [withdrawAuthority, _withdrawBump] =
      await this.generateWithdrawAuthority();
    const bucketTokenAccount = await this.findATA(mintKP.publicKey, bucketKey);
    const tx = await this.bucketProgram.rpc.createBucket(
      bucketBump,
      crateBump,
      {
        accounts: {
          bucketMint: mintKP.publicKey,
          payer,
          bucket: bucketKey,
          bucketTokenAccount,
          issueAuthority,
          withdrawAuthority,
          systemProgram: SystemProgram.programId,
          crateTokenProgram: CRATE_ADDRESSES.CrateToken,
        },
      }
    );
    console.log(tx);
  };
}
