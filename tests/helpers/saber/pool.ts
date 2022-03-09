import { SignerWallet } from "@saberhq/solana-contrib";
import type { IExchange, Fees } from "@saberhq/stableswap-sdk";
import {
  calculateVirtualPrice,
  deployNewSwap,
  loadExchangeInfo,
  parseEventLogs,
  StableSwap,
  SWAP_PROGRAM_ID,
  DEFAULT_FEE,
} from "@saberhq/stableswap-sdk";
import {
  SPLToken,
  Token as SToken,
  TOKEN_PROGRAM_ID,
  createInitMintInstructions,
  u64,
  Percent,
} from "@saberhq/token-utils";
import {
  Account,
  PublicKey,
  Signer,
  TransactionResponse,
  TransactionSignature,
} from "@solana/web3.js";
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  Transaction,
  sendAndConfirmTransaction as realSendAndConfirmTransaction,
} from "@solana/web3.js";

import type { ISeedPoolAccountsFn } from "@saberhq/stableswap-sdk";

const DEFAULT_INITIAL_TOKEN_A_AMOUNT = LAMPORTS_PER_SOL;
const INITIAL_TOKEN_A_AMOUNT = DEFAULT_INITIAL_TOKEN_A_AMOUNT;
const DEFAULT_INITIAL_TOKEN_B_AMOUNT = LAMPORTS_PER_SOL;
const INITIAL_TOKEN_B_AMOUNT = DEFAULT_INITIAL_TOKEN_B_AMOUNT;

export const AMP_FACTOR = 100;

export const FEES: Fees = {
    adminTrade: DEFAULT_FEE,
    adminWithdraw: DEFAULT_FEE,
    trade: new Percent(1, 4),
    withdraw: DEFAULT_FEE,
  };

export const setupPoolInitialization = (
  mintA: PublicKey,
  mintB: PublicKey,
  minterSigner: Keypair,
  initialTokenAAmount: number = INITIAL_TOKEN_A_AMOUNT,
  initialTokenBAmount: number = INITIAL_TOKEN_B_AMOUNT
) => {
  // seed the pool accounts with mints
  const seedPoolAccounts: ISeedPoolAccountsFn = ({
    tokenAAccount,
    tokenBAccount,
  }) => ({
    instructions: [
      SPLToken.createMintToInstruction(
        TOKEN_PROGRAM_ID,
        mintA,
        tokenAAccount,
        minterSigner.publicKey,
        [new Account(minterSigner.secretKey)],
        initialTokenAAmount
      ),
      SPLToken.createMintToInstruction(
        TOKEN_PROGRAM_ID,
        mintB,
        tokenBAccount,
        minterSigner.publicKey,
        [new Account(minterSigner.secretKey)],
        initialTokenBAmount
      ),
    ],
    signers: [minterSigner],
  });

  return { minterSigner, mintA, mintB, seedPoolAccounts };
};

export const sendAndConfirmTransactionWithTitle = async (
    title: string,
    connection: Connection,
    transaction: Transaction,
    ...signers: Signer[]
  ): Promise<TransactionSignature> => {
    console.info(`Sending ${title} transaction`);
    const txSig = await realSendAndConfirmTransaction(
      connection,
      transaction,
      signers,
      {
        skipPreflight: false,
        commitment: "confirmed",
        preflightCommitment: "confirmed",
      }
    );
    console.info(`TxSig: ${txSig}`);
    const txReceipt = await connection.getTransaction(txSig, {
        commitment: "confirmed"
    });
    console.log(`Result: ${txReceipt?.meta?.logMessages?.join("\n") ?? "--"}`);
    return txSig;
};
