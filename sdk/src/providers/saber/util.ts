import { u64 } from "@solana/spl-token";
import invariant from "tiny-invariant";

import { MAX_BPS, ZERO_U64 } from "../../common/constant";
import { SwapAmount } from "../../common/types";

// given max slippage in bps, calculate the minimum amount of token B we are willing to accept after the swap.
export const computeSwapAmounts = (
  amountIn: number,
  maxSlippageBps: number
): SwapAmount => {
  const _amountIn = new u64(amountIn);
  const _minimumAmountOut = new u64(Math.round(amountIn * ((MAX_BPS - maxSlippageBps) / MAX_BPS)));

  invariant(
    _minimumAmountOut.gte(ZERO_U64),
    'amount in + slippage must result in a minimum amount out greater than zero'
  );

  invariant(
    _amountIn.gte(_minimumAmountOut),
    'amount in must be greater than or equal to minimum amount out'
  );

  return {
    amountIn: _amountIn,
    minAmountOut: _minimumAmountOut
  };
}