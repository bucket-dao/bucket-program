import { useContext, useEffect, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { SignerWalletAdapter } from "@solana/wallet-adapter-base";
import { BucketClient } from "@bucket-program/sdk";

import { initBucketClient } from "../../utils/bucket";
import { getCurrentTokenData } from "../../utils/tokens";
import Deposit from "../../components/Deposit/Deposit";
import Balance from "../../components/Balance";
import Redeem from "../../components/Redeem/Redeem";
enum ActionView {
  DEPOSIT,
  REDEEM,
}
const Swapview = () => {
  const connection = useConnection();
  const wallet = useWallet();
  const [bucketClient, setBucketClient] = useState<BucketClient>();

  const [collateralTokens, setCollateralTokens] = useState([]);
  const [defaultCollateralToken, setDefaultCollateralToken] = useState();
  const [reserveToken, setReserveToken] = useState([]);
  const [currentMaxAmount, setCurrentMaxAmount] = useState<{
    amount: string;
    decimals: number;
  }>({
    amount: "0",
    decimals: 1,
  });

  const [view, setView] = useState(ActionView.DEPOSIT);

  useEffect(() => {
    const init = async (): Promise<BucketClient> => {
      return await initBucketClient(
        connection.connection,
        wallet.adapter as SignerWalletAdapter
      );
    };

    // remove later, sanity check that client actually inits
    init().then(async (client) => {
      if (wallet.publicKey) {
        setBucketClient(client);

        const {
          collateralTokens: _collateralTokens,
          currentCollateralToken: defaultCollateralToken,
          currentMaxAmount: _currentMaxAmount,
          reserveToken: _reserveToken,
        } = await getCurrentTokenData(wallet);
        console.log(_currentMaxAmount);

        setCollateralTokens(_collateralTokens);
        setDefaultCollateralToken(defaultCollateralToken);
        setCurrentMaxAmount(_currentMaxAmount);
        setReserveToken(_reserveToken);
      }
    });
  }, []);

  return (
    <div className="w-full text-black grid grid-cols-6">
      <div></div>
      <div className="col-span-4">
        {bucketClient && (
          <div className="max-w-lg mx-auto font-bold">
            <div className="grid gap-8 grid-cols-2 text-2xl">
              <div className="p-2">
                <button
                  className={`${
                    view == ActionView.DEPOSIT && "underline"
                  } font-bold hover:bg-gray-100 hover:rounded-lg p-2`}
                  onClick={() => setView(ActionView.DEPOSIT)}
                >
                  Deposit
                </button>
              </div>
              <div className="p-2">
                <button
                  className={`${
                    view == ActionView.REDEEM && "underline"
                  } font-bold hover:bg-gray-100 hover:rounded-lg p-2 `}
                  onClick={() => setView(ActionView.REDEEM)}
                >
                  Redeem
                </button>
              </div>
            </div>
            <div className="mt-4">
              {view == ActionView.DEPOSIT && defaultCollateralToken && (
                <Deposit
                  collateralTokens={collateralTokens}
                  defaultCollateralToken={defaultCollateralToken}
                  currentMaxAmount={currentMaxAmount}
                  setCurrentMaxAmount={setCurrentMaxAmount}
                  wallet={wallet}
                  bucketClient={bucketClient}
                />
              )}
              {view == ActionView.REDEEM && (
                <Redeem
                  reserveToken={reserveToken.length > 0 ? reserveToken[0] : []}
                />
              )}
            </div>
          </div>
        )}
      </div>
      <div>
        <Balance
          collateralTokens={collateralTokens}
          reserveToken={reserveToken}
        />
      </div>
    </div>
  );
};

export default Swapview;
