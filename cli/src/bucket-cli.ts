import { program } from "commander";
import { Wallet } from "@project-serum/anchor";
import { Cluster, clusterApiUrl, Connection, Keypair } from "@solana/web3.js";
import log from "loglevel";

import { BucketClient } from '../../src/bucket';
import { loadWalletKey } from "./helpers/account";

program.version("0.0.1");
log.setLevel("info");

// ============================================================================
// show account data commands
// ============================================================================

programCommand("show_bucket")
    .option("-bid, --bucketId <string>", "bucket")
    .action(async (_, cmd) => {
        const { keypair, env, bucketId } = cmd.opts();

        const walletKeyPair = loadWalletKey(keypair);
        log.info(`Running command on ${env} with wallet ${walletKeyPair.publicKey.toString()}`);

        const _client = createClient(env, walletKeyPair);

        log.info("===========================================");
        log.info("Show me the bucket!");
        // const mintKP = Keypair.generate();
        // await client.createBucket(mintKP, walletKeyPair);
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
    const connection = new Connection(clusterApiUrl(cluster));
    const wallet = new Wallet(keypair);
    const client = new BucketClient(connection, wallet);
    return client;
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function setLogLevel(value, prev) {
    if (value === undefined || value === null) {
        return;
    }
    log.info("setting the log value to: " + value);
    log.setLevel(value);
}

program.parse(process.argv);
