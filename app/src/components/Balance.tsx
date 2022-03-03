import { mintToSymbol } from "../utils/utils";

type Props = {
  collateralTokens: any[];
  reserveToken: any;
};

const Balance = ({ collateralTokens, reserveToken }: Props) => {
  return (
    <div>
      <div className="rounded-lg  mt-16 mx-auto shadow-lg bg-white p-6 hover:shadow-2xl w-full max-w-lg">
        <div className="text-xl text-center mb-2">Your Current Balance</div>
        <div className="text-left">
          <div className="text-xl">Collateral Balance</div>
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

          <div className=" mt-4  ">
            <div className="text-xl">Bucket Balance</div>
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
          </div>
        </div>
      </div>
    </div>
  );
};

export default Balance;
