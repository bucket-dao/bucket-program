import { BucketClient } from "@bucket-program/sdk";
import { SignerWalletAdapter } from "@solana/wallet-adapter-base";
import { WalletContextState } from "@solana/wallet-adapter-react";
import { Connection, Keypair } from "@solana/web3.js";

import { BUCKET_PROGRAM_ID, BUCKET_PROGRAM_IDL } from "./constant";

export const initBucketClient = async (
    conn: Connection,
    wallet?: SignerWalletAdapter | WalletContextState,
): Promise<BucketClient> => {
    const walletToUse = wallet ?? Keypair.generate(); // leaked
    return new BucketClient(
        conn,
        walletToUse as any,
        BUCKET_PROGRAM_IDL as any,
        BUCKET_PROGRAM_ID
    );
};