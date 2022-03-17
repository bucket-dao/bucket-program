import * as anchor from "@project-serum/anchor";
import { u64 } from "@solana/spl-token";
import { Keypair, LAMPORTS_PER_SOL, PublicKey, Signer } from "@solana/web3.js";
import { expect } from "chai";
import { expectThrowsAsync } from "./common/util";
import { BucketClient, Collateral, executeTx, NodeWallet } from "../sdk";

describe("modify-collateral", () => {
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
  let authority: Keypair;
  let reserve: Keypair;

  let collateralA: Keypair;
  let collateralB: Keypair;
  let collateralC: Keypair;
  let collateralD: Keypair;

  before("Create funded user accounts", async () => {
    authority = await nodeWallet.createFundedWallet(10 * LAMPORTS_PER_SOL);
  });

  // beforeEach does not work — results in address in use. this happens b/c issue/withdraw authorities can only
  // be created once per program. add additional seeds to make more flexible.
  before("Create bucket", async () => {
    reserve = Keypair.generate();
    const { tx: _sig, bucket } = await client.createBucket(reserve, authority);

    bucketKey = bucket;
  });

  before("Mint collateral A, B, C, D", async () => {
    collateralA = Keypair.generate();
    collateralB = Keypair.generate();
    collateralC = Keypair.generate();
    collateralD = Keypair.generate();

    for (const collateral of [
      collateralA,
      collateralB,
      collateralC,
      collateralD,
    ]) {
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

  it("Authorize to collateral mints B, C, D", async () => {
    // authorize collateral B
    const allocationB: number = 6000;
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

    // authorize collateral C
    const allocationD: number = 1000;
    await client.authorizeCollateral(
      collateralD.publicKey,
      allocationD,
      reserve.publicKey,
      authority
    );

    // verify collateral now has 4 collateral mints
    const { collateral: collateralListWithD } = await client.fetchBucket(
      bucketKey
    );

    expect(collateralListWithD.length).to.equal(4);
    expect(
      collateralListWithD.filter(
        (c) => c.mint.toBase58() === collateralD.publicKey.toBase58()
      ).length > 0
    ).to.be.true;
  });

  it("Remove collateral D", async () => {
    // ==============================================================
    // remove and verify collateral D
    //
    // when removing collaterals D, there is no need to check
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

    expect(collateralListWithoutD.length).to.equal(3);
    expect(
      collateralListWithoutD.filter(
        (c) => c.mint.toBase58() === collateralD.publicKey.toBase58()
      ).length === 0
    ).to.be.true;
  });

  it("Authority sets collateral directly, various cases", async () => {
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
    // set with 1 additional mint, all shares equal for 6 mints
    // ========================================================
    const equal_allocation = 1667;
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
        allocation: 7000,
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
        allocation: 2000,
      },
      {
        mint: collateralB.publicKey,
        allocation: 3000,
      },
      {
        mint: collateralC.publicKey,
        allocation: 5000,
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
});
