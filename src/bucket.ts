import {
  CRATE_ADDRESSES,
  generateCrateAddress,
} from "@crateprotocol/crate-sdk";
import type { Idl, Wallet } from "@project-serum/anchor";
import * as anchor from "@project-serum/anchor";
import { Program, Provider } from "@project-serum/anchor";
import { MintLayout, Token, TOKEN_PROGRAM_ID } from "@solana/spl-token";
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

  fetchBucket = async (bucketKey: PublicKey) => {
    return this.bucketProgram.account.bucket.fetch(bucketKey);
  };

  // ================================================
  // Smart contract function helpers
  // ================================================

  createBucket = async (
    mint: Keypair,
    payer: PublicKey | Keypair,
    decimals = 9
  ) => {
    const [crateKey, crateBump] = await generateCrateAddress(mint.publicKey);
    const [bucketKey, bucketBump] = await this.generateBucketAddress(crateKey);
    const [issueAuthority, _issueBump] = await this.generateIssueAuthority();
    const [withdrawAuthority, _withdrawBump] =
      await this.generateWithdrawAuthority();

    const signerInfo = getSignersFromPayer(payer);
    const crateATA = await this.getOrCreateATA(
      mint.publicKey,
      crateKey,
      signerInfo.payer,
      this.provider.connection
    );
    const accounts = {
      crateMint: mint.publicKey,
      payer: signerInfo.payer,
      bucket: bucketKey,
      crateToken: crateKey,
      issueAuthority,
      withdrawAuthority,
      systemProgram: SystemProgram.programId,
      crateTokenProgram: CRATE_ADDRESSES.CrateToken,
    };

    const tx = await this.bucketProgram.rpc.createBucket(
      bucketBump,
      crateBump,
      {
        accounts,
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
            crateKey // freezeAuthority
          ),
          ...(crateATA.instruction ? [crateATA.instruction] : []),
        ],
        signers: [mint, ...signerInfo.signers],
      }
    );

    return { tx, ...accounts };
  };

  authorizeCollateral = async (
    bucketKey: PublicKey,
    crateKey: PublicKey,
    payer,
    mint: Keypair
  ) => {
    const signerInfo: SignerInfo = getSignersFromPayer(payer);
    return this.bucketProgram.rpc.authorizeCollateral(mint.publicKey, {
      accounts: {
        bucket: bucketKey,
        crateToken: crateKey,
        authority: payer.publicKey as PublicKey,
      },
      signers: [...signerInfo.signers],
    });
  };
}
