import { useContext, useEffect, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { SignerWalletAdapter } from "@solana/wallet-adapter-base";
import { BucketClient } from "@bucket-program/sdk";

import { initBucketClient } from "../../utils/bucket";
import { getCurrentTokenData } from "../../utils/tokens";
import Deposit from "../../components/Deposit/Deposit";
import Balance from "../../components/Balance";
import Redeem from "../../components/Redeem/Redeem";
// import BucketContext from "../../contexts/BucketContext";

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
    <div className="w-full text-black">
      {bucketClient && (
        <div className=" font-bold">
          <div className="mt-16">
            {defaultCollateralToken && (
              <Deposit
                collateralTokens={collateralTokens}
                defaultCollateralToken={defaultCollateralToken}
                currentMaxAmount={currentMaxAmount}
                setCurrentMaxAmount={setCurrentMaxAmount}
                wallet={wallet}
                bucketClient={bucketClient}
              />
            )}
          </div>
          <div className="mt-16">
            <Redeem
              reserveToken={reserveToken.length > 0 ? reserveToken[0] : []}
            />
          </div>
          <Balance
            collateralTokens={collateralTokens}
            reserveToken={reserveToken}
          />
        </div>
      )}
    </div>
  );
};

export default Swapview;
