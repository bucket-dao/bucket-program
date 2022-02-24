import * as anchor from "@project-serum/anchor";
import type { PublicKey } from "@solana/web3.js";
import { Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
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
  let _issueAuthority: PublicKey;
  let _withdrawAuthority: PublicKey;
  let payer: Keypair;

  before(async () => {
    const mintKP = Keypair.generate();
    payer = await nodeWallet.createFundedWallet(1 * LAMPORTS_PER_SOL);
    const {
      tx: _sig,
      bucket,
      crateToken,
      issueAuthority,
      withdrawAuthority,
    } = await client.createBucket(mintKP, payer);

    bucketKey = bucket;
    crateKey = crateToken;
    _issueAuthority = issueAuthority;
    _withdrawAuthority = withdrawAuthority;
  });

  it("Issue tokens", () => {
    console.log("Issue bucket tokens to a user");
  });
  it("Redeem tokens", () => {
    console.log("Redeem underlyings in exchange for bucket tokens");
  });

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

    expect(whitelist.length === 1);
    expect(whitelist[0] === collateral_mint.publicKey);
  });
});
