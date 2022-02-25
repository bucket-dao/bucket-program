import React from "react";

import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
const Overview = () => {
  return (
    <div className="w-full text-center">
      <div>
        <h1 className="mt-16 text-5xl font-bold">
          The stablecoin to welcome them all
        </h1>

        <div className="max-w-md mt-16 mx-auto">
          <div className="flex justify-center">
            <WalletMultiButton startIcon={null as any}>
              Get Bucket 🪣
            </WalletMultiButton>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Overview;
