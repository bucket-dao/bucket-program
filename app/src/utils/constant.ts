import { PublicKey } from "@solana/web3.js";
import * as anchor from "@project-serum/anchor"

import idl from "../types/bucket_program.json";

export const network = "devnet";
export const connection: any = new anchor.web3.Connection(
  "https://api.devnet.solana.com"
);

export const BUCKET_PROGRAM_ID = new PublicKey(
  "42SMgTM8zuez9AN5EyctZ9Si55cN3ioKpCVoCxRLuVBH"
);

export const BUCKET_PROGRAM_IDL = idl;

export const RESERVE_MINT = "FgfeF24bnbZdnM7ryv6pSK87Pc89VTgfqgDhV6GqvEKo";

export const AUTHORIZED_COLLATERAL_TOKENS = [
  "5AvivB7ArFKWbMTnhJjBSf1HsUMgrc2jSxRxtPTDWZcW", // 6 decimals
  "5UwadZgYM3U7ZTkrH5JcwR9WYuc52nw8dbhPLfRh2XQA", // 6 decimals
  "59bq58XRWsbvnmnJsUfmjuY3RpaJm4uW1Yzja1tCiqkF", // 6 decimals
  "3hWRzQqCn7dBPBLpANQ4EPAfR68EDpk2E7uvEMqa9o2K", // 9 decimals
];
