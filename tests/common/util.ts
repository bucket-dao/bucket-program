import type {
  Connection,
  Keypair,
  TransactionInstruction,
} from "@solana/web3.js";
import { sendAndConfirmTransaction, Transaction } from "@solana/web3.js";

export const executeTx = async (
  connection: Connection,
  ixns: TransactionInstruction[],
  signers: Keypair[]
): Promise<string> => {
  const tx = new Transaction();
  ixns.forEach((ixn) => tx.add(ixn));

  return await sendAndConfirmTransaction(connection, tx, signers);
};
