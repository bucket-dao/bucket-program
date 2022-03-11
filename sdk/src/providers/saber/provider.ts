import { PublicKey, Cluster } from "@solana/web3.js";
import fetch from "node-fetch";
import { DEVNET, LOCALNET, TESTNET } from "../../common/constant";

import { Pool } from "./types";

// ===============================
// saber specific consts and types
// ===============================

const DEVNET_REGISTRY = "https://registry.saber.so/data/pools-info.devnet.json";
const MAINNET_REGISTRY =
  "https://registry.saber.so/data/pools-info.mainnet.json";

export type RegistryEndpoint = string;

// ================================================
// saber provider to help find pool info from mints
// ================================================
export class SaberProvider {
  // navigate from cluster -> mints -> pool
  pools!: Map<Cluster, Map<string, Pool>>;
  // provide o(1) lookup to check if there is a pool for a mint. this does not guaruntee
  // the pool exists between a specific pair of tokens but rather that there is any pool
  // for a token mint.
  mintsWithPools!: Map<Cluster, Set<string>>;

  constructor() {
    this.pools = new Map();
    this.mintsWithPools = new Map();

    this._refreshSwapAccounts().catch((err: any) =>
      console.log("unable to load saber registry data: ", err)
    );
  }

  _getRegistryKey = (
    tokenA: string | PublicKey,
    tokenB: string | PublicKey
  ): string => {
    const _tokenA = typeof tokenA === "string" ? tokenA : tokenA.toBase58();
    const _tokenB = typeof tokenB === "string" ? tokenB : tokenB.toBase58();

    return _tokenA < _tokenB
      ? `${_tokenA}-${_tokenB}`
      : `${_tokenB}-${_tokenA}`;
  };

  _loadSwapAccountsFromSaberRegistry = (
    registry: RegistryEndpoint
  ): Promise<Pool[]> => {
    return fetch(registry)
      .then((res: any) => res.json())
      .then((res: any) => res["pools"].map((pool: any) => pool as Pool))
      .catch((err: any) => console.log("err: ", err));
  };

  _fetchActiveRegistryEndpoints = () => {
    return {
      devnet: DEVNET_REGISTRY,
      "mainnet-beta": MAINNET_REGISTRY,
    };
  };

  _refreshSwapAccounts = async () => {
    if (this.pools === undefined) {
      this.pools = new Map();
    }

    for (const [cluster, registryEndpoint] of Object.entries(
      this._fetchActiveRegistryEndpoints()
    )) {
      const _cluster = cluster as Cluster;
      const pools: Pool[] = await this._loadSwapAccountsFromSaberRegistry(
        registryEndpoint
      );

      for (const pool of pools) {
        if (!this.pools.has(_cluster)) {
          this.pools.set(_cluster, new Map());
          this.mintsWithPools.set(_cluster, new Set());
        }

        const _tokenA = pool.swap.state.tokenA.mint;
        const _tokenB = pool.swap.state.tokenB.mint;
        const registryKey = this._getRegistryKey(_tokenA, _tokenB);

        this.mintsWithPools.get(_cluster)?.add(_tokenA);
        this.mintsWithPools.get(_cluster)?.add(_tokenB);
        this.pools.get(_cluster)?.set(registryKey, pool);
      }
    }
  };

  getSwapPoolFromMints = async (
    tokenA: PublicKey,
    tokenB: PublicKey,
    cluster: Cluster = DEVNET
  ) => {
    if ([LOCALNET, TESTNET].includes(cluster)) {
      throw new Error(
        "only mainnet and devnet swap accounts supported right now"
      );
    }

    if (this.pools === undefined || !this.pools.has(cluster)) {
      await this._refreshSwapAccounts();
    }

    const registryKey = this._getRegistryKey(tokenA, tokenB);
    if (!this.pools.get(cluster)?.has(registryKey)) {
      throw new Error(
        `no swap pool found for mints [${tokenA.toBase58()}] and B [${tokenB.toBase58()}]`
      );
    }

    return this.pools.get(cluster)?.get(registryKey);
  };

  getSwapAccountFromMints = async (
    tokenA: PublicKey,
    tokenB: PublicKey,
    cluster: Cluster = DEVNET
  ): Promise<PublicKey> => {
    const pool = await this.getSwapPoolFromMints(tokenA, tokenB, cluster);

    const _pk = pool?.swap.config.swapAccount;
    if (!_pk)
      throw new Error(
        `no swap pool account found for mints [${tokenA.toBase58()}] and B [${tokenB.toBase58()}]`
      );

    return new PublicKey(_pk);
  };

  isPoolExistForMint = (
    mint: PublicKey,
    cluster: Cluster = DEVNET
  ): boolean => {
    const _clusterResult = this.mintsWithPools.get(cluster);

    return _clusterResult ? _clusterResult.has(mint.toBase58()) : false;
  };
}
