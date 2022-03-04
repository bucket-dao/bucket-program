import { useEffect, useState } from "react";

type Props = {
  reserveToken: any;
};

const Redeem = ({ reserveToken }: Props) => {
  const [withdrawAmount, setWithdrawAmount] = useState("");
  useEffect(() => {
    console.log(reserveToken);
  }, [reserveToken]);

  const handleWithdrawAmountUpdate = (amnt: string) => {
    const tokenAmount = reserveToken.account.data.parsed.info.tokenAmount;
    const maxAmount = +tokenAmount.amount / 10 ** tokenAmount.decimals;

    // update user deposit amount if valid
    if (+amnt >= 0 && +amnt <= maxAmount) {
      setWithdrawAmount(amnt);
    }
  };

  const handleSetMaxAmount = () => {
    const tokenAmount = reserveToken.account.data.parsed.info.tokenAmount;
    const maxAmount = +tokenAmount.amount / 10 ** tokenAmount.decimals;
    setWithdrawAmount(maxAmount.toString());
  };

  const redeem = async () => {
    // if (wallet && wallet.publicKey && bucketClient) {
    //   const [crate, _bump] = await generateCrateAddress(
    //     new PublicKey("FgfeF24bnbZdnM7ryv6pSK87Pc89VTgfqgDhV6GqvEKo")
    //   );
    //   const { addr: bucket } = await bucketClient.generateBucketAddress(crate);
    //   const { whitelist } = await bucketClient.fetchBucket(bucket);
    //   const _collaterals = whitelist.map((el) => new PublicKey(el));
    //   console.log(">", _collaterals);
    //   const programID = new PublicKey(
    //     "EEu81GF1qYdoiBp9V13o7sZUcmXChYr5wcv3z9zLPf39"
    //   );
    //   const { addr: withdrawAuthority, bump } =
    //     await bucketClient.generateWithdrawAuthority(programID);
    //   console.log("withdrawAuthority:", withdrawAuthority);
    //   const res = await bucketClient.redeem(
    //     new u64(1000000),
    //     new PublicKey("FgfeF24bnbZdnM7ryv6pSK87Pc89VTgfqgDhV6GqvEKo"),
    //     _collaterals,
    //     withdrawAuthority,
    //     wallet.publicKey
    //   );
    //   console.log("withdraw response", res);
    // }
  };
  return (
    <div className="rounded-lg shadow-lg border-black border mx-auto  bg-white p-6 w-full max-w-lg ">
        <div>You redeem</div>
      <div className="rounded-lg mt-4 bg-gray-200 grid grid-cols-3 gap-4">
        <div className="p-3 pt-4">🪣 BUCK</div>
        <div className="col-span-2  rounded-lg">
          <input
            className="p-3 bg-transparent text-xl font-bold outline-none text-right w-full"
            value={withdrawAmount}
            onChange={(e) => handleWithdrawAmountUpdate(e.target.value)}
          ></input>
        </div>
      </div>
      <div className="text-sm text-right mr-4 mt-1">
        <button onClick={handleSetMaxAmount}>max</button>
      </div>
      <div className="h-4"></div>
      <div
        onClick={redeem}
        className="text-xl pb-2 pt-3 cursor-pointer border border-black rounded-lg text-center  mx-auto bg-white hover:bg-gray-100"
      >
        Redeem
      </div>
    </div>
  );
};

export default Redeem;
