import { Cluster } from "@solana/web3.js";
import { ENV as ENVChainId } from "@solana/spl-token-registry";

require("dotenv").config();

// Endpoints, connection
export const ENV: Cluster =
  (process.env.NEXT_PUBLIC_CLUSTER as Cluster) || "devnet";
export const CHAIN_ID =
  ENV === "mainnet-beta"
    ? ENVChainId.MainnetBeta
    : ENV === "devnet"
    ? ENVChainId.Devnet
    : ENV === "testnet"
    ? ENVChainId.Testnet
    : ENVChainId.MainnetBeta;
export const SOLANA_RPC_ENDPOINT =
  ENV === "devnet"
    ? "https://api.devnet.solana.com"
    : "https://solana-api.projectserum.com";

// Interface
export interface Token {
  chainId: number; // 101,
  address: string; // '8f9s1sUmzUbVZMoMh6bufMueYH1u4BJSM57RCEvuVmFp',
  symbol: string; // 'TRUE',
  name: string; // 'TrueSight',
  decimals: number; // 9,
  logoURI: string; // 'https://i.ibb.co/pKTWrwP/true.jpg',
  tags: string[]; // [ 'utility-token', 'capital-token' ]
}
