import type {
  Connection,
  RpcResponseAndContext,
  TokenAmount,
} from "@solana/web3.js";
import { PublicKey } from "@solana/web3.js";

import {
  createAssociatedTokenAccount as _createAssociatedTokenAccount,
  findAssociatedTokenAddress as _findAssociatedTokenAddress,
  getOrCreateATA as _getOrCreateATA,
  initTokenAccount as _initTokenAccount,
  mintTokens as _mintTokens,
} from "./token";

// imported from (ty @ilmoi) https://github.com/gemworks/gem-farm/blob/main/src/gem-common/account-utils.ts
export class AccountUtils {
  conn: Connection;

  constructor(conn: Connection) {
    this.conn = conn;
  }

  // --------------------------------------- PDA

  findProgramAddress = async (
    programId: PublicKey,
    seeds: (PublicKey | Uint8Array | string)[]
  ): Promise<[PublicKey, number]> => {
    const seed_bytes = seeds.map((s) => {
      if (typeof s === "string") {
        return Buffer.from(s);
      } else if ("toBytes" in s) {
        return s.toBytes();
      } else {
        return s;
      }
    });

    return await PublicKey.findProgramAddress(seed_bytes, programId);
  };

  // --------------------------------------- Normal account

  getBalance = async (publicKey: PublicKey): Promise<number> => {
    return this.conn.getBalance(publicKey);
  };

  getTokenBalance = async (
    publicKey: PublicKey
  ): Promise<RpcResponseAndContext<TokenAmount>> => {
    return this.conn.getTokenAccountBalance(publicKey);
  };

  findAssociatedTokenAddress = _findAssociatedTokenAddress;
  getOrCreateATA = _getOrCreateATA;
  createAssociatedTokenAccount = _createAssociatedTokenAccount;
  initTokenAccount = _initTokenAccount;
  mintTokens = _mintTokens;
}
