import type {
  Connection,
  Keypair,
  PublicKey,
  TransactionInstruction,
} from "@solana/web3.js";
import { sendAndConfirmTransaction, Transaction } from "@solana/web3.js";
import { expect } from "chai";

export interface TokenBalance {
  mint: PublicKey;
  before: number;
  after: number;
}

export const executeTx = async (
  connection: Connection,
  ixns: TransactionInstruction[],
  signers: Keypair[]
): Promise<string> => {
  const tx = new Transaction();
  ixns.forEach((ixn) => tx.add(ixn));

  return await sendAndConfirmTransaction(connection, tx, signers);
};

export const expectThrowsAsync = async (
  method: () => Promise<any>,
  errorMessage = undefined
) => {
  let error: unknown = null;
  try {
    /* tslint:disable-next-line */
    await method();
  } catch (err: unknown) {
    error = err;
  }
  expect(error).to.be.an("Error");
  if (errorMessage) {
    expect((error as any).message).to.equal(errorMessage);
  }
};
