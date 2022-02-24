import type { Token } from "@solana/spl-token";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import type { Connection } from "@solana/web3.js";
import {
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  TransactionInstruction,
} from "@solana/web3.js";

export interface ITokenData {
  tokenMint: PublicKey;
  tokenAcc: PublicKey;
  owner: PublicKey;
  token: Token;
}

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

  // --------------------------------------- Token account

  findAssociatedTokenAddress = async (
    owner: PublicKey,
    mint: PublicKey
  ): Promise<PublicKey> => {
    return (
      await PublicKey.findProgramAddress(
        [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
        ASSOCIATED_TOKEN_PROGRAM_ID
      )
    )[0];
  };

  // todo: replace with createAssociatedTokenAccountInstruction?
  createAssociatedTokenAccount = (
    mint: PublicKey,
    associatedAccount: PublicKey,
    owner: PublicKey,
    payer: PublicKey
  ) => {
    const keys = [
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: associatedAccount, isSigner: false, isWritable: true },
      { pubkey: owner, isSigner: false, isWritable: false },
      { pubkey: mint, isSigner: false, isWritable: false },
      {
        pubkey: SystemProgram.programId,
        isSigner: false,
        isWritable: false,
      },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      {
        pubkey: SYSVAR_RENT_PUBKEY,
        isSigner: false,
        isWritable: false,
      },
    ];
    return new TransactionInstruction({
      keys,
      programId: ASSOCIATED_TOKEN_PROGRAM_ID,
      data: Buffer.alloc(0),
    });
  };

  getOrCreateATA = async (
    mint: PublicKey,
    owner: PublicKey,
    payer: PublicKey,
    conn: Connection
  ) => {
    const address = await this.findAssociatedTokenAddress(owner, mint);
    if (await conn.getAccountInfo(address)) {
      return { address, instruction: null };
    } else {
      return {
        address,
        instruction: this.createAssociatedTokenAccount(
          mint,
          address,
          owner, // owner
          payer // payer
        ),
      };
    }
  };
}
