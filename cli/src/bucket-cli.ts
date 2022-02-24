import { Wallet } from "@project-serum/anchor";
import type { Cluster, Keypair } from "@solana/web3.js";
import { clusterApiUrl, Connection } from "@solana/web3.js";
import { program } from "commander";
import log from "loglevel";

import { BucketClient } from "../../src/bucket";
import { loadWalletKey } from "./helpers/account";

program.version("0.0.1");
log.setLevel("info");

// ============================================================================
// show account data commands
// ============================================================================

programCommand("show_bucket")
  .option("-bid, --bucketId <string>", "bucket")
  .action((_, cmd) => {
    const { keypair, env, bucketId } = cmd.opts();

    const walletKeyPair: Keypair = loadWalletKey(keypair);
    log.info(
      `Running command on ${env} with wallet ${walletKeyPair.publicKey.toString()}`
    );

    const _client = createClient(env, walletKeyPair);

    log.info("===========================================");
    log.info("Show me the bucket: ", bucketId);
    log.info("===========================================");
  });

// ============================================================================
// helper commands
// ============================================================================

function programCommand(name: string) {
  return program
    .command(name)
    .option(
      "-e, --env <string>",
      "Solana cluster env name",
      "devnet" // mainnet-beta, testnet, devnet
    )
    .option(
      "-k, --keypair <path>",
      `Solana wallet location`,
      "--keypair not provided"
    )
    .option("-l, --log-level <string>", "log level", setLogLevel);
}

const createClient = (cluster: Cluster, keypair: Keypair) => {
  return new BucketClient(
    new Connection(clusterApiUrl(cluster)),
    new Wallet(keypair)
  );
};

const setLogLevel = (value: any, _prev: any) => {
  if (value === undefined || value === null) {
    return;
  }
  log.info("setting the log value to: ", value);
  log.setLevel(value);
};

program.parse(process.argv);
