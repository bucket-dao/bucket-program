import { useWallet } from "@solana/wallet-adapter-react";
import { FC } from "react";
import Overview from "./Overview";
import Swapview from "./Swapview";

const Home: FC = ({}) => {
  const { publicKey } = useWallet();
  return (
    <div>{publicKey ? <Swapview publicKey={publicKey} /> : <Overview />}</div>
  );
};

export default Home;
