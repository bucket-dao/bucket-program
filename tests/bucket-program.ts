import * as anchor from "@project-serum/anchor";
import { u64 } from "@solana/spl-token";
import { Keypair, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { expect } from "chai";

import { NodeWallet } from "../sdk/src/common/node-wallet";
import { BucketClient } from "../sdk/src/index";
import { TokenBalance } from "./common/util";
import { executeTx, expectThrowsAsync } from "./common/util";

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
  let authority: Keypair;
  let reserve: Keypair;

  let collateralA: Keypair;
  let collateralB: Keypair;
  let collateralC: Keypair;

  let userA: Keypair;
  let userB: Keypair;
  let userC: Keypair;

  before("Create funded user accounts", async () => {
    authority = await nodeWallet.createFundedWallet(1 * LAMPORTS_PER_SOL);
    userA = await nodeWallet.createFundedWallet(1 * LAMPORTS_PER_SOL);
    userB = await nodeWallet.createFundedWallet(1 * LAMPORTS_PER_SOL);
    userC = await nodeWallet.createFundedWallet(1 * LAMPORTS_PER_SOL);
  });

  // beforeEach does not work — results in address in use. this happens b/c issue/withdraw authorities can only
  // be created once per program. add additional seeds to make more flexible.
  before("Create bucket", async () => {
    reserve = Keypair.generate();
    const {
      tx: _sig,
      bucket,
      crateToken,
      issueAuthority: _issueAuthority,
      withdrawAuthority: _withdrawAuthority,
    } = await client.createBucket(reserve, authority);

    bucketKey = bucket;
    crateKey = crateToken;
    issueAuthority = _issueAuthority;
    withdrawAuthority = _withdrawAuthority;
  });

  before("Mint collateral A, B, C", async () => {
    collateralA = Keypair.generate();
    collateralB = Keypair.generate();
    collateralC = Keypair.generate();

    // mint collateral A
    await executeTx(
      client.provider.connection,
      await client.mintTokens(
        client.provider.connection,
        authority.publicKey,
        collateralA.publicKey,
        authority.publicKey,
        authority.publicKey
      ),
      [authority, collateralA]
    );

    // mint collateral B
    await executeTx(
      client.provider.connection,
      await client.mintTokens(
        client.provider.connection,
        authority.publicKey,
        collateralB.publicKey,
        authority.publicKey,
        authority.publicKey
      ),
      [authority, collateralB]
    );

    // mint collateral C
    await executeTx(
      client.provider.connection,
      await client.mintTokens(
        client.provider.connection,
        authority.publicKey,
        collateralC.publicKey,
        authority.publicKey,
        authority.publicKey
      ),
      [authority, collateralC]
    );
  });

  before("Fund users' accounts with some of each collateral", async () => {
    const fundingAmount = new u64(1_000_000);

    for (const user of [userA, userB, userC]) {
      for (const collateral of [collateralA, collateralB, collateralC]) {
        console.log(
          `Funding [${user.publicKey.toBase58()}] with ${fundingAmount.toNumber()} of ${collateral.publicKey.toBase58()}`
        );

        await executeTx(
          client.provider.connection,
          await client.initTokenAccount(
            client.provider.connection,
            collateral.publicKey,
            user.publicKey,
            authority.publicKey,
            fundingAmount
          ),
          [user, authority]
        );
      }
    }
  });

  it("User attempts to deposit unauthorized collateral", () => {
    const depositAmount = new u64(1_000_000);
    expectThrowsAsync(() =>
      client.deposit(
        depositAmount,
        reserve.publicKey,
        collateralA.publicKey,
        bucketKey,
        crateKey,
        issueAuthority,
        userA
      )
    ).catch((err: Error) => console.log("err: ", err.message)); // make ts happy
  });

  it("Authorize all collateral mints", async () => {
    // authorize collateral A
    await client.authorizeCollateral(
      collateralA.publicKey,
      bucketKey,
      crateKey,
      authority
    );

    // verify whitelist now has 1 collateral mint
    let bucket = await client.fetchBucket(bucketKey);
    let whitelist = bucket.whitelist as PublicKey[];

    expect(whitelist.length).to.equal(1);
    expect(whitelist[0].toBase58()).to.equal(collateralA.publicKey.toBase58());

    // authorize collateral B
    await client.authorizeCollateral(
      collateralB.publicKey,
      bucketKey,
      crateKey,
      authority
    );

    // verify whitelist now has 2 collateral mints
    bucket = await client.fetchBucket(bucketKey);
    whitelist = bucket.whitelist as PublicKey[];

    expect(whitelist.length).to.equal(2);
    expect(whitelist[1].toBase58()).to.equal(collateralB.publicKey.toBase58());

    // authorize collateral C
    await client.authorizeCollateral(
      collateralC.publicKey,
      bucketKey,
      crateKey,
      authority
    );

    // verify whitelist now has 3 collateral mints
    bucket = await client.fetchBucket(bucketKey);
    whitelist = bucket.whitelist as PublicKey[];

    expect(whitelist.length).to.equal(3);
    expect(whitelist[2].toBase58()).to.equal(collateralC.publicKey.toBase58());
  });

  it("User A deposits authorized collateral A, issue reserve tokens", async () => {
    // mint collateral and fund depositor ATA with collateral
    const depositAmount = new u64(1_000_000);

    // fetch depositor ATA balance before deposit
    const depositorCollateralBefore = await client.fetchTokenBalance(
      collateralA.publicKey,
      userA.publicKey
    );
    expect(depositorCollateralBefore).to.equal(depositAmount.toNumber());

    // execute smart-contract rpc call
    await client.deposit(
      depositAmount,
      reserve.publicKey,
      collateralA.publicKey,
      bucketKey,
      crateKey,
      issueAuthority,
      userA
    );

    // fetch depositor & crate ATA balances after deposit
    const depositorReserveAfter = await client.fetchTokenBalance(
      reserve.publicKey,
      userA.publicKey
    );
    const depositorCollateralAfter = await client.fetchTokenBalance(
      collateralA.publicKey,
      userA.publicKey
    );

    const crateCollateralAfter = await client.fetchTokenBalance(
      collateralA.publicKey,
      crateKey
    );

    expect(depositorReserveAfter).to.equal(depositAmount.toNumber());
    expect(depositorCollateralAfter).to.equal(
      depositorCollateralBefore - depositAmount.toNumber()
    );
    expect(crateCollateralAfter).to.equal(depositAmount.toNumber());
  });

  it("User B, C deposits authorized collateral B, C, issue reserve tokens", async () => {
    // mint collateral and fund depositor ATA with collateral
    const depositAmount = new u64(1_000_000);

    // ==================================================================
    // collateral B checks & rpc call
    // ==================================================================

    // fetch depositor ATA balance before deposit
    const userBCollateralBefore = await client.fetchTokenBalance(
      collateralB.publicKey,
      userB.publicKey
    );
    expect(userBCollateralBefore).to.equal(depositAmount.toNumber());

    // user B deposits collateral B
    await client.deposit(
      depositAmount,
      reserve.publicKey,
      collateralB.publicKey,
      bucketKey,
      crateKey,
      issueAuthority,
      userB
    );

    // fetch user B & crate ATA balances for collateral B after deposit
    const userBReserveAfter = await client.fetchTokenBalance(
      reserve.publicKey,
      userB.publicKey
    );
    const userBCollateralAfter = await client.fetchTokenBalance(
      collateralB.publicKey,
      userB.publicKey
    );

    const crateCollateralBAfter = await client.fetchTokenBalance(
      collateralB.publicKey,
      crateKey
    );

    expect(userBReserveAfter).to.equal(depositAmount.toNumber());
    expect(userBCollateralAfter).to.equal(
      userBCollateralBefore - depositAmount.toNumber()
    );
    expect(crateCollateralBAfter).to.equal(depositAmount.toNumber());

    // ==================================================================
    // collateral C checks & rpc call
    // ==================================================================

    const userCCollateralBefore = await client.fetchTokenBalance(
      collateralC.publicKey,
      userC.publicKey
    );
    expect(userCCollateralBefore).to.equal(depositAmount.toNumber());

    // user C deposits collateral C
    await client.deposit(
      depositAmount,
      reserve.publicKey,
      collateralC.publicKey,
      bucketKey,
      crateKey,
      issueAuthority,
      userC
    );

    // fetch user B & crate ATA balances for collateral B after deposit
    const userCReserveAfter = await client.fetchTokenBalance(
      reserve.publicKey,
      userC.publicKey
    );

    const userCCollateralAfter = await client.fetchTokenBalance(
      collateralC.publicKey,
      userC.publicKey
    );

    const crateCollateralCAfter = await client.fetchTokenBalance(
      collateralC.publicKey,
      crateKey
    );

    expect(userCReserveAfter).to.equal(depositAmount.toNumber());
    expect(userCCollateralAfter).to.equal(
      userCCollateralBefore - depositAmount.toNumber()
    );
    expect(crateCollateralCAfter).to.equal(depositAmount.toNumber());
  });

  it("Redeem tokens", async () => {
    const tokenBalances: { [mint: string]: TokenBalance } = {};

    // fetch number of redeemable reserve tokens
    const userAReserveBefore = await client.fetchTokenBalance(
      reserve.publicKey,
      userA.publicKey
    );

    for (const collateral of [collateralA, collateralB, collateralC]) {
      const collateralPublicKey = collateral.publicKey;

      const userCollateralAmount = await client.fetchTokenBalance(
        collateralPublicKey,
        userA.publicKey
      );

      // previously deposited amount
      if (collateralPublicKey.toBase58() === collateralA.publicKey.toBase58()) {
        expect(userCollateralAmount).to.equal(0);
      }

      tokenBalances[collateralPublicKey.toBase58()] = {
        mint: collateralPublicKey,
        before: userCollateralAmount,
        after: 0,
      };
    }

    const redeemAmount = new u64(userAReserveBefore);
    await client.redeem(
      redeemAmount,
      reserve.publicKey,
      [collateralA.publicKey, collateralB.publicKey, collateralC.publicKey],
      bucketKey,
      crateKey,
      withdrawAuthority,
      userA
    );

    // fetch withdrawer & crate ATA balances after redeem
    const userAReserveAfter = await client.fetchTokenBalance(
      reserve.publicKey,
      userA.publicKey
    );
    expect(userAReserveAfter).to.equal(0);

    // assuming equal collateral shares for all 3 collateral mints.
    // these numbers will change if relative collateral changes.
    const collateralShare = Math.round(redeemAmount.toNumber() / 3);

    for (const collateral of [collateralA, collateralB, collateralC]) {
      const collateralPublicKey = collateral.publicKey;

      const userCollateralAmount = await client.fetchTokenBalance(
        collateralPublicKey,
        userA.publicKey
      );

      expect(userCollateralAmount).to.equal(
        tokenBalances[collateralPublicKey.toBase58()].before + collateralShare
      );
    }
  });
});
