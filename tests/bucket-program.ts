import * as anchor from "@project-serum/anchor";
import { MintLayout, Token, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import type { PublicKey } from "@solana/web3.js";
import {
  Keypair,
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import { expect } from "chai";

import { NodeWallet } from "../src/common/node-wallet";
import { BucketClient } from "../src/index";

describe("bucket-program", () => {
  const _provider = anchor.Provider.env();
  const client = new BucketClient(
    _provider.connection,
    _provider.wallet as anchor.Wallet
  );

  const nodeWallet = new NodeWallet(
    anchor.Provider.env().connection,
    anchor.Provider.env().wallet as anchor.Wallet
  );

  let bucketKey: PublicKey;
  let crateKey: PublicKey;
  let issueAuthority: PublicKey;
  let withdrawAuthority: PublicKey;
  let payer: Keypair;

  let mintKP: Keypair;

  let collateralMint: Keypair;

  // beforeEach does not work — results in address in use? probably w.r.t the issue/withdraw authorities.
  before(async () => {
    mintKP = Keypair.generate();
    payer = await nodeWallet.createFundedWallet(1 * LAMPORTS_PER_SOL);
    const {
      tx: _sig,
      bucket,
      crateToken,
      issueAuthority: _issueAuthority,
      withdrawAuthority: _withdrawAuthority,
    } = await client.createBucket(mintKP, payer);

    bucketKey = bucket;
    crateKey = crateToken;
    issueAuthority = _issueAuthority;
    withdrawAuthority = _withdrawAuthority;
  });

  it("Redeem tokens", () => {
    console.log("Redeem underlyings in exchange for bucket tokens");
  });

  it("Authorize collateral", async () => {
    collateralMint = Keypair.generate();

    const _tx = await client.authorizeCollateral(
      bucketKey,
      crateKey,
      payer,
      collateralMint
    );

    const bucket = await client.fetchBucket(bucketKey);
    const whitelist = bucket.whitelist as PublicKey[];
    expect(whitelist.length === 1);
    expect(whitelist[0] === collateralMint.publicKey);
  });

  it("Issue tokens", async () => {
    // fund depositor with sol
    const depositorKeypair = await nodeWallet.createFundedWallet(
      1 * LAMPORTS_PER_SOL
    );
    const collateralATA = await client.getOrCreateATA(
      collateralMint.publicKey,
      depositorKeypair.publicKey,
      depositorKeypair.publicKey,
      client.provider.connection
    );
    const balance = await client.getBalance(depositorKeypair.publicKey);
    console.log(balance);
    const tx = new Transaction()
      .add(
        SystemProgram.createAccount({
          fromPubkey: depositorKeypair.publicKey,
          newAccountPubkey: collateralMint.publicKey,
          space: MintLayout.span,
          lamports: await Token.getMinBalanceRentForExemptMint(
            client.provider.connection
          ),
          programId: TOKEN_PROGRAM_ID,
        })
      )
      .add(
        Token.createInitMintInstruction(
          TOKEN_PROGRAM_ID,
          collateralMint.publicKey,
          9,
          depositorKeypair.publicKey, // mintAuthority
          depositorKeypair.publicKey // freezeAuthority
        )
      )
      .add(collateralATA.instruction)
      .add(
        Token.createMintToInstruction(
          TOKEN_PROGRAM_ID,
          collateralMint.publicKey,
          collateralATA.address,
          depositorKeypair.publicKey,
          [],
          1_000_000_000
        )
      );

    await sendAndConfirmTransaction(client.provider.connection, tx, [
      depositorKeypair,
      collateralMint,
    ]);

    console.log("crateKey: ", crateKey.toString());

    await client.deposit(
      mintKP,
      collateralMint.publicKey,
      bucketKey,
      crateKey,
      issueAuthority,
      depositorKeypair
    );
  });
});
