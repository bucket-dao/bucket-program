import { mintToSymbol } from "../utils/utils";

type Props = {
  collateralTokens: any[];
  reserveToken: any;
};

const Balance = ({ collateralTokens, reserveToken }: Props) => {
  return (
    <div>
      <div className="rounded-lg  mx-auto shadow-lg bg-white p-6 hover:shadow-xl w-full max-w-lg border border-black">
        <div className="text-2xl mb-2 font-bold">Your Balance:</div>
        <div className="text-left">
          <div className="text-xl font-bold">Collateral</div>
          {collateralTokens.length > 0 ? (
            <div className="font-medium">
              {collateralTokens.map((token: any, key: number) => {
                const tokenInfo = token.account.data.parsed.info;
                return (
                  <div key={key}>
                    <div>
                      {tokenInfo.tokenAmount.uiAmount}{" "}
                      {mintToSymbol[tokenInfo.mint]}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="font-medium">
              you don't own any accepted stablecoins
            </div>
          )}

          <div className=" mt-4  ">
            <div className="text-xl font-bold">Bucket Balance</div>
            {reserveToken.length > 0 ? (
              <div className="font-medium">
                {reserveToken.map((token: any, key: number) => {
                  const tokenInfo = token.account.data.parsed.info;
                  return (
                    <div key={key}>
                      <div>
                        {tokenInfo.tokenAmount.uiAmount}{" "}
                        {mintToSymbol[tokenInfo.mint]}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="font-medium">you don't own any Bucket USD</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Balance;
