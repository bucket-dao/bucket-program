import React, { useMemo } from "react";
import type { AppProps } from "next/app";
import dynamic from "next/dynamic";
import { ConnectionProvider } from "@solana/wallet-adapter-react";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";

import "tailwindcss/tailwind.css";
import "../styles/globals.css";
import "../styles/App.css";

// const SOLANA_NETWORK = WalletAdapterNetwork.Mainnet;
const SOLANA_NETWORK = WalletAdapterNetwork.Devnet;
const network = SOLANA_NETWORK;
let _endpoint = "https://api.devnet.solana.com";
if (network !== WalletAdapterNetwork.Devnet) {
  _endpoint = "https://api.mainnet-beta.solana.com";
}

const WalletProvider = dynamic(
  () => import("../contexts/ClientWalletProvider"),
  {
    ssr: false,
  }
);

function MyApp({ Component, pageProps }: AppProps) {
  const endpoint = useMemo(() => _endpoint, []);

  return (
    <div className="bg-transparent">
      <ConnectionProvider endpoint={endpoint}>
        <WalletProvider>
          <Component {...pageProps} />
        </WalletProvider>
      </ConnectionProvider>
    </div>
  );
}

export default MyApp;
