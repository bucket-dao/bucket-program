import { u64 } from "@solana/spl-token";
import { Keypair, PublicKey, TransactionInstruction } from "@solana/web3.js";

export const U64_ZERO = new u64(0);

export interface SignerInfo {
  payer: PublicKey;
  signers: Keypair[];
}

export interface ATAResult {
  address: PublicKey;
  instruction: TransactionInstruction | null;
}

export interface ATAsResult {
  addresses: { [pubkey: string]: PublicKey };
  instructions: (TransactionInstruction | null)[];
}

export interface ParsedTokenAccount {
  mint: PublicKey;
  owner: PublicKey;
  ata: PublicKey;
  amount: u64;
  decimals: number;
}

export interface PdaDerivationResult {
  addr: PublicKey;
  bump: number;
}
