import { u64 } from "@solana/spl-token";
import type { PublicKey } from "@solana/web3.js";
import { Keypair } from "@solana/web3.js";

export const U64_ZERO = new u64(0);

export interface SignerInfo {
  payer: PublicKey;
  signers: Keypair[];
}

export function isKp(kp: PublicKey | Keypair) {
  return kp instanceof Keypair || "_keypair" in kp;
}

export const getSignersFromPayer = (payer: PublicKey | Keypair): SignerInfo => {
  const payerIsKeypair = isKp(payer);
  const _payer = payerIsKeypair ? (<Keypair>payer).publicKey : payer;

  // assert signers is non-empty array?
  const signers = [];
  if (payerIsKeypair) signers.push(<Keypair>payer);

  return {
    payer: _payer,
    signers,
  } as SignerInfo;
};
