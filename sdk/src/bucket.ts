import * as anchor from "@project-serum/anchor";
import { Program, Provider, Idl, Wallet } from "@project-serum/anchor";
import { TOKEN_PROGRAM_ID, Token, u64 } from "@solana/spl-token";
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
import { StableSwap, SWAP_PROGRAM_ID } from "@saberhq/stableswap-sdk";
import { SaberRegistryProvider } from "saber-swap-registry-provider";

import { AccountUtils } from "./common/account-utils";
import {
  ParsedTokenAccount,
  SignerInfo,
  PdaDerivationResult,
  Collateral,
  CollateralAllocationResult,
  RebalanceConfig,
} from "./common/types";
import {
  addIxn,
  getSignersFromPayer,
  flattenValidInstructions,
  computeMappingFromList,
  computeSwapAmounts
} from "./common/util";
import { BucketProgram } from "./types/bucket_program";
import { DEVNET } from "./common/constant";

export class BucketClient extends AccountUtils {
  wallet: Wallet;
  provider!: Provider;
  bucketProgram!: Program<BucketProgram>;

  readonlyKeypair!: Keypair;

  // providers
  saberProvider!: SaberRegistryProvider;

  constructor(
    conn: Connection,
    wallet: anchor.Wallet,
    idl?: Idl,
    programId?: PublicKey,
  ) {
    super(conn);
    this.wallet = wallet;
    this.setProvider();
    this.setBucketProgram(idl, programId);

    // leakedKeypair is sometimes used for read-only operations
    this.readonlyKeypair = Keypair.generate();
    
    this.saberProvider = new SaberRegistryProvider();
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
    bucket: PublicKey,
    programID: PublicKey = this.bucketProgram.programId
  ) => {
    const [addr, bump] = await this.findProgramAddress(programID, ["issue", bucket]);

    return {
      addr,
      bump,
    } as PdaDerivationResult;
  };

  generateWithdrawAuthority = async (
    bucket: PublicKey,
    programID: PublicKey = this.bucketProgram.programId
  ) => {
    const [addr, bump] = await this.findProgramAddress(programID, ["withdraw", bucket]);

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

      // ignore: no account data
      if (!tokenAccount.value || tokenAccount.value.length === 0) {
        continue;
      }

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
    bucket: PublicKey, // optionally pass in bucket obj?
    owner: PublicKey,
    mints?: PublicKey[]
  ) => {
    const _mints = mints
      ? mints
      : (await this.fetchBucket(bucket)).collateral.map(collateral => collateral.mint);
    return this.fetchParsedTokenAccountsByMints(_mints, owner);
  };

  fetchCollateralAllocations = async (
    bucket: PublicKey,
    crate: PublicKey
  ): Promise<CollateralAllocationResult> => {
    const tokens = await this.fetchParsedTokenAccountsForAuthorizedCollateral(
      bucket,
      crate
    );

    return {
      allocations: tokens.map((token) => {
        return {
          mint: token.mint,
          supply: token.amount.toNumber(),
        };
      }),
      supply: tokens
        .map((token) => token.amount.toNumber())
        .reduce((a, b) => a + b)
    };
  };

  isAnyUnauthorizedCollateralTokensToRemove = async (reserve: PublicKey) => {
    const [crate, _crateBump] = await generateCrateAddress(reserve);
    const { addr: bucketAddress } = await this.generateBucketAddress(crate);
    const { collateral } = await this.fetchBucket(bucketAddress);

    // todo: this will break if someone just randomly transfers token to a crate ATA.
    // figure out how to verify the unauthorized tokens.
    const crateATAs = await this.fetchParsedTokenAccounts(crate);
    const _collateral = collateral.map((c) => c.mint.toBase58());

    return (
      crateATAs.filter((ata) => _collateral.includes(ata.mint.toBase58()))
        .length > 0
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
      await this.generateIssueAuthority(bucket);
    const { addr: withdrawAuthority, bump: withdrawBump } =
      await this.generateWithdrawAuthority(bucket);

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
  };

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

  // in the underlying swap, we need token A and token B. the client supplies
  // mintToRemove = token A. we will query current collateral amounts to figure
  // out what collateral mint to use as token B.
  removeUnauthorizedCollateralTokens = async (
    mintToRemove: PublicKey,
    reserve: PublicKey,
    payer: PublicKey | Keypair,
    cluster: Cluster = DEVNET,
    swapAccount?: PublicKey // allow localnet overrides
  ) => {
    const [crate, _crateBump] = await generateCrateAddress(reserve);
    const { addr: bucketAddress } = await this.generateBucketAddress(crate);
    const { collateral } = await this.fetchBucket(bucketAddress);

    const _mintToRemove = mintToRemove.toBase58();

    const collateralMints = collateral.map((c) => c.mint);
    if (collateralMints.length === 0) {
      throw new Error("no authorized collateral tokens to swap with");
    }

    if (
      collateralMints.map((mint) => mint.toBase58()).includes(_mintToRemove)
    ) {
      throw new Error(`${_mintToRemove} is an authorized mint`);
    }

    const mintAmountToRemove = (
      await this.fetchParsedTokenAccountsByMints([mintToRemove], crate)[0]
    ).amount;

    const authorizedCollateralATAs =
      await this.fetchParsedTokenAccountsForAuthorizedCollateral(
        bucketAddress,
        crate,
        collateral.map((c) => c.mint)
      );

    const reserveSupply = (
      await new Token(
        this.conn,
        reserve,
        this.bucketProgram.programId,
        this.readonlyKeypair
      ).getMintInfo()
    ).supply.toNumber();

    const collateralMintToAllocation = computeMappingFromList<Collateral>(
      collateral,
      (collateral: Collateral) => collateral.mint.toBase58()
    );

    // find an authorized collateral that is max distance away from target allocation;
    // alternatively, we will break early if we find a collateral that is mintAmountToRemove
    // amount away from the target allocation.
    let collateralToCredit = {
      mint: PublicKey.default, // dummy value
      allocationDifference: 0,
    };

    for (const ata of authorizedCollateralATAs) {
      const collateralShareOfSupply =
        reserveSupply *
        (collateralMintToAllocation[ata.mint.toBase58()].allocation / 10_000);

      const _allocationDifference =
        collateralShareOfSupply - ata.amount.toNumber();
      // current ATA amount is sufficiently far from the target allocation. greedily choose this mint.
      if (_allocationDifference > mintAmountToRemove) {
        collateralToCredit = {
          mint: ata.mint,
          allocationDifference: 0,
        };
        break;
      } else {
        if (_allocationDifference > collateralToCredit.allocationDifference) {
          collateralToCredit = {
            mint: ata.mint,
            allocationDifference: _allocationDifference,
          };
        }
      }
    }

    return this.rebalance(
      {
        // we decide amount to transfer on-chain
        amountIn: 0,
        maxSlippageBps: 0,
        tokenA: mintToRemove,
        tokenB: collateralToCredit.mint,
        swapAccount,
      },
      reserve,
      payer,
      cluster
    );
  };

  // in the future, we can enhance the sdk by having it select token mints to swap
  // between & how much of those tokens to swap. for now, we will require the client,
  // to provide this information for us.
  rebalance = async (
    rebalanceConfig: RebalanceConfig,
    reserve: PublicKey,
    payer: PublicKey | Keypair,
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
      rebalanceConfig.tokenA,
      rebalanceConfig.tokenB,
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
          withdrawAuthority: (await this.generateWithdrawAuthority(bucket)).addr,
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

    const depositorCollateralATA = await this.getOrCreateATA(
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
        depositorCollateral: depositorCollateralATA.address,
        depositorReserve: depositorReserveATA.address,
        oracle: oracle,
      },
      preInstructions: flattenValidInstructions([
        depositorCollateralATA,
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
      },
      remainingAccounts,
      preInstructions: createATAInstructions,
      signers: signerInfo.signers,
    });
  };
}
