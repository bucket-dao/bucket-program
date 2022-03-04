import React from "react";
import Image from "next/image";

import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
const Overview = () => {
  return (
    <div className="w-full text-center mx-auto max-w-6xl ">
      <div>
        <h1 className="mt-24 text-7xl font-bold">
          Solana's composale stablecoin
        </h1>

        <div className="max-w-md mt-16 mx-auto">
          <div className="flex justify-center">
            <WalletMultiButton startIcon={null as any}>
              Get Bucket 🪣
            </WalletMultiButton>
          </div>
        </div>
        <h3 className="mt-16 text-5xl font-bold">
          The bucket to welcome them all
        </h3>
        <div className="mt-8">
          lorem ipsum dolor sit amet, lorem ipsum dolor sit amet, lorem ipsum
          dolor sit amet, lorem ipsum dolor sit amet, lorem ipsum dolor sit
          amet, lorem ipsum dolor sit amet, lorem ipsum dolor sit amet, lorem
          ipsum dolor sit amet, lorem ipsum dolor sit amet, lorem ipsum dolor
          sit amet, lorem ipsum dolor sit amet, lorem ipsum dolor sit amet,
          lorem ipsum dolor sit amet, lorem ipsum dolor sit amet, lorem ipsum
          dolor sit amet, lorem ipsum dolor sit amet,
        </div>
        <div className="mt-16 justify-center flex mx-auto">
          Powered by
          <span className="mx-2">
            <Image src="/solana.svg" height={20} width={20} />
          </span>
          Solana
        </div>
      </div>
    </div>
  );
};

export default Overview;
