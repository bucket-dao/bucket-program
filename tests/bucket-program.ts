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
  let userKeypair: Keypair;

  let mintKP: Keypair;

  let collateralMint: Keypair;

  const depositAmount = 1_000_000_000;

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
    expect(whitelist.length).to.equal(1);
    expect(whitelist[0].toBase58()).to.equal(
      collateralMint.publicKey.toBase58()
    );
  });

  it("Issue tokens", async () => {
    // fund depositor with sol
    userKeypair = await nodeWallet.createFundedWallet(1 * LAMPORTS_PER_SOL);

    // collateral mint associated token account of depositor
    const collateralATA = await client.getOrCreateATA(
      collateralMint.publicKey,
      userKeypair.publicKey,
      userKeypair.publicKey,
      client.provider.connection
    );

    // create collateral mint and fund depositor instruction
    const tx = new Transaction()
      .add(
        SystemProgram.createAccount({
          fromPubkey: userKeypair.publicKey,
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
          userKeypair.publicKey, // mintAuthority
          userKeypair.publicKey // freezeAuthority
        )
      )
      .add(collateralATA.instruction)
      .add(
        Token.createMintToInstruction(
          TOKEN_PROGRAM_ID,
          collateralMint.publicKey,
          collateralATA.address,
          userKeypair.publicKey,
          [],
          depositAmount
        )
      );

    await sendAndConfirmTransaction(client.provider.connection, tx, [
      userKeypair,
      collateralMint,
    ]);

    await client.deposit(
      depositAmount,
      mintKP,
      collateralMint.publicKey,
      bucketKey,
      crateKey,
      issueAuthority,
      userKeypair
    );
  });

  it("Redeem tokens", async () => {
    const withdrawAmount = depositAmount;

    const { collateralReserve, withdrawerSource, withdrawDestination } =
      await client.redeem(
        withdrawAmount,
        mintKP,
        collateralMint.publicKey,
        bucketKey,
        crateKey,
        withdrawAuthority,
        userKeypair
      );

    const postCollateralReserveBalance =
      await _provider.connection.getTokenAccountBalance(collateralReserve);
    const postBucketMintBalance =
      await _provider.connection.getTokenAccountBalance(withdrawerSource);
    const postCollateralBalance =
      await _provider.connection.getTokenAccountBalance(withdrawDestination);

    // CRATE COLLATERAL BALANCE
    // expect(+postCollateralReserveBalance.value.amount).to.equal(0);

    // USER CRATE MINT BALANCE
    expect(+postBucketMintBalance.value.amount).to.equal(0);

    // USER COLLATERAL BALANCE
    // expect(+postCollateralBalance.value.amount).to.equal(withdrawAmount);
  });
});
