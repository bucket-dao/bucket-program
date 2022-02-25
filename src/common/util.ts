import type { PublicKey } from "@solana/web3.js";
import { Keypair, TransactionInstruction } from "@solana/web3.js";

import type { SignerInfo } from "./types";

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

export const addIxn = (
  ixn: TransactionInstruction | null,
  ixns: TransactionInstruction[]
): void => {
  if (ixn instanceof TransactionInstruction) {
    ixns.push(ixn);
  }
};
