import * as anchor from "@project-serum/anchor";
import { TokenListProvider } from "@solana/spl-token-registry";
import {
  AUTHORIZED_COLLATERAL_TOKENS,
  connection,
  network,
  RESERVE_MINT,
} from "./constant";

export const getCurrentTokenData = async (wallet: any) => {
  const tokens = await getAuthorizedTokens(
    wallet.publicKey.toBase58(),
    AUTHORIZED_COLLATERAL_TOKENS
  );

  const currentToken = tokens.length > 0 && tokens[0];
  console.log(currentToken);
  console.log(tokens);

  const currentMaxAmount =
    tokens.length > 0
      ? {
          amount: currentToken.account.data.parsed.info.tokenAmount.amount,
          decimals: currentToken.account.data.parsed.info.tokenAmount.decimals,
        }
      : {
          amount: "0",
          decimals: 1,
        };
  console.log(currentMaxAmount);

  const reserveToken = await getAuthorizedTokens(wallet.publicKey.toBase58(), [
    RESERVE_MINT,
  ]);
  return {
    collateralTokens: tokens,
    currentCollateralToken:
      tokens.length > 0 && currentToken.account.data.parsed.info.mint,
    currentMaxAmount: currentMaxAmount,
    reserveToken: reserveToken,
  };
};

export const getAllTokenData = async (wallet: string) => {
  let walletKey = new anchor.web3.PublicKey(wallet);
  const splTokenRes = await connection.getParsedTokenAccountsByOwner(
    walletKey,
    {
      programId: new anchor.web3.PublicKey(
        "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
      ),
    }
  );
  return splTokenRes && splTokenRes;
};

export const getTokens = async (wallet: string) => {
  return _getAllTokenDataFiltered(wallet);
};

export const getAuthorizedTokens = async (wallet: string, mints: string[]) => {
  const tokens = await getAllTokenData(wallet);
  console.log(tokens);

  const filteredTokens = tokens.value.filter((tokenData: any) =>
    mints.includes(tokenData?.account.data.parsed.info.mint)
  );
  console.log("filteredTokens", filteredTokens);
  return filteredTokens;
};

const _getAllTokenDataFiltered = async (walletKeyAsString: string) => {
  const tokens = await getAllTokenData(walletKeyAsString);
  console.log("alltokens", tokens);

  let tokenList = await new TokenListProvider().resolve().then((tokens) => {
    const tokenList = tokens.filterByClusterSlug(network).getList();
    return tokenList;
  });

  let allTokens = [];
  if (tokens && tokens.value) {
    for (const token of tokens.value) {
      const mint = token.account.data.parsed.info.mint;
      const amount = token.account.data.parsed.info.tokenAmount.amount;

      const tkn = tokenList.find((token) => token.address == mint);
      console.log(tkn);

      if (tkn) {
        //   let priceUSD = await getTokenPrice(mint, symbol);
        //   if (!symbol.includes("SCAM") && !priceUSD) {
        //     priceUSD = await getTokenPrice2(name);
        //   }
        allTokens.push({
          name: tkn.name,
          symbol: tkn.symbol,
          amount,
          mint,
          tags: tkn.tags,
          logoURI: tkn.logoURI,
          decimals: tkn.decimals,
          //   priceUSD,
        });
      }
    }
  }

  return allTokens;
};
