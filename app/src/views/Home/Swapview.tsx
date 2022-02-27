import { useEffect } from "react";
import { Keypair, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { SignerWalletAdapter } from "@solana/wallet-adapter-base";
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
    init().then(async (client) => {
      const balance = await client.getBalance(
        new PublicKey("EozbUuZeSq8wxmStgXUTaPCyZHVnYn7kxEcpk4FwnmDo")
      );
      console.log("balance: ", balance / LAMPORTS_PER_SOL);
      if (wallet.publicKey) {
        const reserve = Keypair.generate();
        const payer = wallet.publicKey;
      }
    });
  }, []);

  return (
    <div className="text-center w-full">
      <h1 className="mt-16 text-5xl font-bold">
        <div className="h-screen bg-gray-100 flex items-center justify-center">
          <a
            className="rounded-lg shadow-lg bg-white p-6 w-72 group hover:shadow-2xl"
            href="#"
          >
            <p className="text-lg text-gray-800 font-semibold">swap</p>
            <div className="flex flex-row mt-3 gap-2 place-items-end">
              <p className="text-6xl font-bold"> $10 </p>
              <p className="text-2xl font-light items-bottom pb-1"> /mo </p>
            </div>
          </a>
        </div>
      </h1>
    </div>
  );
};

export default Swapview;
