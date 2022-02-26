import {
  CRATE_ADDRESSES,
  generateCrateAddress,
} from "@crateprotocol/crate-sdk";
import * as anchor from "@project-serum/anchor";
import { Program, Provider, Idl, Wallet } from "@project-serum/anchor";
import { u64 } from "@solana/spl-token";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import {
  AccountMeta,
  Connection,
  Keypair,
  PublicKey,
  TransactionInstruction,
  SystemProgram
} from "@solana/web3.js";
import invariant from "tiny-invariant";

import { AccountUtils } from "./common/account-utils";
import { SignerInfo } from "./common/types";
import { addIxn, getSignersFromPayer } from "./common/util";
import { BucketProgram } from "./types/bucket_program";

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
    amount: u64,
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
      crate,
      signerInfo.payer,
      this.provider.connection
    );

    return this.bucketProgram.rpc.deposit(amount, {
      accounts: {
        common: {
          bucket: bucket,
          crateToken: crate,
          crateMint: reserve,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          crateTokenProgram: CRATE_ADDRESSES.CrateToken,
        },
        issueAuthority: issueAuthority,
        crateCollateral: crateCollateralATA.address,
        depositor: signerInfo.payer,
        depositorCollateral: depsitorCollateralATA.address,
        depositorReserve: depositorReserveATA.address,
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
    amount: u64,
    reserve: PublicKey,
    collateralTokens: PublicKey[],
    bucket: PublicKey,
    crate: PublicKey,
    withdrawAuthority: PublicKey,
    withdrawer: PublicKey | Keypair
  ) => {
    const signerInfo = getSignersFromPayer(withdrawer);

    // these instructions ensure ATAs exist before transferring tokens to these
    // accounts. otherwise, transaction will fail. it's possible that too many ixns
    // packed into the same tx can result in tx failure.
    const createATAInstructions: TransactionInstruction[] = [];
    const withdrawerReserveATA = await this.getOrCreateATA(
      reserve,
      signerInfo.payer,
      signerInfo.payer,
      this.provider.connection
    );
    addIxn(withdrawerReserveATA.instruction, createATAInstructions);

    const ownerATAs = await this.getOrCreateATAs(
      collateralTokens,
      signerInfo.payer,
      signerInfo.payer,
      this.provider.connection
    );
    ownerATAs.instructions.forEach((ixn) => addIxn(ixn, createATAInstructions));

    const crateATAs = await this.getOrCreateATAs(
      collateralTokens,
      crate,
      signerInfo.payer,
      this.provider.connection
    );
    crateATAs.instructions.forEach((ixn) => addIxn(ixn, createATAInstructions));

    const remainingAccountKeys = ((): PublicKey[] => {
      // no withdraw or protocol fees for now. refactor later to
      // include more robust fee distribution.
      return collateralTokens.flatMap((token) => {
        const tokenAddress = token.toBase58();

        const crateATA = (crateATAs.addresses as Record<string, PublicKey>)[
          tokenAddress
        ];
        const ownerATA = (ownerATAs.addresses as Record<string, PublicKey>)[
          tokenAddress
        ];

        invariant(ownerATA && crateATA, "missing ATA");

        // use owner ATAs for the fees, since there are no fees
        return [crateATA, ownerATA, ownerATA, ownerATA];
      });
    })();

    const remainingAccounts = remainingAccountKeys.map(
      (acc): AccountMeta => ({
        pubkey: acc,
        isSigner: false,
        isWritable: true,
      })
    );

    return this.bucketProgram.rpc.redeem(amount, {
      accounts: {
        common: {
          bucket: bucket,
          crateToken: crate,
          crateMint: reserve,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          crateTokenProgram: CRATE_ADDRESSES.CrateToken,
        },
        withdrawAuthority: withdrawAuthority,
        withdrawer: signerInfo.payer,
        withdrawerReserve: withdrawerReserveATA.address,
      },
      remainingAccounts,
      preInstructions: createATAInstructions,
      signers: signerInfo.signers,
    });
  };
}
