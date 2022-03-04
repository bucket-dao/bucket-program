import { BucketClient } from "@bucket-program/sdk";
import { u64 } from "@solana/spl-token";
import { WalletContextState } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { Dispatch, SetStateAction, useEffect, useState } from "react";
import { BUCKET_PROGRAM_ID, RESERVE_MINT } from "../../utils/constant";
import Dropdown from "./Dropdown";

type Props = {
  collateralTokens: any[];
  defaultCollateralToken: any;
  currentMaxAmount: { amount: string; decimals: number };
  setCurrentMaxAmount: Dispatch<
    SetStateAction<{ amount: string; decimals: number }>
  >;
  wallet: WalletContextState;
  bucketClient: BucketClient;
};

const Deposit = ({
  collateralTokens,
  defaultCollateralToken,
  currentMaxAmount,
  setCurrentMaxAmount,
  wallet,
  bucketClient,
}: Props) => {
  const [collateralMint, setCollateralMint] = useState(defaultCollateralToken);
  const [depositAmount, setDepositAmount] = useState("");

  useEffect(() => {
    // update deposit amnt if above new max amnt
    const currentAmount =
      +currentMaxAmount.amount / 10 ** currentMaxAmount.decimals;
    if (+depositAmount > currentAmount) {
      setDepositAmount(currentAmount.toString());
    }
  }, [currentMaxAmount.amount, currentMaxAmount.decimals]);

  const handleDepositAmountUpdate = (amnt: string) => {
    const maxAmount =
      +currentMaxAmount.amount / 10 ** currentMaxAmount.decimals;

    // update user deposit amount if valid
    if (+amnt >= 0 && +amnt <= maxAmount) {
      setDepositAmount(amnt);
    }
  };
  const handleSetMaxAmount = () => {
    setDepositAmount(
      (+currentMaxAmount.amount / 10 ** currentMaxAmount.decimals).toString()
    );
  };
  const deposit = async () => {
    if (wallet && wallet.publicKey && bucketClient) {
      const { addr: issueAuthority, bump } =
        await bucketClient.generateIssueAuthority(BUCKET_PROGRAM_ID);

      const _depositAmount = +depositAmount * 10 ** currentMaxAmount.decimals;
      // using devnet usdc oracle for now
      const oracle = new PublicKey(
        "5U3bH5b6XtG99aVWLqwVzYPVpQiFHytBD68Rz2eFPZd7"
      );
      const res = await bucketClient.deposit(
        new u64(_depositAmount),
        new PublicKey(RESERVE_MINT),
        new PublicKey(collateralMint),
        issueAuthority,
        wallet.publicKey,
        oracle
      );
      console.log("deposit response", res);
    }
  };

  return (
    <div className="rounded-lg shadow-lg  mx-auto hover:shadow-2xl bg-white p-6 w-full max-w-lg ">
      <div>You pay</div>
      <div className="rounded-lg p-2 mt-4 bg-gray-200 grid grid-cols-3 gap-4">
        {collateralTokens && (
          <Dropdown
            collateralMint={collateralMint}
            setCollateralMint={setCollateralMint}
            allCollateralMints={collateralTokens}
            setCurrentMaxAmount={setCurrentMaxAmount}
          />
        )}
        <div className="col-span-2  rounded-lg">
          <input
            className="p-3 bg-transparent text-xl font-bold outline-none text-right w-full"
            value={depositAmount}
            onChange={(e) => handleDepositAmountUpdate(e.target.value)}
          ></input>
        </div>
      </div>
      <div className="text-sm text-right mr-4 mt-1">
        <button onClick={handleSetMaxAmount}>max</button>
      </div>
      <div className="h-4"></div>
      <div>You receive</div>
      <div className="rounded-lg p-2 my-4 bg-gray-200 grid grid-cols-3 gap-4">
        <div className="p-3">🪣 BUCK</div>
        <div className="col-span-2  rounded-lg">
          <div className="p-3 bg-transparent text-xl font-bold outline-none text-right w-full">
            {depositAmount ? depositAmount : 0}
          </div>
        </div>
      </div>
      <div className="h-4"></div>
      <div
        onClick={deposit}
        className="w-32 cursor-pointer rounded-lg text-center text-white mx-auto p-4 bg-gray-600"
      >
        Deposit
      </div>
    </div>
  );
};

export default Deposit;
