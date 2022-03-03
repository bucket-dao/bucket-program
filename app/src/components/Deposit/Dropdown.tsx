/* This example requires Tailwind CSS v2.0+ */
import { Dispatch, Fragment, SetStateAction, useEffect, useState } from "react";
import { Menu, Transition } from "@headlessui/react";
import { mintToSymbol } from "../../utils/utils";
import { ChevronDownIcon } from "@heroicons/react/solid";

function classNames(...classes: any) {
  return classes.filter(Boolean).join(" ");
}
type Props = {
  collateralMint: any;
  setCollateralMint: any;
  allCollateralMints: any;
  setCurrentMaxAmount: Dispatch<
    SetStateAction<{ amount: string; decimals: number }>
  >;
};
export default function Dropdown({
  collateralMint,
  setCollateralMint,
  allCollateralMints,
  setCurrentMaxAmount,
}: Props) {
  const handleTokenChange = (
    mint: string,
    tokenAmount: { amount: string; decimals: number }
  ) => {
    console.log("updating");
    const _tokenAmount = { ...tokenAmount };
    console.log(_tokenAmount);
    
    setCollateralMint(mint);
    setCurrentMaxAmount(_tokenAmount);
  };
  return (
    <Menu as="div" className="relative inline-block text-left h-full ">
      <div className="h-full">
        <Menu.Button className=" w-full h-full text-left font-bold rounded-lg p-3 hover:bg-gray-300 flex justify-between">
          <div>$ {mintToSymbol[collateralMint]}</div>
          <div>
            <ChevronDownIcon
              className="-mr-1 ml-2 mt-1 h-5 w-5"
              aria-hidden="true"
            />
          </div>
        </Menu.Button>
      </div>

      <Transition
        as={Fragment}
        enter="transition ease-out duration-100"
        enterFrom="transform opacity-0 scale-95"
        enterTo="transform opacity-100 scale-100"
        leave="transition ease-in duration-75"
        leaveFrom="transform opacity-100 scale-100"
        leaveTo="transform opacity-0 scale-95"
      >
        <Menu.Items className="origin-top-right absolute left-0 w-full rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 focus:outline-none">
          <div className="p-2">
            {allCollateralMints.length > 0 &&
              allCollateralMints.map((token: any, key: number) => {
                const tokenInfo = token.account.data.parsed.info;
                if (tokenInfo.mint != collateralMint) {
                  return (
                    <Menu.Item key={key}>
                      {({ active }: any) => (
                        <div
                          className={classNames(
                            active
                              ? "bg-gray-100 text-gray-900"
                              : "text-gray-700",
                            "block p-3 cursor-pointer hover:bg-gray-200 rounded-lg"
                          )}
                          onClick={() =>
                            handleTokenChange(tokenInfo.mint, {
                              amount: tokenInfo.tokenAmount.amount,
                              decimals: tokenInfo.tokenAmount.decimals,
                            })
                          }
                        >
                          {mintToSymbol[tokenInfo.mint]}
                        </div>
                      )}
                    </Menu.Item>
                  );
                }
              })}
          </div>
        </Menu.Items>
      </Transition>
    </Menu>
  );
}
