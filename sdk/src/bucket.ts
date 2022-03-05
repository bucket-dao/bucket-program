import * as anchor from "@project-serum/anchor";
import { Program, Provider, Idl, Wallet } from "@project-serum/anchor";
import { u64 } from "@solana/spl-token";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import {
  AccountMeta,
  Connection,
  Keypair,
  TransactionInstruction,
  SystemProgram,
  PublicKey,
  Cluster,
} from "@solana/web3.js";
import invariant from "tiny-invariant";
import {
  CRATE_ADDRESSES,
  generateCrateAddress,
} from "@crateprotocol/crate-sdk";
import {
  StableSwap,
  SWAP_PROGRAM_ID,
} from "@saberhq/stableswap-sdk";

import { AccountUtils } from "./common/account-utils";
import {
  ParsedTokenAccount,
  SignerInfo,
  PdaDerivationResult,
  Collateral,
  RebalanceConfig
} from "./common/types";
import { addIxn, getSignersFromPayer, flattenValidInstructions } from "./common/util";
import { BucketProgram } from "./types/bucket_program";
import { SaberProvider, computeSwapAmounts } from "./providers/saber";
import { DEVNET } from "./common/constant";

export class BucketClient extends AccountUtils {
  wallet: Wallet;
  provider!: Provider;
  bucketProgram!: Program<BucketProgram>;

  // providers
  saberProvider!: SaberProvider;

  constructor(
    conn: Connection,
    wallet: anchor.Wallet,
    idl?: Idl,
    programId?: PublicKey
  ) {
    super(conn);
    this.wallet = wallet;
    this.setProvider();
    this.setBucketProgram(idl, programId);

    this.saberProvider = new SaberProvider();
  }

  setProvider = () => {
    this.provider = new Provider(
      this.conn,
      this.wallet,
      Provider.defaultOptions()
    );
    anchor.setProvider(this.provider);
  };

  setBucketProgram = (idl?: Idl, programId?: PublicKey) => {
    // instantiating program depends on the environment
    if (idl && programId) {
      console.log("idl: ", idl);
      // means running in prod
      this.bucketProgram = new Program<BucketProgram>(
        idl as any,
        programId,
        this.provider
      );
    } else {
      // means running inside test suite
      this.bucketProgram = anchor.workspace
        .BucketProgram as Program<BucketProgram>;
    }
  };

  // ================================================
  // PDAs
  // ================================================

  generateBucketAddress = async (
    mint: PublicKey,
    programID: PublicKey = this.bucketProgram.programId
  ): Promise<PdaDerivationResult> => {
    const [addr, bump] = await this.findProgramAddress(programID, [
      "bucket",
      mint,
    ]);

    return {
      addr,
      bump,
    } as PdaDerivationResult;
  };

  generateIssueAuthority = async (
    programID: PublicKey = this.bucketProgram.programId
  ) => {
    const [addr, bump] = await this.findProgramAddress(programID, ["issue"]);

    return {
      addr,
      bump,
    } as PdaDerivationResult;
  };

  generateWithdrawAuthority = async (
    programID: PublicKey = this.bucketProgram.programId
  ) => {
    const [addr, bump] = await this.findProgramAddress(programID, ["withdraw"]);

    return {
      addr,
      bump,
    } as PdaDerivationResult;
  };

  // ================================================
  // Fetch & deserialize objects
  // ================================================

  fetchBucket = async (addr: PublicKey) => {
    const bucket = await this.bucketProgram.account.bucket.fetch(addr);
    const collateral = bucket.collateral as Collateral[];

    return {
      bucket,
      collateral,
    };
  };

  // ================================================
  // Fetch token account balanaces
  // ================================================

  fetchTokenBalance = async (
    mint: PublicKey,
    owner: PublicKey
  ): Promise<number> => {
    const addr = await this.findAssociatedTokenAddress(owner, mint);
    const tokenBalance = await this.getTokenBalance(addr);

    return +tokenBalance["value"]["amount"];
  };

  fetchParsedTokenAccounts = async (
    owner: PublicKey
  ): Promise<ParsedTokenAccount[]> => {
    const parsedTokenAccounts: ParsedTokenAccount[] = [];
    const tokenAccounts = await this.getTokenAccountsByOwner(owner);

    for (const tokenAccount of tokenAccounts.value) {
      const amount = new u64(
        +tokenAccount.account.data.parsed.info.tokenAmount.amount
      );
      const mint: PublicKey = new PublicKey(
        tokenAccount.account.data.parsed.info.mint
      );
      const decimals: number =
        tokenAccount.account.data.parsed.info.tokenAmount.decimals;

      parsedTokenAccounts.push({
        mint,
        owner,
        ata: tokenAccount.pubkey,
        amount,
        decimals,
      } as ParsedTokenAccount);
    }

    return parsedTokenAccounts;
  };

  fetchParsedTokenAccountsByMints = async (
    mints: PublicKey[],
    owner: PublicKey
  ): Promise<ParsedTokenAccount[]> => {
    const parsedTokenAccounts: ParsedTokenAccount[] = [];
    for (const mint of mints) {
      const tokenAccount = await this.getTokenAccountByMint(owner, mint);

      const amount = new u64(
        +tokenAccount.value[0].account.data.parsed.info.tokenAmount.amount
      );
      const decimals: number =
        tokenAccount.value[0].account.data.parsed.info.tokenAmount.decimals;

      parsedTokenAccounts.push({
        mint,
        owner,
        ata: tokenAccount.value[0].pubkey,
        amount,
        decimals,
      } as ParsedTokenAccount);
    }

    return parsedTokenAccounts;
  };

  // given mints and token amount, we can additionally fetch overall supply and price to back into floating
  // price of the reserve asset. this is only if price is a floating peg.
  fetchParsedTokenAccountsForAuthorizedCollateral = async (
    bucket: PublicKey | any, // how to specify bucket type from anchor types?
    owner: PublicKey,
    mints?: PublicKey[]
  ) => {
    const parsedTokenAccounts: ParsedTokenAccount[] = mints
      ? await this.fetchParsedTokenAccountsByMints(mints, owner)
      : await this.fetchParsedTokenAccounts(owner);

    const { bucket: _bucket, collateral } =
      bucket instanceof PublicKey ? await this.fetchBucket(bucket) : bucket;

    const _collateral: string[] = collateral.map((item: PublicKey) =>
      item.toBase58()
    );
    return parsedTokenAccounts.filter((account) =>
      _collateral.includes(account.mint.toBase58())
    );
  };

  // ================================================
  // Smart contract function helpers
  // ================================================

  createBucket = async (
    reserve: Keypair,
    payer: PublicKey | Keypair,
    decimals = 6
  ) => {
    const [crate, crateBump] = await generateCrateAddress(reserve.publicKey);
    const { addr: bucket, bump: bucketBump } = await this.generateBucketAddress(
      crate
    );
    const { addr: issueAuthority, bump: issueBump } =
      await this.generateIssueAuthority();
    const { addr: withdrawAuthority, bump: withdrawBump } =
      await this.generateWithdrawAuthority();

    const signerInfo = getSignersFromPayer(payer);
    const crateATA = await this.getOrCreateATA(
      reserve.publicKey,
      crate,
      signerInfo.payer,
      this.provider.connection
    );

    const accounts = {
      crateMint: reserve.publicKey,
      payer: signerInfo.payer,
      bucket: bucket,
      crateToken: crate,
      issueAuthority,
      withdrawAuthority,
      // defaults to original creator. this entity has the ability
      // to update the value later.
      rebalanceAuthority: signerInfo.payer,
      systemProgram: SystemProgram.programId,
      crateTokenProgram: CRATE_ADDRESSES.CrateToken,
    };

    // new anchor versions do not require bumps, but we prefer to save bump
    // valaues on the PDA.
    const tx = await this.bucketProgram.rpc.createBucket(
      bucketBump,
      crateBump,
      issueBump,
      withdrawBump,
      {
        accounts,
        preInstructions: [
          ...(await this.mintTokens(
            this.provider.connection,
            signerInfo.payer,
            reserve.publicKey,
            crate,
            crate,
            decimals
          )),
          ...(crateATA.instruction ? [crateATA.instruction] : []),
        ],
        signers: [reserve, ...signerInfo.signers],
      }
    );

    return { tx, ...accounts };
  };

  updateRebalanceAuthority = async (
    reserve: PublicKey,
    rebalanceAuthority: PublicKey,
    payer: PublicKey | Keypair
  ) => {
    const signerInfo: SignerInfo = getSignersFromPayer(payer);

    const [crate, _crateBump] = await generateCrateAddress(reserve);
    const { addr: bucket } = await this.generateBucketAddress(crate);

    return this.bucketProgram.rpc.updateRebalanceAuthority(rebalanceAuthority, {
      accounts: {
        bucket,
        crateToken: crate,
        authority: signerInfo.payer,
      },
      signers: signerInfo.signers,
    });
  }

  authorizeCollateral = async (
    collateral: PublicKey,
    allocation: number,
    reserve: PublicKey,
    payer: PublicKey | Keypair
  ) => {
    const signerInfo: SignerInfo = getSignersFromPayer(payer);

    const [crate, _crateBump] = await generateCrateAddress(reserve);
    const { addr: bucket } = await this.generateBucketAddress(crate);

    return this.bucketProgram.rpc.authorizeCollateral(collateral, allocation, {
      accounts: {
        bucket,
        crateToken: crate,
        authority: signerInfo.payer,
      },
      signers: signerInfo.signers,
    });
  };

  removeCollateral = async (
    reserve: PublicKey,
    collateral: PublicKey,
    depositor: PublicKey | Keypair
  ) => {
    const signerInfo = getSignersFromPayer(depositor);

    const [crate, _crateBump] = await generateCrateAddress(reserve);
    const { addr: bucket } = await this.generateBucketAddress(crate);

    return this.bucketProgram.rpc.removeCollateral(collateral, {
      accounts: {
        bucket,
        crateToken: crate,
        authority: signerInfo.payer,
      },
      signers: signerInfo.signers,
    });
  };

  setCollateralAllocations = async (
    reserve: PublicKey,
    collateral: Collateral[],
    depositor: PublicKey | Keypair
  ) => {
    const signerInfo = getSignersFromPayer(depositor);

    const [crate, _crateBump] = await generateCrateAddress(reserve);
    const { addr: bucket } = await this.generateBucketAddress(crate);

    return this.bucketProgram.rpc.setCollateralAllocations(collateral, {
      accounts: {
        bucket,
        crateToken: crate,
        authority: signerInfo.payer,
      },
      signers: signerInfo.signers,
    });
  };

  // in the future, we can enhance the sdk by having it select token mints to swap
  // between & how much of those tokens to swap. for now, we will require the client,
  // to provide this information for us.
  rebalance = async (
    rebalanceConfig: RebalanceConfig,
    reserve: PublicKey,
    payer: PublicKey | Keypair, // must be rebalance authority
    cluster: Cluster = DEVNET
  ) => {
    const signerInfo: SignerInfo = getSignersFromPayer(payer);

    const [crate, _crateBump] = await generateCrateAddress(reserve);
    const { addr: bucket } = await this.generateBucketAddress(crate);

    // fetch data needed to perform swap; for now, we are only using saber, so we need to
    // use he swap account for pool with mints A/B.
    const swapAccount = rebalanceConfig.swapAccount
      ? rebalanceConfig.swapAccount
      : await this.saberProvider.getSwapAccountFromMints(
          rebalanceConfig.tokenA,
          rebalanceConfig.tokenB,
          cluster
        );

    const fetchedStableSwap = await StableSwap.load(
      this.provider.connection,
      swapAccount,
      SWAP_PROGRAM_ID
    );

    // we need 4 ATAs: crate source, bucket source, crate destination, bucket destination
    const crateSourceATA = await this.getOrCreateATA(
      rebalanceConfig.tokenA,
      crate,
      signerInfo.payer,
      this.provider.connection
    );
    const bucketSourceATA = await this.getOrCreateATA(
      rebalanceConfig.tokenA,
      bucket,
      signerInfo.payer,
      this.provider.connection
    );
    const crateDestinationATA = await this.getOrCreateATA(
      rebalanceConfig.tokenB,
      crate,
      signerInfo.payer,
      this.provider.connection
    );
    const bucketDestinationATA = await this.getOrCreateATA(
      rebalanceConfig.tokenB,
      bucket,
      signerInfo.payer,
      this.provider.connection
    );

    const remainingAccounts = [
      crateSourceATA.address,
      bucketSourceATA.address,
      crateDestinationATA.address,
      bucketDestinationATA.address,
    ].map(
      (acc): AccountMeta => ({
        pubkey: acc,
        isSigner: false,
        isWritable: true,
      })
    );

    const swapAmount = computeSwapAmounts(
      rebalanceConfig.amountIn,
      rebalanceConfig.maxSlippageBps
    );

    // note: token A & B accounts are parsed off the remaining accounts
    return this.bucketProgram.rpc.rebalance(
      swapAmount.amountIn,
      swapAmount.minAmountOut,
      {
        accounts: {
          payer: signerInfo.payer,
          bucket,
          crateToken: crate,
          withdrawAuthority: (await this.generateWithdrawAuthority()).addr,
          swap: fetchedStableSwap.config.swapAccount,
          swapAuthority: fetchedStableSwap.config.authority,
          userAuthority: signerInfo.payer,
          inputAReserve: fetchedStableSwap.state.tokenA.reserve,
          outputBReserve: fetchedStableSwap.state.tokenB.reserve,
          outputBFees: fetchedStableSwap.state.tokenB.adminFeeAccount,
          poolMint: fetchedStableSwap.state.poolTokenMint,
          crateTokenProgram: CRATE_ADDRESSES.CrateToken,
          saberProgram: fetchedStableSwap.config.swapProgramID,
          tokenProgram: TOKEN_PROGRAM_ID,
        },
        remainingAccounts,
        // these instructions ensure ATAs exist before transferring tokens to these
        // accounts. otherwise, transaction will fail. it's possible that too many ixns
        // packed into the same tx can result in tx failure.
        preInstructions: flattenValidInstructions([
          crateSourceATA,
          bucketSourceATA,
          crateDestinationATA,
          bucketDestinationATA,
        ]),
        signers: signerInfo.signers,
      }
    );
  };

  deposit = async (
    amount: u64,
    reserve: PublicKey,
    collateral: PublicKey,
    issueAuthority: PublicKey,
    depositor: PublicKey | Keypair,
    oracle: PublicKey
  ) => {
    const signerInfo = getSignersFromPayer(depositor);

    const [crate, _crateBump] = await generateCrateAddress(reserve);
    const { addr: bucket } = await this.generateBucketAddress(crate);

    const depsitorCollateralATA = await this.getOrCreateATA(
      collateral,
      signerInfo.payer,
      signerInfo.payer,
      this.provider.connection
    );

    const depositorReserveATA = await this.getOrCreateATA(
      reserve,
      signerInfo.payer,
      signerInfo.payer,
      this.provider.connection
    );

    const crateCollateralATA = await this.getOrCreateATA(
      collateral,
      crate,
      signerInfo.payer,
      this.provider.connection
    );

    return this.bucketProgram.rpc.deposit(amount, {
      accounts: {
        common: {
          bucket: bucket,
          crateToken: crate,
          crateMint: reserve,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          crateTokenProgram: CRATE_ADDRESSES.CrateToken,
        },
        issueAuthority: issueAuthority,
        crateCollateral: crateCollateralATA.address,
        collateralMint: collateral,
        depositor: signerInfo.payer,
        depositorCollateral: depsitorCollateralATA.address,
        depositorReserve: depositorReserveATA.address,
        oracle: oracle,
      },
      preInstructions: flattenValidInstructions([
        depsitorCollateralATA,
        depositorReserveATA,
        crateCollateralATA,
      ]),
      signers: signerInfo.signers,
    });
  };

  redeem = async (
    amount: u64,
    reserve: PublicKey,
    collateralTokens: PublicKey[],
    withdrawAuthority: PublicKey,
    withdrawer: PublicKey | Keypair,
    oracle: PublicKey
  ) => {
    const signerInfo = getSignersFromPayer(withdrawer);

    const [crate, _crateBump] = await generateCrateAddress(reserve);
    const { addr: bucket } = await this.generateBucketAddress(crate);

    // these instructions ensure ATAs exist before transferring tokens to these
    // accounts. otherwise, transaction will fail. it's possible that too many ixns
    // packed into the same tx can result in tx failure.
    const createATAInstructions: TransactionInstruction[] = [];
    const withdrawerReserveATA = await this.getOrCreateATA(
      reserve,
      signerInfo.payer,
      signerInfo.payer,
      this.provider.connection
    );
    addIxn(withdrawerReserveATA.instruction, createATAInstructions);

    const ownerATAs = await this.getOrCreateATAs(
      collateralTokens,
      signerInfo.payer,
      signerInfo.payer,
      this.provider.connection
    );
    ownerATAs.instructions.forEach((ixn) => addIxn(ixn, createATAInstructions));

    const crateATAs = await this.getOrCreateATAs(
      collateralTokens,
      crate,
      signerInfo.payer,
      this.provider.connection
    );
    crateATAs.instructions.forEach((ixn) => addIxn(ixn, createATAInstructions));

    const remainingAccountKeys = ((): PublicKey[] => {
      // no withdraw or protocol fees for now. refactor later to
      // include more robust fee distribution.
      return collateralTokens.flatMap((token) => {
        const tokenAddress = token.toBase58();

        const crateATA = (crateATAs.addresses as Record<string, PublicKey>)[
          tokenAddress
        ];
        const ownerATA = (ownerATAs.addresses as Record<string, PublicKey>)[
          tokenAddress
        ];

        invariant(ownerATA && crateATA, "missing ATA");

        // use owner ATAs for the fees, since there are no fees
        return [token, crateATA, ownerATA, ownerATA, ownerATA];
      });
    })();

    const remainingAccounts = remainingAccountKeys.map(
      (acc): AccountMeta => ({
        pubkey: acc,
        isSigner: false,
        isWritable: true,
      })
    );

    return this.bucketProgram.rpc.redeem(amount, {
      accounts: {
        common: {
          bucket: bucket,
          crateToken: crate,
          crateMint: reserve,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          crateTokenProgram: CRATE_ADDRESSES.CrateToken,
        },
        withdrawAuthority: withdrawAuthority,
        withdrawer: signerInfo.payer,
        withdrawerReserve: withdrawerReserveATA.address,
        oracle: oracle,
      },
      remainingAccounts,
      preInstructions: createATAInstructions,
      signers: signerInfo.signers,
    });
  };
}
