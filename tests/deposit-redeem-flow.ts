import * as anchor from "@project-serum/anchor";
import { u64 } from "@solana/spl-token";
import { Keypair, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { expect } from "chai";
import {
  expectThrowsAsync,
  TokenBalance,
  isApproximatelyEqual,
} from "./common/util";
import { mockOracle } from "./helpers/pyth";
import { BucketClient, executeTx, NodeWallet } from "../sdk/dist/cjs";

describe("deposit-redeem-flow", () => {
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

  before("Create funded user accounts", async () => {
    authority = await nodeWallet.createFundedWallet(10 * LAMPORTS_PER_SOL);
    userA = await nodeWallet.createFundedWallet(1 * LAMPORTS_PER_SOL);
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

    for (const user of [authority, userA]) {
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

  it("Authorize collateral mint A, B, C", async () => {
    // authorize collateral A
    const allocationA: number = 10000;
    await client.authorizeCollateral(
      collateralA.publicKey,
      allocationA,
      reserve.publicKey,
      authority
    );

    // verify collateral now has 1 collateral mint
    const { collateral: collateralListA } = await client.fetchBucket(bucketKey);

    expect(collateralListA.length).to.equal(1);
    expect(
      collateralListA.filter(
        (c) => c.mint.toBase58() === collateralA.publicKey.toBase58()
      ).length > 0
    ).to.be.true;

    // authorize collateral B
    const allocationB: number = 6000;
    await client.authorizeCollateral(
      collateralB.publicKey,
      allocationB,
      reserve.publicKey,
      authority
    );

    // verify collateral now has 3 collateral mints
    const { collateral: collateralListB } = await client.fetchBucket(bucketKey);

    expect(collateralListB.length).to.equal(2);
    expect(
      collateralListB.filter(
        (c) => c.mint.toBase58() === collateralB.publicKey.toBase58()
      ).length > 0
    ).to.be.true;

    // 10000 bps - 6000 bps
    expect(collateralListB[0].allocation).to.equal(4000);
    expect(collateralListB[1].allocation).to.equal(allocationB);

    // authorize collateral C
    const allocationC: number = 1200;
    await client.authorizeCollateral(
      collateralC.publicKey,
      allocationC,
      reserve.publicKey,
      authority
    );

    // verify collateral now has 3 collateral mints
    const { collateral: collateralListC } = await client.fetchBucket(bucketKey);

    expect(collateralListC.length).to.equal(3);
    expect(
      collateralListC.filter(
        (c) => c.mint.toBase58() === collateralC.publicKey.toBase58()
      ).length > 0
    ).to.be.true;

    // new alloc => 1200, broken down => 1200 * .4 = 480, 1200 * .6 = 720, respectively
    // 4000 bps => 40% of new allocation => 4000 - 480 = 3520 bps
    expect(collateralListC[0].allocation).to.equal(3520);
    // 6000 bps => 60% of new allocation => 6000 - 720 = 5280 bps
    expect(collateralListC[1].allocation).to.equal(5280);
    // 1200 bps
    expect(collateralListC[2].allocation).to.equal(allocationC);
  });

  it("User A deposits authorized collateral A, issue reserve tokens", async () => {
    // mint collateral and fund depositor ATA with collateral
    const depositAmount = new u64(1_000_000);

    const oracle = await mockOracle(1);

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
      oracle
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
    const oracle = await mockOracle(1);

    // ==================================================================
    // collateral B checks & rpc call
    // ==================================================================

    // fetch depositor ATA balance before deposit
    const userACollateralBBefore = await client.fetchTokenBalance(
      collateralB.publicKey,
      userA.publicKey
    );
    expect(userACollateralBBefore).to.equal(depositAmount.toNumber());

    const userAReserveBeforeB = await client.fetchTokenBalance(
      reserve.publicKey,
      userA.publicKey
    );

    // user B deposits collateral B
    await client.deposit(
      depositAmount,
      reserve.publicKey,
      collateralB.publicKey,
      issueAuthority,
      userA,
      oracle
    );

    // fetch user B & crate ATA balances for collateral B after deposit
    const userAReserveAfterB = await client.fetchTokenBalance(
      reserve.publicKey,
      userA.publicKey
    );
    const userACollateralBAfter = await client.fetchTokenBalance(
      collateralB.publicKey,
      userA.publicKey
    );

    const crateCollateralBAfter = await client.fetchTokenBalance(
      collateralB.publicKey,
      crateKey
    );

    expect(userAReserveAfterB).to.equal(
      userAReserveBeforeB + depositAmount.toNumber()
    );
    expect(userACollateralBAfter).to.equal(
      userACollateralBBefore - depositAmount.toNumber()
    );
    expect(crateCollateralBAfter).to.equal(depositAmount.toNumber());

    // ==================================================================
    // collateral C checks & rpc call
    // ==================================================================

    const userACollateralCBefore = await client.fetchTokenBalance(
      collateralC.publicKey,
      userA.publicKey
    );
    expect(userACollateralCBefore).to.equal(depositAmount.toNumber());

    const depositAmountC = new u64(1_000_000);
    // user C deposits collateral C
    await client.deposit(
      depositAmountC,
      reserve.publicKey,
      collateralC.publicKey,
      issueAuthority,
      userA,
      oracle
    );

    // fetch user B & crate ATA balances for collateral B after deposit
    const userAReserveAfterC = await client.fetchTokenBalance(
      reserve.publicKey,
      userA.publicKey
    );

    const userACollateralCAfter = await client.fetchTokenBalance(
      collateralC.publicKey,
      userA.publicKey
    );

    const crateCollateralCAfter = await client.fetchTokenBalance(
      collateralC.publicKey,
      crateKey
    );

    expect(userAReserveAfterC).to.equal(
      userAReserveAfterB + depositAmountC.toNumber()
    );
    expect(userACollateralCAfter).to.equal(
      userACollateralCBefore - depositAmountC.toNumber()
    );
    expect(crateCollateralCAfter).to.equal(depositAmountC.toNumber());
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

      const userAollateralAmount = await client.fetchTokenBalance(
        collateralPublicKey,
        userA.publicKey
      );

      // previously deposited amount
      if (collateralPublicKey.toBase58() === collateralA.publicKey.toBase58()) {
        expect(userAollateralAmount).to.equal(0);
      }

      tokenBalances[collateralPublicKey.toBase58()] = {
        mint: collateralPublicKey,
        before: userAollateralAmount,
        after: 0,
      };
    }

    const redeemAmount = new u64(userAReserveBefore);
    await client.redeem(
      redeemAmount,
      reserve.publicKey,
      [collateralA.publicKey, collateralB.publicKey, collateralC.publicKey],
      withdrawAuthority,
      userA
    );

    // fetch withdrawer & crate ATA balances after redeem
    const userAReserveAfter = await client.fetchTokenBalance(
      reserve.publicKey,
      userA.publicKey
    );
    expect(userAReserveAfter).to.equal(0);

    const allocations = await client.fetchCollateralAllocations(
      bucketKey,
      crateKey
    );

    for (const collateral of [collateralA, collateralB, collateralC]) {
      const collateralPublicKey = collateral.publicKey;
      const result = allocations.allocations.filter(
        (t) => t.mint.toBase58() === collateralPublicKey.toBase58()
      )[0];

      const userAollateralAmount = await client.fetchTokenBalance(
        collateralPublicKey,
        userA.publicKey
      );

      const collateralShare = result.supply / allocations.supply;
      const shareOfRedeem = Math.round(
        redeemAmount.toNumber() * collateralShare
      );

      console.log(`share => ${collateralShare}`);
      console.log(`shareOfRedeem => ${shareOfRedeem}`);

      console.log(
        `[BEFORE] user A ${collateralPublicKey.toBase58()} ATA => ${
          tokenBalances[collateralPublicKey.toBase58()].before
        }`
      );
      console.log(
        `[AFTER; ACTUAL] user A ${collateralPublicKey.toBase58()} ATA => ${userAollateralAmount}`
      );
      console.log(
        "[AFTER; EXPECTED] user A ${collateralPublicKey.toBase58()} ATA => ",
        tokenBalances[collateralPublicKey.toBase58()].before + shareOfRedeem
      );

      // expected vs actual should always match. unless there is some collateral (now unauthorized) that remains in the pool.
      isApproximatelyEqual(
        userAollateralAmount,
        tokenBalances[collateralPublicKey.toBase58()].before + shareOfRedeem
      );
      console.log(
        `before user A mint ${collateralPublicKey.toBase58()} => ${
          tokenBalances[collateralPublicKey.toBase58()].before
        }`
      );
      console.log(
        `after user A mint ${collateralPublicKey.toBase58()} => ${userAollateralAmount}`
      );
      console.log(`share => ${collateralShare}`);
      console.log(
        "what's in user A token balance",
        tokenBalances[collateralPublicKey.toBase58()].before + collateralShare
      );
    }
  });
});
