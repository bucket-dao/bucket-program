import { Keypair } from "@solana/web3.js";
import fs from "fs";

export const loadWalletKey = (keypair: string): Keypair => {
  if (!keypair || keypair === "") {
    throw new Error("Keypair is required!");
  }
  const loaded = Keypair.fromSecretKey(
    new Uint8Array(JSON.parse(fs.readFileSync(keypair).toString()))
  );
  return loaded;
};
