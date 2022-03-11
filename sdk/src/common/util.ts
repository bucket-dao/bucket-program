import {
  Connection,
  Keypair,
  Transaction,
  TransactionInstruction,
  PublicKey,
  sendAndConfirmTransaction,
} from "@solana/web3.js";

import { SignerInfo, ATAResult } from "./types";

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

export const executeTx = async (
  connection: Connection,
  ixns: TransactionInstruction[],
  signers: Keypair[]
): Promise<string> => {
  const tx = new Transaction();
  ixns.forEach((ixn) => tx.add(ixn));

  return await sendAndConfirmTransaction(connection, tx, signers);
};

export const flattenValidInstructions = (
  ataResults: ATAResult[]
): TransactionInstruction[] => {
  const flattenedInstructions: TransactionInstruction[] = [];

  ataResults.forEach((res) => {
    flattenedInstructions.push(...(res.instruction ? [res.instruction] : []));
  });

  return flattenedInstructions;
};