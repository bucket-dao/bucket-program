import {
    Keypair,
} from "@solana/web3.js";
import fs from "fs";
import log from "loglevel";

export const loadWalletKey = (keypair: string): Keypair => {
    if (!keypair || keypair == "") {
        throw new Error("Keypair is required!");
    }
    const loaded = Keypair.fromSecretKey(
        new Uint8Array(JSON.parse(fs.readFileSync(keypair).toString()))
    );
    log.info(`wallet public key: ${loaded.publicKey}`);
    return loaded;
}
