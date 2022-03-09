import { PublicKey } from "@solana/web3.js";
import { expect } from "chai";

export interface TokenBalance {
  mint: PublicKey;
  before: number;
  after: number;
}

export const expectThrowsAsync = async (
  method: () => Promise<any>,
  errorMessage = undefined
) => {
  let error: unknown = null;
  try {
    await method();
  } catch (err: unknown) {
    error = err;
  }
  expect(error).to.be.an("Error");
  if (errorMessage) {
    expect((error as any).message).to.equal(errorMessage);
  }
};

export const assertKeysEqual = (a: PublicKey, b: PublicKey) => {
  expect(a.toBase58()).to.equal(b.toBase58());
};
