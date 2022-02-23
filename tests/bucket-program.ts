import * as anchor from "@project-serum/anchor";
import { Keypair, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";

import { BucketClient } from "../src/index";
import { NodeWallet } from "../src/common/node-wallet";
import { expect } from "chai";

describe("bucket-program", () => {
  const _provider = anchor.Provider.env();
  const client = new BucketClient(
    _provider.connection,
    _provider.wallet as any
  );

  const nodeWallet = new NodeWallet(
    anchor.Provider.env().connection,
    anchor.Provider.env().wallet as anchor.Wallet
  );

  let bucketKey;
  let crateKey;
  let issueAuthority;
  let withdrawAuthority;
  let payer;

  // beforeEach does not work — results in address in use? probably w.r.t the issue/withdraw authorities.
  before(async () => {
    const mintKP = Keypair.generate();
    payer = await nodeWallet.createFundedWallet(1 * LAMPORTS_PER_SOL);
    const {
      tx: _sig,
      bucket: _bucketKey,
      crateToken: _crateKey,
      issueAuthority: _issueAuthority,
      withdrawAuthority: _withdrawAuthority,
    } = await client.createBucket(mintKP, payer);

    bucketKey = _bucketKey;
    crateKey = _crateKey;
    issueAuthority = _issueAuthority;
    withdrawAuthority = _withdrawAuthority;
  });

  it("Issue tokens", async () => {});
  it("Redeem tokens", async () => {});

  it("Authorize collateral", async () => {
    const collateral_mint = Keypair.generate();

    const _tx = await client.authorizeCollateral(
      bucketKey,
      crateKey,
      payer,
      collateral_mint
    );

    const bucket = await client.fetchBucket(bucketKey);
    const whitelist = bucket.whitelist as PublicKey[];

    expect(whitelist.length == 1);
    expect(whitelist[0] == collateral_mint.publicKey);

  });
});
