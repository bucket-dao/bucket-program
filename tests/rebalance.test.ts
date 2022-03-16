import * as anchor from "@project-serum/anchor";
import { u64 } from "@solana/spl-token";
import { Keypair, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { expect } from "chai";

import {
  expectThrowsAsync,
  isApproximatelyEqual,
  TokenBalance,
} from "./common/util";
import { mockOracle } from "./helpers/pyth";
import { PoolClient, verifyPoolIntegrity } from "./helpers/saber/pool";
import {
  BucketClient,
  executeTx,
  NodeWallet,
  computeSwapAmounts,
} from "../sdk";
import { LOCALNET, DEVNET } from "../sdk/src/common/constant";

describe("rebalance underlyings", () => {
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

  let userA: Keypair;

  // ================================
  // saber related config
  // ================================
  let abPool: PoolClient;

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

  before("Mint collateral A & B", async () => {
    collateralA = Keypair.generate();
    collateralB = Keypair.generate();

    for (const collateral of [collateralA, collateralB]) {
      await executeTx(
        client.provider.connection,
        await client.mintTokens(
          client.provider.connection,
          authority.publicKey,
          collateral.publicKey,
          authority.publicKey,
          authority.publicKey
        ),
        [authority, collateral]
      );
    }
  });

  // =============================================================================
  // create a local saber pool with our custom token mints, use to swap locally.
  // we can test a local swap with a test like this.
  // =============================================================================
  before("deploy & seed saber pool", async () => {
    // =====================================
    // collateral a & d pool
    // =====================================
    abPool = await new PoolClient(
      collateralA.publicKey,
      collateralB.publicKey,
      authority,
      client.provider.connection
    ).setupThenDeployNewSwap(50_000_000_0000000, 50_000_000_0000000); // 10M each

    abPool
      .withLpMint("LP", "StableSwap LP")
      .withTokenA("TOKA", "Token A")
      .withTokenB("TOKB", "Token B")
      .finalizeExchange();
  });

  it("load and verify swap pool integrity", async () => {
    await verifyPoolIntegrity(client.provider.connection, abPool);
  });

  before("Fund users' accounts with some of each collateral", async () => {
    const fundingAmount = new u64(1_000_000_000000);

    for (const user of [userA]) {
      for (const collateral of [collateralA, collateralB]) {
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

  it("Authorize tokens A & B as collateraal", async () => {
    const allocationA: number = 10_000;
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

    const allocationB: number = 5_000;
    await client.authorizeCollateral(
      collateralB.publicKey,
      allocationB,
      reserve.publicKey,
      authority
    );

    // verify collateral now has 2 collateral mints
    const { collateral: collateralListB } = await client.fetchBucket(bucketKey);

    expect(collateralListB.length).to.equal(2);
    expect(
      collateralListB.filter(
        (c) => c.mint.toBase58() === collateralB.publicKey.toBase58()
      ).length > 0
    ).to.be.true;

    expect(collateralListB[0].allocation).to.be.equal(5_000);
    expect(collateralListB[1].allocation).to.be.equal(5_000);
  });

  it("User A deposits token A and token B, receives reserve tokens", async () => {
    const oracle = await mockOracle(1);
    console.log("MOCK ORACLE: ", oracle);

    for (const collateral of [
      {
        mint: collateralA.publicKey,
        amount: 100_000_000000,
      },
      // less than token A so we can rebalance (direct swap) without insane slippage
      {
        mint: collateralB.publicKey,
        amount: 100_000000,
      },
    ]) {
      // ATA won't exist before first deposit
      const depositorReserveBefore =
        collateral.mint.toBase58() === collateralA.publicKey.toBase58()
          ? 0
          : await client.fetchTokenBalance(reserve.publicKey, userA.publicKey);
      // fetch depositor ATA balance before deposit
      const depositorCollateralBefore = await client.fetchTokenBalance(
        collateral.mint,
        userA.publicKey
      );

      await client.deposit(
        new u64(collateral.amount),
        reserve.publicKey,
        collateral.mint,
        issueAuthority,
        userA,
        oracle // todo: future figure out how to create a more dynamic mapping
      );

      // fetch depositor & crate ATA balances after deposit
      const depositorReserveAfter = await client.fetchTokenBalance(
        reserve.publicKey,
        userA.publicKey
      );
      const depositorCollateralAfter = await client.fetchTokenBalance(
        collateral.mint,
        userA.publicKey
      );
      const crateCollateralAfter = await client.fetchTokenBalance(
        collateral.mint,
        crateKey
      );

      console.log("Deposit Amount: ", collateral.amount);
      console.log("Depositor Reserve After: ", depositorReserveAfter);
      console.log("Depositor Collateral After: ", depositorCollateralAfter);
      console.log("Crate Collateral After: ", crateCollateralAfter);

      expect(depositorReserveAfter).to.equal(
        depositorReserveBefore + collateral.amount
      );
      expect(depositorCollateralAfter).to.equal(
        depositorCollateralBefore - collateral.amount
      );
      expect(crateCollateralAfter).to.equal(collateral.amount);
    }
  });

  it("Remove collateral mint B", async () => {
    // ==============================================================
    // remove and verify collateral to remove
    //
    // when removing collaterals D & E, there is no need to check
    // summed allocations. that is verified on-chain. instead, we
    // just will assert that the new collateral lists do not contain
    // the removed collateral mints.
    // =============================================================
    await client.removeCollateral(
      reserve.publicKey,
      collateralB.publicKey,
      authority
    );

    const { collateral } = await client.fetchBucket(bucketKey);

    // only A should be left
    expect(collateral.length).to.equal(1);
    expect(
      collateral.filter(
        (c) => c.mint.toBase58() === collateralB.publicKey.toBase58()
      ).length === 0
    ).to.be.true;
  });

  it("Verify pool needs rebalancing", async () => {
    const unauthorizedTokens = await client.getUnauthorizedCollateralTokens(
      reserve.publicKey
    );

    console.log("unauthorizedTokens.length: ", unauthorizedTokens.length);
    // expect(unauthorizedTokens.length).to.equal(1);
    // expect(unauthorizedTokens[0].mint.toBase58()).to.equal(
    //   collateralB.publicKey.toBase58()
    // );

    console.log(unauthorizedTokens.map((t) => t.mint.toBase58()));
  });

  it("Perform unauthorized rebalance", async () => {
    // wrong collateral, token A is still authorized
    expectThrowsAsync(() =>
      client.removeUnauthorizedCollateralTokens(
        collateralA.publicKey,
        reserve.publicKey,
        userA,
        DEVNET, // ignored for localnet when we supply stableswap account
        abPool.stableSwapAccount.publicKey
      )
    );

    const createTokenAAmountBefore = await client.fetchTokenBalance(
      collateralA.publicKey,
      crateKey
    );

    const createTokenBAmountBefore = await client.fetchTokenBalance(
      collateralB.publicKey,
      crateKey
    );

    // attempt to swap actual collateral, and fail; B -> A swap
    await client.removeUnauthorizedCollateralTokens(
      collateralB.publicKey,
      reserve.publicKey,
      userA,
      LOCALNET,
      abPool.stableSwapAccount.publicKey
    );

    const createTokenBAmountAfter = await client.fetchTokenBalance(
      collateralB.publicKey,
      crateKey
    );
    expect(createTokenBAmountAfter).to.equal(0);

    const createTokenAAmountAfter = await client.fetchTokenBalance(
      collateralA.publicKey,
      crateKey
    );

    // ============================================================================
    // until we can figure out the issue with high slippage (and thus large swap
    // discrepancies), replenish the ATA for the token we lost. we can only do this
    // since we have the keypair of the mint/freeze authority.
    //
    // presumably, there will always be some % lost in swaps. in the future, we could
    // try to find another way to replenish the lost % (e.g. insurance funds).
    // ============================================================================
    const rebalanceDiscrepancy =
      createTokenBAmountBefore -
      createTokenBAmountAfter -
      (createTokenAAmountAfter - createTokenAAmountBefore);
    console.log("rebalanceDiscrepancy: ", rebalanceDiscrepancy);
    await executeTx(
      client.provider.connection,
      await client.initTokenAccount(
        client.provider.connection,
        collateralA.publicKey,
        crateKey,
        authority.publicKey,
        new u64(rebalanceDiscrepancy)
      ),
      [authority]
    );
    // ============================================================================
  });

  it("Redeem tokens, should only receive token A", async () => {
    const tokenBalances: { [mint: string]: TokenBalance } = {};

    // fetch number of redeemable reserve tokens
    const userAReserveBefore = await client.fetchTokenBalance(
      reserve.publicKey,
      userA.publicKey
    );

    for (const collateral of [collateralA]) {
      const collateralPublicKey = collateral.publicKey;

      const userCollateralAmount = await client.fetchTokenBalance(
        collateralPublicKey,
        userA.publicKey
      );

      tokenBalances[collateralPublicKey.toBase58()] = {
        mint: collateralPublicKey,
        before: userCollateralAmount,
        after: 0,
      };
    }

    const redeemAmount = new u64(100_000000);
    // cannot redeem an unauthorized collateral
    expectThrowsAsync(() =>
      client.redeem(
        redeemAmount,
        reserve.publicKey,
        [collateralA.publicKey, collateralB.publicKey],
        withdrawAuthority,
        userA
      )
    );

    await client.redeem(
      redeemAmount,
      reserve.publicKey,
      [collateralA.publicKey],
      withdrawAuthority,
      userA
    );

    // fetch withdrawer & crate ATA balances after redeem
    const userAReserveAfter = await client.fetchTokenBalance(
      reserve.publicKey,
      userA.publicKey
    );
    expect(userAReserveAfter).to.equal(
      userAReserveBefore - redeemAmount.toNumber()
    );

    const allocations = await client.fetchCollateralAllocations(
      bucketKey,
      crateKey
    );

    for (const collateral of [collateralA]) {
      const collateralPublicKey = collateral.publicKey;
      const result = allocations.allocations.filter(
        (t) => t.mint.toBase58() === collateralPublicKey.toBase58()
      )[0];

      const userCollateralAmount = await client.fetchTokenBalance(
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
        `[AFTER; ACTUAL] user A ${collateralPublicKey.toBase58()} ATA => ${userCollateralAmount}`
      );
      console.log(
        "[AFTER; EXPECTED] user A ${collateralPublicKey.toBase58()} ATA => ",
        tokenBalances[collateralPublicKey.toBase58()].before + shareOfRedeem
      );

      // expected vs actual should always match. unless there is some collateral (now unauthorized) that remains in the pool.
      isApproximatelyEqual(
        userCollateralAmount,
        tokenBalances[collateralPublicKey.toBase58()].before + shareOfRedeem
      );
      console.log(
        `before user A mint ${collateralPublicKey.toBase58()} => ${
          tokenBalances[collateralPublicKey.toBase58()].before
        }`
      );
      console.log(
        `after user A mint ${collateralPublicKey.toBase58()} => ${userCollateralAmount}`
      );
      console.log(`share => ${collateralShare}`);
      console.log(
        "what's in user A token balance",
        tokenBalances[collateralPublicKey.toBase58()].before + collateralShare
      );
    }
  });

  it("Rebalance underlying asset allocations", async () => {
    const crateTokenABalanceBefore = await client.fetchTokenBalance(
      collateralA.publicKey,
      crateKey
    );

    const crateTokenBBalanceBefore = await client.fetchTokenBalance(
      collateralB.publicKey,
      crateKey
    );

    const amountIn = 1_000;
    // slippage is incredibly high in the local pool due to a lack of liquidity
    // between this token pair. in real life, we want a much lower slippage.
    const maxSlippageBps = 2_500;
    const expectedSwapAmount = computeSwapAmounts(amountIn, maxSlippageBps);

    // even authority cannot swap to token while it's not authorized
    expectThrowsAsync(() =>
      client.rebalance(
        {
          amountIn,
          maxSlippageBps,
          tokenA: collateralA.publicKey,
          tokenB: collateralB.publicKey,
          swapAccount: abPool.stableSwapAccount.publicKey,
        },
        reserve.publicKey,
        authority
      )
    );

    // re-authorize token
    const allocationB: number = 5_000;
    await client.authorizeCollateral(
      collateralB.publicKey,
      allocationB,
      reserve.publicKey,
      authority
    );

    // A -> B swap
    await client.rebalance(
      {
        amountIn,
        maxSlippageBps,
        tokenA: collateralA.publicKey,
        tokenB: collateralB.publicKey,
        swapAccount: abPool.stableSwapAccount.publicKey,
      },
      reserve.publicKey,
      authority
    );

    const bucketTokenABalanceAfter = await client.fetchTokenBalance(
      collateralA.publicKey,
      bucketKey
    );
    expect(bucketTokenABalanceAfter).to.equal(0);

    const bucketTokenBBalanceAfter = await client.fetchTokenBalance(
      collateralB.publicKey,
      bucketKey
    );
    expect(bucketTokenBBalanceAfter).to.equal(0);

    const crateTokenABalanceAfter = await client.fetchTokenBalance(
      collateralA.publicKey,
      crateKey
    );
    expect(crateTokenABalanceAfter).to.equal(
      crateTokenABalanceBefore - expectedSwapAmount.amountIn.toNumber()
    );

    const crateTokenCBalanceAfter = await client.fetchTokenBalance(
      collateralB.publicKey,
      crateKey
    );
    expect(crateTokenCBalanceAfter).to.equal(
      crateTokenBBalanceBefore + expectedSwapAmount.minAmountOut.toNumber()
    );
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
    expect(bucketBefore.rebalanceAuthority.toBase58()).to.not.equal(
      bucketAfter.rebalanceAuthority.toBase58()
    );
    expect(bucketAfter.rebalanceAuthority.toBase58()).to.equal(
      rebalanceAuthority.toBase58()
    );
  });
});
