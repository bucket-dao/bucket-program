import {
    Connection,
    Keypair,
    PublicKey,
    SystemProgram,
    SYSVAR_RENT_PUBKEY,
    TransactionInstruction,
} from "@solana/web3.js";
import {
    AccountInfo,
    ASSOCIATED_TOKEN_PROGRAM_ID,
    MintInfo,
    Token,
    TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { Provider } from "@project-serum/anchor";

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
            if (typeof s == "string") {
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

    async getBalance(publicKey: PublicKey): Promise<number> {
        return this.conn.getBalance(publicKey);
    }

    // --------------------------------------- Token account

    async deserializeToken(mint: PublicKey): Promise<Token> {
        // doesn't matter which keypair goes here, we just need some key for instantiation
        const throwawayKeypair = Keypair.fromSecretKey(
            Uint8Array.from([
                208, 175, 150, 242, 88, 34, 108, 88, 177, 16, 168, 75, 115, 181,
                199, 242, 120, 4, 78, 75, 19, 227, 13, 215, 184, 108, 226, 53,
                111, 149, 179, 84, 137, 121, 79, 1, 160, 223, 124, 241, 202,
                203, 220, 237, 50, 242, 57, 158, 226, 207, 203, 188, 43, 28, 70,
                110, 214, 234, 251, 15, 249, 157, 62, 80,
            ])
        );
        return new Token(this.conn, mint, TOKEN_PROGRAM_ID, throwawayKeypair);
    }

    async deserializeTokenMint(mint: PublicKey): Promise<MintInfo> {
        const t = await this.deserializeToken(mint);
        return t.getMintInfo();
    }

    async deserializeTokenAccount(
        mint: PublicKey,
        tokenAccount: PublicKey
    ): Promise<AccountInfo> {
        const token = await this.deserializeToken(mint);
        return token.getAccountInfo(tokenAccount);
    }

    findAssociatedTokenAddress = async (
        owner: PublicKey,
        mint: PublicKey
    ): Promise<PublicKey> => {
        return (
            await PublicKey.findProgramAddress(
                [
                    owner.toBuffer(),
                    TOKEN_PROGRAM_ID.toBuffer(),
                    mint.toBuffer(),
                ],
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
        let keys = [
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
                    payer  // payer
                ),
            };
        }
    };
}
