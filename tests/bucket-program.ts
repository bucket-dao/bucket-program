import * as anchor from "@project-serum/anchor";
import { Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";

import { BucketClient } from "../src/index";
import { NodeWallet } from "../src/common/node-wallet";

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

    // beforeEach does not work — results in address in use? probably w.r.t the issue/withdraw authorities.
    before(async () => {
        const mintKP = Keypair.generate();
        const payer = await nodeWallet.createFundedWallet(1 * LAMPORTS_PER_SOL);
        const _sig = await client.createBucket(mintKP, payer);
    });

    it("Issue tokens", async () => {});
    it("Redeem tokens", async () => {});
    it("Authorize collateral", async () => {});
});
