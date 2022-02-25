// import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

import { useWallet } from "@solana/wallet-adapter-react";
import { ENV } from "../../constants";
import { shortenAddress } from "../../utils/utils";

const Navbar = () => {
  const { publicKey } = useWallet();
  return (
    <div className="navbar w-full mb-2 text-neutral-content rounded-box">
      <div className="flex-none">
        <button className="btn btn-square btn-ghost">
          <span className="text-4xl">🪣</span>
        </button>
      </div>
      <div className="flex-1 px-2 mx-2">
        <span className="text-3xl font-bold">Bucket DAO</span>
      </div>
      <div className="flex-none mx-2 text-2xl">
        {publicKey ? shortenAddress(publicKey.toBase58()) : ENV}
        {/* <WalletMultiButton className="btn btn-ghost" /> */}
      </div>
    </div>
  );
};

export default Navbar;
