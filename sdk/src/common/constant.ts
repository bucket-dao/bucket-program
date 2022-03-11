import { u64 } from "@solana/spl-token";

export const LOCALNET = "localnet";
export const TESTNET = "testnet";
export const DEVNET = "devnet";
export const MAINNET_BETA = "mainnet-beta";

export const MAX_BPS = 10_000;
export const MAX_BPS_U64 = new u64(MAX_BPS);
export const ZERO_U64 = new u64(0);

export const LEAKED_KP_FILE: string = "./data/leaked_keypair.json";