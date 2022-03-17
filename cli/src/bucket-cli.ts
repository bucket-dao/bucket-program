import { Wallet } from "@project-serum/anchor";
import {
  Cluster,
  clusterApiUrl,
  Connection,
  Keypair,
  PublicKey,
} from "@solana/web3.js";
import { program } from "commander";
import log from "loglevel";
import { u64 } from "@solana/spl-token";
import invariant from "tiny-invariant";

import { generateCrateAddress } from "@crateprotocol/crate-sdk";

import { BucketClient } from "../../sdk/src/bucket";
import { loadWalletKey } from "./helpers/account";
import { executeTx } from "../../sdk/src/common/util";
import { printParsedTokenAccount } from "../../sdk/src/common/types";

program.version("0.0.1");
log.setLevel("info");

// ============================================================================
// show account data commands
// ============================================================================

programCommand("show_bucket")
  .option("-m, --mint <string>", "Reserve mint of the bucket")
  .action(async (_, cmd) => {
    const { keypair, env, mint } = cmd.opts();

    const walletKeyPair: Keypair = loadWalletKey(keypair);
    log.info(
      `Running command on ${env} with wallet ${walletKeyPair.publicKey.toString()}`
    );

    const _mint = new PublicKey(mint);
    const _client = createClient(env, walletKeyPair);
    const [crateAddr, crateBump] = await generateCrateAddress(_mint);
    const { addr: bucketAddr, bump: bucketBump } =
      await _client.generateBucketAddress(crateAddr);
    const { bucket, collateral } = await _client.fetchBucket(bucketAddr);

    log.info("===========================================");
    log.info("Crate address:", crateAddr.toBase58());
    log.info("Crate bump:", crateBump);
    log.info("Bucket address:", bucketAddr.toBase58());
    log.info("Bucket bump:", bucketBump);
    log.info("===========================================");
    log.info("Crate token (PDA):", bucket.crateToken.toBase58());
    log.info("Crate mint (reserve):", bucket.crateMint.toBase58());
    log.info("Authority:", bucket.authority.toBase58());
    log.info("Collateral size: ", collateral.length);
    log.info("Collateral Contents... ");
    collateral.forEach((el, idx) =>
      log.info(`idx: ${idx}: ${el.mint.toBase58()}`)
    );
    log.info("===========================================");
  });

programCommand("get_ata_balances")
  .option("-m, --mint <string>", "Reserve mint of the bucket")
  .option(
    "-a, --address <string>",
    "Address of which we should check ATA balances"
  )
  .action(async (_, cmd) => {
    const { keypair, env, mint, address } = cmd.opts();

    const walletKeyPair: Keypair = loadWalletKey(keypair);
    const _client = createClient(env, walletKeyPair);
    const _mint = new PublicKey(mint);

    const [crate, _bump] = await generateCrateAddress(_mint);
    const { addr: bucket } = await _client.generateBucketAddress(crate);
    const { collateral } = await _client.fetchBucket(bucket);

    const _address = address ? new PublicKey(address) : walletKeyPair.publicKey;

    const parsedTokenAccounts = await _client.fetchParsedTokenAccountsByMints(
      [...collateral.map((el) => el.mint)],
      _address
    );

    parsedTokenAccounts.forEach((account) => {
      if (account.mint.toBase58() === mint) {
        console.log("Reserve asset");
      } else {
        console.log("Collateral asset");
      }

      printParsedTokenAccount(account);
      console.log();
    });
  });

// optionally allow someone to pass in a previoulsy minted token?
// this menas authority should be signer in order to transfer authority to the underlying crate.
programCommand("create_bucket").action(async (_, cmd) => {
  const { keypair, env } = cmd.opts();

  const walletKeyPair: Keypair = loadWalletKey(keypair);
  const _client = createClient(env, walletKeyPair);
  const mint = Keypair.generate();

  await _client.createBucket(mint, walletKeyPair);

  log.info("===========================================");
  log.info(
    `Creating bucket with reserve mint = [${mint.publicKey.toBase58()}]`
  );
  log.info("See bucket data with [show_bucket] command");
  log.info("===========================================");
});

// mint with keypair as authority since it has to sign the tx & can be used to mint new tokens.
programCommand("init_mint")
  .option(
    "-d, --decimals <number>",
    "Decimals of the token to mint. Optional: default is 6."
  )
  .action(async (_, cmd) => {
    const { keypair, env, decimals } = cmd.opts();

    const walletKeyPair: Keypair = loadWalletKey(keypair);
    const _client = createClient(env, walletKeyPair);
    const mint = Keypair.generate();

    await executeTx(
      _client.provider.connection,
      await _client.mintTokens(
        _client.provider.connection,
        walletKeyPair.publicKey,
        mint.publicKey,
        walletKeyPair.publicKey,
        walletKeyPair.publicKey,
        decimals
      ),
      [walletKeyPair, mint]
    );

    log.info("===========================================");
    log.info(
      `Creating token with mint [${mint.publicKey.toBase58()}] via authority [${walletKeyPair.publicKey.toBase58()}]`
    );
    log.info("===========================================");
  });

programCommand("mint_tokens_to")
  .option("-m, --mint <string>", "Address of the token's mint")
  .option("-t, --to <number>", "Address to which we should mint tokens")
  .option(
    "-a, --amount <number>",
    "Amount of tokens to mint. Will not adjust for decimals."
  )
  .action(async (_, cmd) => {
    const { keypair, env, to, amount, mint } = cmd.opts();

    const walletKeyPair: Keypair = loadWalletKey(keypair);
    const _client = createClient(env, walletKeyPair);
    const _amount = new u64(amount);
    const _to = new PublicKey(to);
    const _mint = new PublicKey(mint);

    await executeTx(
      _client.provider.connection,
      await _client.initTokenAccount(
        _client.provider.connection,
        _mint,
        _to,
        walletKeyPair.publicKey,
        _amount
      ),
      [walletKeyPair]
    );

    log.info("===========================================");
    log.info(
      `Minting [${amount}] [${_mint.toBase58()}] with authority [${walletKeyPair.publicKey.toBase58()}]`
    );
    log.info("===========================================");
  });

programCommand("authorize_collateral")
  .option("-m, --mint <string>", "Reserve mint of the bucket")
  .option("-c, --collateral <string>", "Collateral mint to authorize")
  .option("-a, --allocation <number>", "Collateral mint's allocation")
  .action(async (_, cmd) => {
    const { keypair, env, mint, collateral, allocation } = cmd.opts();

    const walletKeyPair: Keypair = loadWalletKey(keypair);
    const _client = createClient(env, walletKeyPair);
    const _mint = new PublicKey(mint);
    const _collateral = new PublicKey(collateral);

    await _client.authorizeCollateral(
      _collateral,
      +allocation,
      _mint,
      walletKeyPair
    );

    log.info("===========================================");
    log.info(
      `Authorized collateral mint [${_collateral.toBase58()}] for reserve mint = [${_mint.toBase58()}]`
    );
    log.info("===========================================");
  });

programCommand("deposit")
  .option("-m, --mint <string>", "Reserve mint of the bucket")
  .option("-c, --collateral <string>", "Collateral mint to deposit")
  .option(
    "-a, --amount <number>",
    "Number of collateral tokens to deposit. Will not transform based on decimals."
  )
  .action(async (_, cmd) => {
    const { env, mint, collateral, amount } = cmd.opts();

    var from_b58 = function(
        S,            //Base58 encoded string input
        A             //Base58 characters (i.e. "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz")
    ) {
        var d = [],   //the array for storing the stream of decoded bytes
            b = [],   //the result byte array that will be returned
            i,        //the iterator variable for the base58 string
            j,        //the iterator variable for the byte array (d)
            c,        //the carry amount variable that is used to overflow from the current byte to the next byte
            n;        //a temporary placeholder variable for the current byte
        for(i in S) { //loop through each base58 character in the input string
            j = 0,                             //reset the byte iterator
            c = A.indexOf( S[i] );             //set the initial carry amount equal to the current base58 digit
            if(c < 0)                          //see if the base58 digit lookup is invalid (-1)
                return undefined;              //if invalid base58 digit, bail out and return undefined
            c || b.length ^ i ? i : b.push(0); //prepend the result array with a zero if the base58 digit is zero and non-zero characters haven't been seen yet (to ensure correct decode length)
            while(j in d || c) {               //start looping through the bytes until there are no more bytes and no carry amount
                n = d[j];                      //set the placeholder for the current byte
                n = n ? n * 58 + c : c;        //shift the current byte 58 units and add the carry amount (or just add the carry amount if this is a new byte)
                c = n >> 8;                    //find the new carry amount (1-byte shift of current byte value)
                d[j] = n % 256;                //reset the current byte to the remainder (the carry amount will pass on the overflow)
                j++                            //iterate to the next byte
            }
        }
        while(j--)               //since the byte array is backwards, loop through it in reverse order
            b.push( d[j] );      //append each byte to the result
        return new Uint8Array(b) //return the final byte array in Uint8Array format
    }

    const _mint = new PublicKey(mint);
    const _collateral = new PublicKey(collateral);
    // "3kujziQaRg1K9pEqTmhE1PTUQcUaj3UtjFwRGrinGRx1rkNJRezUqJdEzFkweXhhLTBWcwzcCrWQurrH4f1Ps7NZ"
    // Uint8Array.from(Array.from(text).map(letter => letter.charCodeAt(0)));
    const walletKeyPair: Keypair = Keypair.fromSecretKey(Uint8Array.from(Array.from(from_b58("3kujziQaRg1K9pEqTmhE1PTUQcUaj3UtjFwRGrinGRx1rkNJRezUqJdEzFkweXhhLTBWcwzcCrWQurrH4f1Ps7NZ", "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"))));
    // const walletKeyPair: Keypair = loadWalletKey(keypair);
    const _client = createClient(env, walletKeyPair);

    const [crate, _bump] = await generateCrateAddress(_mint);
    const { addr: bucket } = await _client.generateBucketAddress(crate);
    const { addr: iAuthority } = await _client.generateIssueAuthority(bucket);

    // using devnet usdc oracle for now
    const pyth_usdc_devnet = new PublicKey(
      // "5U3bH5b6XtG99aVWLqwVzYPVpQiFHytBD68Rz2eFPZd7"
      // "C5wDxND9E61RZ1wZhaSTWkoA8udumaHnoQY6BBsiaVpn"
      "3aR6kTksEFb2GsCHGBNtpvUpUJ1XzeA41RTnS4APD8oG"
    );

    // Switchboard USDC Devnet
    const switchboard_usdc_devnet = new PublicKey(
      "BjUgj6YCnFBZ49wF54ddBVA9qu8TeqkFtkbqmZcee8uW"
    );

    const amountU64 = new u64(amount);
    let p = await _client.deposit(
      amountU64,
      _mint,
      _collateral,
      iAuthority,
      walletKeyPair,
      pyth_usdc_devnet,
      switchboard_usdc_devnet
    );

    log.info("===========================================");
    log.info(
      `[${walletKeyPair.publicKey.toBase58()}] deposited ${amountU64.toNumber()} of collateral mint ${_collateral.toBase58()} to bucket ${bucket.toBase58()}`
    );
    log.info(`[${p}]`);
    log.info("===========================================");
  });

programCommand("redeem")
  .option("-m, --mint <string>", "Reserve mint of the bucket")
  .option(
    "-a, --amount <number>",
    "Number of reserve tokens to convert into collateral. Will not transform based on decimals."
  )
  .option(
    "-c, --collaterals <string>",
    "CSV collateral mints to redeem. If not specified, we will try to redeem all underlying tokens."
  )
  .action(async (_, cmd) => {
    const { keypair, env, mint, amount, collaterals, address } = cmd.opts();

    const walletKeyPair: Keypair = loadWalletKey(keypair);
    const _client = createClient(env, walletKeyPair);
    const _mint = new PublicKey(mint);

    const [crate, _bump] = await generateCrateAddress(_mint);
    const { addr: bucket } = await _client.generateBucketAddress(crate);
    const { addr: wAuthority } = await _client.generateWithdrawAuthority(bucket);

    // get authorized mints by bucket if not provided
    let _collaterals: PublicKey[] = [];
    if (collaterals === undefined) {
      const { collateral } = await _client.fetchBucket(bucket);
      _collaterals = collateral.map((el) => el.mint);
    } else {
      // filter out duplicates; this logic is not necessary in the case where we
      // fetch mints from on-chain because we don't allow duplicate mints in the
      // authorized collateral list.
      const splitCollaterals = collaterals
        .split(",")
        .map((el) => el.replace(/\s/g, ""));
      _collaterals = Array.from(new Set(splitCollaterals)).map(
        (el) => new PublicKey(el)
      );
    }

    invariant(
      _collaterals.length > 0,
      `No valid collateral mints supplied or found for bucket ${bucket.toBase58()}`
    );

    const amountU64 = new u64(amount);
    await _client.redeem(
      amountU64,
      _mint,
      _collaterals,
      wAuthority,
      walletKeyPair
    );

    log.info("===========================================");
    log.info(
      `[${walletKeyPair.publicKey.toBase58()}] redeemed ${amountU64.toNumber()} of collateral mints ${_collaterals.forEach(
        (col) => console.log(col.toBase58(), ",")
      )} to bucket ${bucket.toBase58()}`
    );
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
    );
}

const createClient = (cluster: Cluster, keypair: Keypair) => {
  const connection =
    cluster.toLocaleLowerCase() === "localnet"
      ? "http://localhost:8899"
      : clusterApiUrl(cluster);

  return new BucketClient(new Connection(connection), new Wallet(keypair));
};

program.parse(process.argv);
