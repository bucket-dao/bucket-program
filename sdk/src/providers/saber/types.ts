export interface Pool {
  id: string;
  name: string;
  tokens: TokenIconElement[];
  tokenIcons: TokenIconElement[];
  underlyingIcons: UnderlyingIcon[];
  currency: string;
  lpToken: LpToken;
  plotKey: string;
  swap: Swap;
  quarry: string;
}

export interface LpToken {
  symbol: string;
  name: string;
  logoURI: string;
  decimals: number;
  address: string;
  chainId: number;
  tags: string[];
  extensions: LpTokenExtensions;
}

export interface LpTokenExtensions {
  website: string;
  underlyingTokens: string[];
  source: string;
}

export interface Swap {
  config: Config;
  state: State;
}

export interface Config {
  swapAccount: string;
  swapProgramID: string;
  tokenProgramID: string;
  authority: string;
}

export interface State {
  isInitialized: boolean;
  isPaused: boolean;
  nonce: number;
  futureAdminDeadline: number;
  futureAdminAccount: string;
  adminAccount: string;
  tokenA: Token;
  tokenB: Token;
  poolTokenMint: string;
  initialAmpFactor: string;
  targetAmpFactor: string;
  startRampTimestamp: number;
  stopRampTimestamp: number;
  fees: Fees;
}

export interface Fees {
  adminTrade: AdminTrade;
  adminWithdraw: AdminTrade;
  trade: AdminTrade;
  withdraw: AdminTrade;
}

export interface AdminTrade {
  formatted: string;
  numerator: string;
  denominator: string;
}

export interface Token {
  adminFeeAccount: string;
  reserve: string;
  mint: string;
}

export interface TokenIconElement {
  name: string;
  address: string;
  decimals: number;
  chainId: number;
  symbol: string;
  logoURI: string;
  tags: string[];
  extensions: TokenIconExtensions;
}

export interface TokenIconExtensions {
  currency: string;
  website?: string;
  assetContract?: string;
  underlyingTokens?: string[];
}

export interface UnderlyingIcon {
  name: string;
  address: string;
  decimals: number;
  chainId: number;
  symbol: string;
  logoURI: string;
  tags: string[];
  extensions: UnderlyingIconExtensions;
}

export interface UnderlyingIconExtensions {
  currency: string;
}
