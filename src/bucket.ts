import {
  CRATE_ADDRESSES,
  generateCrateAddress,
} from "@crateprotocol/crate-sdk";
import type { BN, Idl, Wallet } from "@project-serum/anchor";
import * as anchor from "@project-serum/anchor";
import { Program, Provider } from "@project-serum/anchor";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import type { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { SystemProgram } from "@solana/web3.js";

import { AccountUtils } from "./common/account-utils";
import type { SignerInfo } from "./common/util";
import { getSignersFromPayer } from "./common/util";
import type { BucketProgram } from "./types/bucket_program";

export class BucketClient extends AccountUtils {
  wallet: Wallet;
  provider!: Provider;
  bucketProgram!: Program<BucketProgram>;

  constructor(
    conn: Connection,
    wallet: anchor.Wallet,
    idl?: Idl,
    programId?: PublicKey
  ) {
    super(conn);
    this.wallet = wallet;
    this.setProvider();
    this.setBucketProgram(idl, programId);
  }

  setProvider = () => {
    this.provider = new Provider(
      this.conn,
      this.wallet,
      Provider.defaultOptions()
    );
    anchor.setProvider(this.provider);
  };

  setBucketProgram = (idl?: Idl, programId?: PublicKey) => {
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
      this.bucketProgram = anchor.workspace
        .BucketProgram as Program<BucketProgram>;
    }
  };

  // ================================================
  // PDAs
  // ================================================

  generateBucketAddress = async (
    mint: PublicKey,
    programID: PublicKey = this.bucketProgram.programId
  ): Promise<[PublicKey, number]> => {
    return this.findProgramAddress(programID, ["bucket", mint]);
  };

  generateIssueAuthority = async (
    programID: PublicKey = this.bucketProgram.programId
  ) => {
    return this.findProgramAddress(programID, ["issue"]);
  };

  generateWithdrawAuthority = async (
    programID: PublicKey = this.bucketProgram.programId
  ) => {
    return this.findProgramAddress(programID, ["withdraw"]);
  };

  // ================================================
  // Fetch & deserialize objects
  // ================================================

  fetchBucket = async (bucket: PublicKey) => {
    return this.bucketProgram.account.bucket.fetch(bucket);
  };

  // ================================================
  // Fetch token account balanaces
  // ================================================

  fetchTokenBalance = async (
    mint: PublicKey,
    owner: PublicKey
  ): Promise<number> => {
    const addr = await this.findAssociatedTokenAddress(owner, mint);
    const tokenBalance = await this.getTokenBalance(addr);

    return +tokenBalance["value"]["amount"];
  };

  // ================================================
  // Smart contract function helpers
  // ================================================

  createBucket = async (
    mint: Keypair,
    payer: PublicKey | Keypair,
    decimals = 6
  ) => {
    const [crate, crateBump] = await generateCrateAddress(mint.publicKey);
    const [bucket, bucketBump] = await this.generateBucketAddress(crate);
    const [issueAuthority, issueBump] = await this.generateIssueAuthority();
    const [withdrawAuthority, withdrawBump] =
      await this.generateWithdrawAuthority();

    const signerInfo = getSignersFromPayer(payer);
    const crateATA = await this.getOrCreateATA(
      mint.publicKey,
      crate,
      signerInfo.payer,
      this.provider.connection
    );

    const accounts = {
      crateMint: mint.publicKey,
      payer: signerInfo.payer,
      bucket: bucket,
      crateToken: crate,
      issueAuthority,
      withdrawAuthority,
      systemProgram: SystemProgram.programId,
      crateTokenProgram: CRATE_ADDRESSES.CrateToken,
    };

    const tx = await this.bucketProgram.rpc.createBucket(
      bucketBump,
      crateBump,
      issueBump,
      withdrawBump,
      {
        accounts,
        preInstructions: [
          ...(await this.mintTokens(
            this.provider.connection,
            signerInfo.payer,
            mint.publicKey,
            crate,
            crate,
            decimals
          )),
          ...(crateATA.instruction ? [crateATA.instruction] : []),
        ],
        signers: [mint, ...signerInfo.signers],
      }
    );

    return { tx, ...accounts };
  };

  authorizeCollateral = async (
    collateral: PublicKey,
    bucket: PublicKey,
    crate: PublicKey,
    payer: PublicKey | Keypair
  ) => {
    const signerInfo: SignerInfo = getSignersFromPayer(payer);
    return this.bucketProgram.rpc.authorizeCollateral(collateral, {
      accounts: {
        bucket,
        crateToken: crate,
        authority: signerInfo.payer,
      },
      signers: [...signerInfo.signers],
    });
  };

  deposit = async (
    amount: BN,
    reserve: PublicKey,
    collateral: PublicKey,
    bucket: PublicKey,
    crate: PublicKey,
    issueAuthority: PublicKey,
    depositor: PublicKey | Keypair
  ) => {
    const signerInfo = getSignersFromPayer(depositor);

    const depsitorCollateralATA = await this.getOrCreateATA(
      collateral,
      signerInfo.payer,
      signerInfo.payer,
      this.provider.connection
    );

    const depositorReserveATA = await this.getOrCreateATA(
      reserve,
      signerInfo.payer,
      signerInfo.payer,
      this.provider.connection
    );

    const crateCollateralATA = await this.getOrCreateATA(
      collateral,
      crate, // or, bucket?
      signerInfo.payer,
      this.provider.connection
    );

    return this.bucketProgram.rpc.deposit(amount, {
      accounts: {
        bucket,
        crateToken: crate,
        crateMint: reserve,
        collateralReserve: crateCollateralATA.address,
        depositor: signerInfo.payer,
        depositorSource: depsitorCollateralATA.address,
        mintDestination: depositorReserveATA.address,
        issueAuthority: issueAuthority,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        crateTokenProgram: CRATE_ADDRESSES.CrateToken,
      },
      preInstructions: [
        ...(depsitorCollateralATA.instruction
          ? [depsitorCollateralATA.instruction]
          : []),
        ...(depositorReserveATA.instruction
          ? [depositorReserveATA.instruction]
          : []),
        ...(crateCollateralATA.instruction
          ? [crateCollateralATA.instruction]
          : []),
      ],
      signers: signerInfo.signers,
    });
  };

  redeem = async (
    amount: BN,
    reserve: PublicKey,
    collateral: PublicKey,
    bucket: PublicKey,
    crate: PublicKey,
    withdrawAuthority: PublicKey,
    withdrawer: PublicKey | Keypair
  ) => {
    const signerInfo = getSignersFromPayer(withdrawer);

    const withdrawerReserveATA = await this.getOrCreateATA(
      reserve,
      signerInfo.payer,
      signerInfo.payer,
      this.provider.connection
    );

    // move to extra accounts when withdrawing multiple collateral mints
    const withdrawerCollateralATA = await this.getOrCreateATA(
      collateral,
      signerInfo.payer,
      signerInfo.payer,
      this.provider.connection
    );

    const crateCollateralATA = await this.getOrCreateATA(
      collateral,
      crate,
      signerInfo.payer,
      this.provider.connection
    );

    return this.bucketProgram.rpc.redeem(amount, {
      accounts: {
        bucket: bucket,
        crateToken: crate,
        crateMint: reserve,
        collateralReserve: crateCollateralATA.address,
        withdrawer: signerInfo.payer,
        withdrawerSource: withdrawerReserveATA.address,
        withdrawDestination: withdrawerCollateralATA.address,
        withdrawAuthority: withdrawAuthority,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        crateTokenProgram: CRATE_ADDRESSES.CrateToken,
      },
      preInstructions: [
        ...(withdrawerReserveATA.instruction
          ? [withdrawerReserveATA.instruction]
          : []),
        ...(withdrawerCollateralATA.instruction
          ? [withdrawerCollateralATA.instruction]
          : []),
        ...(crateCollateralATA.instruction
          ? [crateCollateralATA.instruction]
          : []),
      ],
      signers: signerInfo.signers,
    });
  };
}
