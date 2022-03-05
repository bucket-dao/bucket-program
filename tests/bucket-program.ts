import * as anchor from "@project-serum/anchor";
import { TOKEN_PROGRAM_ID, u64 } from "@solana/spl-token";
import { Keypair, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import {} from "@saberhq/stableswap-sdk";
import { expect } from "chai";
import {
  deployNewSwap,
  StableSwap,
  SWAP_PROGRAM_ID,
  IExchange,
} from "@saberhq/stableswap-sdk";
import { SPLToken, Token as SToken } from "@saberhq/token-utils";
import { SignerWallet } from "@saberhq/solana-contrib";

import {
  expectThrowsAsync,
  TokenBalance,
  assertKeysEqual,
} from "./common/util";
import { mockOracle } from "./common/testHelpers";
import {
  setupPoolInitialization,
  FEES,
  AMP_FACTOR,
} from "./helpers/saber/pool";
import { BucketClient, Collateral, executeTx, NodeWallet, computeSwapAmounts } from "../sdk";

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
  let collateralD: Keypair;
  let collateralE: Keypair;

  let userA: Keypair;
  let userB: Keypair;
  let userC: Keypair;

  // ================================
  // saber related config
  // ================================
  let tokenPool: SPLToken;
  let userPoolAccount: PublicKey;
  let mintA: SPLToken;
  let mintB: SPLToken;
  let tokenAccountA: PublicKey;
  let tokenAccountB: PublicKey;
  let adminFeeAccountA: PublicKey;
  let adminFeeAccountB: PublicKey;
  let exchange: IExchange;
  let stableSwap: StableSwap;
  let stableSwapAccount: Keypair;
  let stableSwapProgramId: PublicKey;

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
    collateralD = Keypair.generate();
    collateralE = Keypair.generate();

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

    // mint collateral D
    await executeTx(
      client.provider.connection,
      await client.mintTokens(
        client.provider.connection,
        authority.publicKey,
        collateralD.publicKey,
        authority.publicKey,
        authority.publicKey
      ),
      [authority, collateralD]
    );

    // mint collateral E
    await executeTx(
      client.provider.connection,
      await client.mintTokens(
        client.provider.connection,
        authority.publicKey,
        collateralE.publicKey,
        authority.publicKey,
        authority.publicKey
      ),
      [authority, collateralE]
    );
  });

  // =============================================================================
  // create a local saber pool with our custom token mints, use to swap locally.
  // we can test a local swap with a test like this.
  // =============================================================================
  before("deploy & seed saber pool", async () => {
    stableSwapAccount = Keypair.generate();

    const { seedPoolAccounts } = await setupPoolInitialization(
      collateralB.publicKey,
      collateralC.publicKey,
      authority
    );

    const provider = new SignerWallet(authority).createProvider(
      client.provider.connection
    );

    const { swap: newSwap, initializeArgs } = await deployNewSwap({
      provider: provider as any,
      swapProgramID: SWAP_PROGRAM_ID,
      adminAccount: authority.publicKey,
      tokenAMint: collateralB.publicKey,
      tokenBMint: collateralC.publicKey,
      ampFactor: new u64(AMP_FACTOR),
      fees: FEES,
      initialLiquidityProvider: authority.publicKey,
      useAssociatedAccountForInitialLP: true,
      seedPoolAccounts,
      swapAccountSigner: stableSwapAccount,
    });

    exchange = {
      programID: stableSwapProgramId,
      swapAccount: stableSwapAccount.publicKey,
      lpToken: new SToken({
        symbol: "LP",
        name: "StableSwap LP",
        address: initializeArgs.poolTokenMint.toString(),
        decimals: 6,
        chainId: 100,
      }),
      tokens: [
        new SToken({
          symbol: "TOKA",
          name: "Token A",
          address: initializeArgs.tokenA.mint.toString(),
          decimals: 6,
          chainId: 100,
        }),
        new SToken({
          symbol: "TOKB",
          name: "Token B",
          address: initializeArgs.tokenB.mint.toString(),
          decimals: 6,
          chainId: 100,
        }),
      ],
    };

    stableSwap = newSwap;

    tokenPool = new SPLToken(
      client.provider.connection,
      initializeArgs.poolTokenMint,
      TOKEN_PROGRAM_ID,
      authority
    );

    mintA = new SPLToken(
      client.provider.connection,
      initializeArgs.tokenA.mint,
      TOKEN_PROGRAM_ID,
      authority
    );
    mintB = new SPLToken(
      client.provider.connection,
      initializeArgs.tokenB.mint,
      TOKEN_PROGRAM_ID,
      authority
    );
    tokenAccountA = initializeArgs.tokenA.reserve;
    tokenAccountB = initializeArgs.tokenB.reserve;
    adminFeeAccountA = initializeArgs.tokenA.adminFeeAccount;
    adminFeeAccountB = initializeArgs.tokenB.adminFeeAccount;
    userPoolAccount = initializeArgs.destinationPoolTokenAccount;
  });

  it("load and verify swap pool integrity", async () => {
    const fetchedStableSwap = await StableSwap.load(
      client.provider.connection,
      stableSwapAccount.publicKey,
      stableSwapProgramId
    );

    assertKeysEqual(
      fetchedStableSwap.config.swapAccount,
      stableSwapAccount.publicKey
    );
    const { state } = fetchedStableSwap;
    assertKeysEqual(state.tokenA.adminFeeAccount, adminFeeAccountA);
    assertKeysEqual(state.tokenB.adminFeeAccount, adminFeeAccountB);
    assertKeysEqual(state.tokenA.reserve, tokenAccountA);
    assertKeysEqual(state.tokenB.reserve, tokenAccountB);
    assertKeysEqual(state.tokenA.mint, mintA.publicKey);
    assertKeysEqual(state.tokenB.mint, mintB.publicKey);
    assertKeysEqual(state.poolTokenMint, tokenPool.publicKey);

    expect(state.initialAmpFactor.toNumber()).to.equal(AMP_FACTOR);
    expect(state.targetAmpFactor.toNumber()).to.equal(AMP_FACTOR);
    // expect(state.fees).to.equal(FEES); // plain equal doesn't work here
  });

  before("Fund users' accounts with some of each collateral", async () => {
    const fundingAmount = new u64(1_000_000);

    for (const user of [authority, userA, userB, userC]) {
      for (const collateral of [
        collateralA,
        collateralB,
        collateralC,
        collateralD,
        collateralE,
      ]) {
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
    const { collateral: collateralListA } = await client.fetchBucket(bucketKey);

    expect(collateralListA.length).to.equal(1);
    expect(
      collateralListA.filter(
        (c) => c.mint.toBase58() === collateralA.publicKey.toBase58()
      ).length > 0
    ).to.be.true;
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

  it("Remove collateral mint", async () => {
    // verify neither collateral D or E is authorized before executing instruction
    const { collateral: collateralListBefore } = await client.fetchBucket(
      bucketKey
    );

    expect(
      collateralListBefore.filter((c) =>
        [
          collateralD.publicKey.toBase58(),
          collateralE.publicKey.toBase58(),
        ].includes(c.mint.toBase58())
      ).length === 0
    ).to.be.true;

    // authorize collateral D & E, verify they are in the list of authorized collateral.
    // no need to check summed allocations since that is verified on-chain.
    const allocationD: number = 1000;
    await client.authorizeCollateral(
      collateralD.publicKey,
      allocationD,
      reserve.publicKey,
      authority
    );

    const { collateral: collateralListWithD } = await client.fetchBucket(
      bucketKey
    );

    expect(collateralListWithD.length).to.equal(4);
    expect(
      collateralListWithD.filter(
        (c) => c.mint.toBase58() === collateralD.publicKey.toBase58()
      ).length > 0
    ).to.be.true;

    // authorize collateral E
    const allocationE: number = 1344;
    await client.authorizeCollateral(
      collateralE.publicKey,
      allocationE,
      reserve.publicKey,
      authority
    );

    const { collateral: collateralListWithE } = await client.fetchBucket(
      bucketKey
    );

    expect(collateralListWithE.length).to.equal(5);
    expect(
      collateralListWithE.filter(
        (c) => c.mint.toBase58() === collateralE.publicKey.toBase58()
      ).length > 0
    ).to.be.true;

    // ==============================================================
    // remove and verify collateral D
    //
    // when removing collaterals D & E, there is no need to check
    // summed allocations. that is verified on-chain. instead, we
    // just will assert that the new collateral lists do not contain
    // the removed collateral mints.
    // =============================================================
    await client.removeCollateral(
      reserve.publicKey,
      collateralD.publicKey,
      authority
    );

    const { collateral: collateralListWithoutD } = await client.fetchBucket(
      bucketKey
    );

    expect(collateralListWithoutD.length).to.equal(4);
    expect(
      collateralListWithoutD.filter(
        (c) => c.mint.toBase58() === collateralD.publicKey.toBase58()
      ).length === 0
    ).to.be.true;

    // ==================================================
    // remove and verify collateral E
    // ==================================================
    await client.removeCollateral(
      reserve.publicKey,
      collateralE.publicKey,
      authority
    );

    const { collateral: collateralListWithoutE } = await client.fetchBucket(
      bucketKey
    );

    expect(collateralListWithoutE.length).to.equal(3);
    expect(
      collateralListWithoutE.filter(
        (c) => c.mint.toBase58() === collateralE.publicKey.toBase58()
      ).length === 0
    ).to.be.true;

    // ==================================================
    // print current status of list as a sanity check
    // ==================================================
    console.log(
      `Auhorized collateral after removing mints [${collateralD.publicKey.toBase58()}] and [${collateralE.publicKey.toBase58()}]`
    );
    for (const col of collateralListWithoutE as Collateral[]) {
      console.log("mint: ", col.mint.toBase58());
      console.log("alloc: ", col.allocation);
    }
  });

  it("Authority sets collateral directly, various cases", async () => {
    // fetch existing collateral
    const { collateral } = await client.fetchBucket(bucketKey);

    // ========================================================
    // set with 1 missing mint, verify error
    // ========================================================
    expectThrowsAsync(async () => {
      client.setCollateralAllocations(
        reserve.publicKey,
        collateral.slice(1), // remove first element
        authority
      );
    });

    // ========================================================
    // set with 1 additional mint, all shares equal for 4 mints
    // ========================================================
    const equal_allocation = 2500;
    expectThrowsAsync(async () => {
      client.setCollateralAllocations(
        reserve.publicKey,
        [
          ...collateral.map((col: Collateral) => {
            return {
              mint: col.mint,
              allocation: equal_allocation,
            };
          }),
          {
            mint: collateralD.publicKey,
            allocation: equal_allocation,
          },
        ],
        authority
      );
    });

    // ========================================================
    // set allocations != 10000
    // ========================================================
    const newCollateralsAllocationOverMaxBps = [
      {
        mint: collateralA.publicKey,
        allocation: 2000,
      },
      {
        mint: collateralB.publicKey,
        allocation: 3000,
      },
      {
        mint: collateralC.publicKey,
        allocation: 5500,
      },
    ];

    expectThrowsAsync(async () => {
      await client.setCollateralAllocations(
        reserve.publicKey,
        newCollateralsAllocationOverMaxBps,
        authority
      );
    });

    // ============================================================
    // set allocations == 10000, verify updated mints & allocations
    // ============================================================
    const newCollateralsAllocationValidBps = [
      {
        mint: collateralA.publicKey,
        allocation: 3000,
      },
      {
        mint: collateralB.publicKey,
        allocation: 3000,
      },
      {
        mint: collateralC.publicKey,
        allocation: 4000,
      },
    ];

    await client.setCollateralAllocations(
      reserve.publicKey,
      newCollateralsAllocationValidBps,
      authority
    );

    const { collateral: collateralAfterUpdate } = await client.fetchBucket(
      bucketKey
    );

    // use loop to check equality instead of direct index checks since order might be different
    // than what's stored on-chain
    for (const col of collateralAfterUpdate) {
      const updatedCollateral = newCollateralsAllocationValidBps.filter(
        (newCol) => newCol.mint.toBase58() === col.mint.toBase58()
      )[0];
      expect(updatedCollateral.allocation).to.equal(col.allocation);
    }
  });

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

    console.log("Deposit Amount: ", depositAmount);
    console.log("Depositor Reserve After: ", depositorReserveAfter);
    console.log("Depositor Collateral After: ", depositorCollateralAfter);
    console.log("Crate Collateral After: ", crateCollateralAfter);

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
      oracle
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
      console.log(
        "what's in each token balance",
        tokenBalances[collateralPublicKey.toBase58()].before + collateralShare
      );
      expect(userCollateralAmount).to.equal(
        tokenBalances[collateralPublicKey.toBase58()].before + collateralShare
      );
    }
  });

  it("Rebalance underlying asset allocations", async () => {
    const amountIn = 1_000;
    // slippage is incredibly high in the local pool due to a lack of liquidity
    // between this token pair. in real life, we want a much lower slippage.
    const maxSlippageBps = 2_500;

    const expectedSwapAmount = computeSwapAmounts(
      amountIn,
      maxSlippageBps
    );

    const crateTokenBBalanceBefore = await client.fetchTokenBalance(
      collateralB.publicKey,
      crateKey,
    );

    const crateTokenCBalanceBefore = await client.fetchTokenBalance(
      collateralC.publicKey,
      crateKey,
    );

    await client.rebalance(
      {
        amountIn,
        maxSlippageBps,
        tokenA: collateralB.publicKey,
        tokenB: collateralC.publicKey,
        swapAccount: stableSwapAccount.publicKey,
      },
      reserve.publicKey,
      authority
    );

    const bucketTokenBBalanceAfter = await client.fetchTokenBalance(
      collateralB.publicKey,
      bucketKey,
    );
    expect(bucketTokenBBalanceAfter).to.equal(0);

    const bucketTokenCBalanceAfter = await client.fetchTokenBalance(
      collateralC.publicKey,
      bucketKey,
    );
    expect(bucketTokenCBalanceAfter).to.equal(0);

    const crateTokenBBalanceAfter = await client.fetchTokenBalance(
      collateralB.publicKey,
      crateKey,
    );
    expect(crateTokenBBalanceAfter)
      .to.equal(crateTokenBBalanceBefore-expectedSwapAmount.amountIn.toNumber());

    const crateTokenCBalanceAfter = await client.fetchTokenBalance(
      collateralC.publicKey,
      crateKey,
    );
    expect(crateTokenCBalanceAfter)
      .to.equal(crateTokenCBalanceBefore+expectedSwapAmount.minAmountOut.toNumber());
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
