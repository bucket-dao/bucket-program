import { useEffect } from 'react';
import { LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { SignerWalletAdapter } from '@solana/wallet-adapter-base';
import { BucketClient } from "@bucket-program/sdk"; 

import { initBucketClient } from "../../utils/bucket";

const Swapview = () => {
  const connection = useConnection();
  const wallet = useWallet();

  useEffect(() => {
    const init = async (): Promise<BucketClient> => {
      return await initBucketClient(
          connection.connection,
          wallet.adapter as SignerWalletAdapter
      );
    };

    // remove later, sanity check that client actually inits
    init().then(async client => {
      const balance = await client.getBalance(new PublicKey("CdQoc4TaBkXpWvMUumUmAGR1jdG2dsMG3YEa5TaVU7mG"));
      console.log('balance: ', balance / LAMPORTS_PER_SOL);
    });
  }, []);

  return (
    <div className="text-center w-full">
      <h1 className="mt-16 text-5xl font-bold">TODO: Get Bucket View</h1>
    </div>
  );
};

export default Swapview;
