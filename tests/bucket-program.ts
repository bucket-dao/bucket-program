import * as anchor from "@project-serum/anchor";
import { u64 } from "@solana/spl-token";
import { Keypair, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { expect } from "chai";

import { BucketClient, Collateral, executeTx, NodeWallet } from "../sdk";
import { TokenBalance } from "./common/util";
import { expectThrowsAsync } from "./common/util";
import { mockOracle } from "./common/testHelpers";

// add test when collateral decimals is different mint than others
// add set_collateral_allocations
// add tests around auth collateral... sufficient?
// due to account constraints, we cannot get to the point
//  - where per-collateral share is 1 bps. however, if so, max
//    collateral in a pool would be 10000.

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

  it("Update rebalance authority", async () => {
    const { bucket: bucketBefore } = await client.fetchBucket(bucketKey);

    const rebalanceAuthority = Keypair.generate().publicKey;
    await client.updateRebalanceAuthority(
      reserve.publicKey,
      rebalanceAuthority,
      authority
    );

    const { bucket: bucketAfter } = await client.fetchBucket(bucketKey);
    console.log('auth: ', bucketBefore.rebalanceAuthority.toBase58());
    console.log('auth: ', bucketAfter.rebalanceAuthority.toBase58());

    expect(bucketBefore.rebalanceAuthority.toBase58()).to.not.equal(
      bucketAfter.rebalanceAuthority.toBase58()
    );
    expect(bucketAfter.rebalanceAuthority.toBase58()).to.equal(
      rebalanceAuthority.toBase58()
    );
  });

  it("User attempts to deposit unauthorized collateral", async () => {
    const oracle = await mockOracle(1);
    const depositAmount = new u64(1_000_000);
    expectThrowsAsync(() =>
      client.deposit(
        depositAmount,
        reserve.publicKey,
        collateralA.publicKey,
        issueAuthority,
        userA,
        oracle
      )
    );
  });

  it("Authorize collateral mint A", async () => {
    // authorize collateral A
    const allocationA: number = 10000;
    await client.authorizeCollateral(
      collateralA.publicKey,
      allocationA,
      reserve.publicKey,
      authority
    );

    // verify collateral now has 1 collateral mint
    const { bucket: _bucketA, collateral: collateralListA } =
      await client.fetchBucket(bucketKey);

    expect(collateralListA.length).to.equal(1);
    const collateralAElement = collateralListA[0] as Collateral;
    expect(collateralAElement.mint.toBase58()).to.equal(
      collateralA.publicKey.toBase58()
    );
    expect(collateralAElement.allocation).to.equal(allocationA);
  });

  it("Attempt to re-authorize collateral mint", async () => {
    const allocationA: number = 5000;
    expectThrowsAsync(() =>
      client.authorizeCollateral(
        collateralA.publicKey,
        allocationA,
        reserve.publicKey,
        authority
      )
    );
  });

  it("Attempt to authorize collateral mint with 10000 bps when other collaterals are already authorized", async () => {
    const allocationB: number = 10000;
    expectThrowsAsync(() =>
      client.authorizeCollateral(
        collateralB.publicKey,
        allocationB,
        reserve.publicKey,
        authority
      )
    );
  });

  it("Authorize to collateral mints B & C", async () => {
    // authorize collateral B
    const allocationB: number = 6000;
    await client.authorizeCollateral(
      collateralB.publicKey,
      allocationB,
      reserve.publicKey,
      authority
    );

    // verify collateral now has 3 collateral mints
    const { bucket: _bucketB, collateral: collateralListB } =
      await client.fetchBucket(bucketKey);

    expect(collateralListB.length).to.equal(2);
    const collateralListBElement = collateralListB[1] as Collateral;
    expect(collateralListBElement.mint.toBase58()).to.equal(
      collateralB.publicKey.toBase58()
    );

    // 10000 bps - 6000 bps
    expect(collateralListB[0].allocation).to.equal(4000);
    expect(collateralListBElement.allocation).to.equal(allocationB);

    // authorize collateral C
    const allocationC: number = 2000;
    await client.authorizeCollateral(
      collateralC.publicKey,
      allocationC,
      reserve.publicKey,
      authority
    );

    // verify collateral now has 3 collateral mints
    const { bucket: _bucketC, collateral: collateralListC } =
      await client.fetchBucket(bucketKey);

    expect(collateralListC.length).to.equal(3);
    const collateralListCElement = collateralListC[2] as Collateral;
    expect(collateralListCElement.mint.toBase58()).to.equal(
      collateralC.publicKey.toBase58()
    );

    // 4000 bps => 40% of new allocation => 4000 - 800 = 3200 bps
    expect(collateralListC[0].allocation).to.equal(3200);
    // 6000 bps => 60% of new allocation => 6000 - 1200 = 4800 bps
    expect(collateralListC[1].allocation).to.equal(4800);
    expect(collateralListCElement.allocation).to.equal(allocationC);
  });

  // set_collateral_allocations
  // it("Authority sets collateral directly", async () => {
    // for (const col of collateralListC as Collateral[]) {
    //   console.log('mint: ', col.mint.toBase58());
    //   console.log('alloc: ', col.allocation);
    // }
  // });

  it("User A deposits authorized collateral A, issue reserve tokens", async () => {
    // mint collateral and fund depositor ATA with collateral
    const depositAmount = new u64(1_000_000);

    const oracle = await mockOracle(1);
    console.log("MOCK ORACLE: ", oracle);

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
      issueAuthority,
      userA,
      oracle,
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

    console.log("Deposit Amount: ", depositAmount)
    console.log("Depositor Reserve After: ", depositorReserveAfter)
    console.log("Depositor Collateral After: ", depositorCollateralAfter)
    console.log("Crate Collateral After: ", crateCollateralAfter)

    expect(depositorReserveAfter).to.equal(depositAmount.toNumber());
    expect(depositorCollateralAfter).to.equal(
      depositorCollateralBefore - depositAmount.toNumber()
    );
    expect(crateCollateralAfter).to.equal(depositAmount.toNumber());
  });

  it("User B, C deposits authorized collateral B, C, issue reserve tokens", async () => {
    // mint collateral and fund depositor ATA with collateral
    const depositAmount = new u64(1_000_000);
    const oracle = await mockOracle(1);

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
      issueAuthority,
      userB,
      oracle
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

    const depositAmountC = new u64(1_000_000);
    // user C deposits collateral C
    await client.deposit(
      depositAmountC,
      reserve.publicKey,
      collateralC.publicKey,
      issueAuthority,
      userC, 
      oracle
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

    expect(userCReserveAfter).to.equal(depositAmountC.toNumber());
    expect(userCCollateralAfter).to.equal(
      userCCollateralBefore - depositAmountC.toNumber()
    );
    expect(crateCollateralCAfter).to.equal(depositAmountC.toNumber());
  });

  it("Redeem tokens", async () => {
    const tokenBalances: { [mint: string]: TokenBalance } = {};
    const oracle = await mockOracle(1);
    // fetch number of redeemable reserve tokens
    const userAReserveBefore = await client.fetchTokenBalance(
      reserve.publicKey,
      userA.publicKey
    );
    console.log("user a reserve: ", userAReserveBefore);

    for (const collateral of [collateralA, collateralB, collateralC]) {
      const collateralPublicKey = collateral.publicKey;

      const userCollateralAmount = await client.fetchTokenBalance(
        collateralPublicKey,
        userA.publicKey
      );

      console.log("user collateral amount: ", userCollateralAmount);

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
    console.log("redeem amount: ", redeemAmount.toNumber());
    await client.redeem(
      redeemAmount,
      reserve.publicKey,
      [collateralA.publicKey, collateralB.publicKey, collateralC.publicKey],
      withdrawAuthority,
      userA,
      oracle,
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
    console.log("collateral share: ", collateralShare);

    for (const collateral of [collateralA, collateralB, collateralC]) {
      const collateralPublicKey = collateral.publicKey;

      const userCollateralAmount = await client.fetchTokenBalance(
        collateralPublicKey,
        userA.publicKey
      );
      console.log("what's in each user collateral", userCollateralAmount);
      console.log("what's in each token balance", tokenBalances[collateralPublicKey.toBase58()].before + collateralShare);
      expect(userCollateralAmount).to.equal(
        tokenBalances[collateralPublicKey.toBase58()].before + collateralShare
      );
    }
  });
});
