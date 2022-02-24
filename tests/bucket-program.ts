import * as anchor from "@project-serum/anchor";
import { BN } from "@project-serum/anchor";
import { u64 } from "@solana/spl-token";
import type { PublicKey } from "@solana/web3.js";
import { Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { expect } from "chai";

import { NodeWallet } from "../src/common/node-wallet";
import { BucketClient } from "../src/index";
import { executeTx } from "./common/util";

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
  let reserve: Keypair;
  let collateral: Keypair;
  let depositorKeypair: Keypair;

  // beforeEach does not work — results in address in use. this happens b/c issue/withdraw authorities can only
  // be created once per program. add additional seeds to make more flexible.
  before(async () => {
    reserve = Keypair.generate();
    payer = await nodeWallet.createFundedWallet(1 * LAMPORTS_PER_SOL);
    const {
      tx: _sig,
      bucket,
      crateToken,
      issueAuthority: _issueAuthority,
      withdrawAuthority: _withdrawAuthority,
    } = await client.createBucket(reserve, payer);

    bucketKey = bucket;
    crateKey = crateToken;
    issueAuthority = _issueAuthority;
    withdrawAuthority = _withdrawAuthority;
  });

  it("Authorize collateral", async () => {
    collateral = Keypair.generate();

    const _tx = await client.authorizeCollateral(
      collateral.publicKey,
      bucketKey,
      crateKey,
      payer
    );

    const bucket = await client.fetchBucket(bucketKey);
    const whitelist = bucket.whitelist as PublicKey[];
    expect(whitelist.length).to.equal(1);
    expect(whitelist[0].toBase58()).to.equal(collateral.publicKey.toBase58());
  });

  it("User deposits collateral, issue reserve tokens", async () => {
    depositorKeypair = await nodeWallet.createFundedWallet(
      1 * LAMPORTS_PER_SOL
    );

    // mint collateral and fund depositor ATA with collateral
    await executeTx(
      client.provider.connection,
      await client.mintTokens(
        client.provider.connection,
        depositorKeypair.publicKey,
        collateral.publicKey,
        depositorKeypair.publicKey,
        depositorKeypair.publicKey
      ),
      [depositorKeypair, collateral]
    );

    const depositAmount = new u64(1_000_000);
    await executeTx(
      client.provider.connection,
      await client.initTokenAccount(
        client.provider.connection,
        collateral.publicKey,
        depositorKeypair.publicKey,
        depositorKeypair.publicKey,
        depositAmount
      ),
      [depositorKeypair]
    );

    // fetch depositor ATA balance before deposit
    const depositorCollateralBefore = await client.fetchTokenBalance(
      collateral.publicKey,
      depositorKeypair.publicKey
    );
    expect(depositorCollateralBefore).to.equal(depositAmount.toNumber());

    // execute smart-contract rpc call
    await client.deposit(
      depositAmount,
      reserve.publicKey,
      collateral.publicKey,
      bucketKey,
      crateKey,
      issueAuthority,
      depositorKeypair
    );

    // fetch depositor & crate ATA balances after deposit
    const crateCollateralAfter = await client.fetchTokenBalance(
      collateral.publicKey,
      crateKey
    );
    expect(crateCollateralAfter).to.equal(depositAmount.toNumber());

    const depositorCollateralAfter = await client.fetchTokenBalance(
      collateral.publicKey,
      depositorKeypair.publicKey
    );
    expect(depositorCollateralAfter).to.equal(
      depositorCollateralBefore - depositAmount.toNumber()
    );
  });

  it("Redeem tokens", async () => {
    const depositorReserveAmount = await client.fetchTokenBalance(
      reserve.publicKey,
      depositorKeypair.publicKey
    );

    const redeemAmount = new BN(depositorReserveAmount);
    await client.redeem(
      redeemAmount,
      reserve.publicKey,
      collateral.publicKey,
      bucketKey,
      crateKey,
      withdrawAuthority,
      depositorKeypair
    );
    const userReserveAfter = await client.fetchTokenBalance(
      collateral.publicKey,
      depositorKeypair.publicKey
    );
    expect(userReserveAfter).to.equal(0);

    // verify other token accounts
  });
});
