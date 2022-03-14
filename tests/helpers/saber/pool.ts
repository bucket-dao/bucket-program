import * as anchor from "@project-serum/anchor";
import type {
  IExchange,
  Fees,
  InitializeSwapInstruction,
} from "@saberhq/stableswap-sdk";
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
import {
  SignerWallet,
  Provider,
  SolanaProvider,
} from "@saberhq/solana-contrib";
import { Saber } from "@saberhq/saber-periphery";

import type { ISeedPoolAccountsFn } from "@saberhq/stableswap-sdk";
import { assertKeysEqual } from "../../common/util";
import { expect } from "chai";

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
  minterSigner: Keypair,
  mintA: PublicKey,
  mintB: PublicKey,
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
    commitment: "confirmed",
  });
  console.log(`Result: ${txReceipt?.meta?.logMessages?.join("\n") ?? "--"}`);
  return txSig;
};

export const newToken = (
  symbol: string,
  name: string,
  token: PublicKey,
  decimals: number = 6,
  chainId: number = 100
) => {
  return new SToken({
    symbol,
    name,
    address: token.toString(),
    decimals,
    chainId,
  });
};

export const verifyPoolIntegrity = async (
  connection: Connection,
  poolClient: PoolClient
) => {
  const fetchedStableSwap = await StableSwap.load(
    connection,
    poolClient.stableSwapAccount.publicKey,
    poolClient.stableSwapProgramId
  );

  assertKeysEqual(
    fetchedStableSwap.config.swapAccount,
    poolClient.stableSwapAccount.publicKey
  );

  const { state } = fetchedStableSwap;
  assertKeysEqual(state.tokenA.adminFeeAccount, poolClient.adminFeeAccountA);
  assertKeysEqual(state.tokenB.adminFeeAccount, poolClient.adminFeeAccountB);
  assertKeysEqual(state.tokenA.reserve, poolClient.tokenAccountA);
  assertKeysEqual(state.tokenB.reserve, poolClient.tokenAccountB);
  assertKeysEqual(state.tokenA.mint, poolClient.mintA.publicKey);
  assertKeysEqual(state.tokenB.mint, poolClient.mintB.publicKey);
  assertKeysEqual(state.poolTokenMint, poolClient.tokenPool.publicKey);

  expect(state.initialAmpFactor.toNumber()).to.equal(AMP_FACTOR);
  expect(state.targetAmpFactor.toNumber()).to.equal(AMP_FACTOR);
  // expect(state.fees).to.equal(FEES); // plain equal doesn't work here
};

export class PoolClient {
  provider: Provider;

  tokenA: PublicKey;
  tokenB: PublicKey;
  authority: Keypair;

  initArgs: InitializeSwapInstruction;

  lpToken: SToken;
  tokens: [SToken, SToken];

  tokenPool: SPLToken;
  userPoolAccount: PublicKey;
  mintA: SPLToken;
  mintB: SPLToken;
  tokenAccountA: PublicKey;
  tokenAccountB: PublicKey;
  adminFeeAccountA: PublicKey;
  adminFeeAccountB: PublicKey;
  exchange: IExchange;
  stableSwap: StableSwap;
  stableSwapAccount: Keypair;
  stableSwapProgramId: PublicKey;

  constructor(
    tokenA: PublicKey,
    tokenB: PublicKey,
    authority: Keypair,
    connection: Connection
  ) {
    this.stableSwapAccount = Keypair.generate();

    this.provider = new SignerWallet(authority).createProvider(connection);
    this.tokenA = tokenA;
    this.tokenB = tokenB;
    this.authority = authority;
  }

  setupThenDeployNewSwap = async (
    tokenAAmount: number,
    tokenBAmount: number
  ) => {
    const { seedPoolAccounts } = await setupPoolInitialization(
      this.authority,
      this.tokenA,
      this.tokenB,
      tokenAAmount,
      tokenBAmount
    );

    const { swap, initializeArgs: initArgs } = await deployNewSwap({
      provider: this.provider as any,
      swapProgramID: SWAP_PROGRAM_ID,
      adminAccount: this.authority.publicKey,
      tokenAMint: this.tokenA,
      tokenBMint: this.tokenB,
      ampFactor: new u64(AMP_FACTOR),
      fees: FEES,
      initialLiquidityProvider: this.authority.publicKey,
      useAssociatedAccountForInitialLP: true,
      seedPoolAccounts,
      swapAccountSigner: this.stableSwapAccount,
    });

    this.stableSwap = swap;
    this.initArgs = initArgs;
    this.tokenAccountA = initArgs.tokenA.reserve;
    this.tokenAccountB = initArgs.tokenB.reserve;
    this.adminFeeAccountA = initArgs.tokenA.adminFeeAccount;
    this.adminFeeAccountB = initArgs.tokenB.adminFeeAccount;
    this.userPoolAccount = initArgs.destinationPoolTokenAccount;

    this.tokens = [undefined, undefined];

    return this;
  };

  withLpMint = (
    symbol: string,
    name: string,
    decimals: number = 6,
    chainId: number = 100
  ) => {
    this.lpToken = newToken(
      symbol,
      name,
      this.initArgs.poolTokenMint,
      decimals,
      chainId
    );

    return this;
  };

  withTokenA = (
    symbol: string,
    name: string,
    decimals: number = 6,
    chainId: number = 100
  ) => {
    this.tokens[0] = newToken(
      symbol,
      name,
      this.initArgs.tokenA.mint,
      decimals,
      chainId
    );

    return this;
  };

  withTokenB = (
    symbol: string,
    name: string,
    decimals: number = 6,
    chainId: number = 100
  ) => {
    this.tokens[1] = newToken(
      symbol,
      name,
      this.initArgs.tokenB.mint,
      decimals,
      chainId
    );

    return this;
  };

  finalizeExchange = () => {
    this.exchange = {
      programID: this.stableSwapProgramId,
      swapAccount: this.stableSwapAccount.publicKey,
      lpToken: this.lpToken,
      tokens: this.tokens,
    };

    this.tokenPool = new SPLToken(
      this.provider.connection,
      this.initArgs.poolTokenMint,
      TOKEN_PROGRAM_ID,
      this.authority
    );

    this.mintA = new SPLToken(
      this.provider.connection,
      this.initArgs.tokenA.mint,
      TOKEN_PROGRAM_ID,
      this.authority
    );

    this.mintB = new SPLToken(
      this.provider.connection,
      this.initArgs.tokenB.mint,
      TOKEN_PROGRAM_ID,
      this.authority
    );

    return this;
  };
}
