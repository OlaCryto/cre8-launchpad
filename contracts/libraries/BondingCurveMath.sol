// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title BondingCurveMath
 * @notice Virtual constant-product AMM math (Pump.fun-style bonding curve)
 * @dev Uses virtual reserves to create an exponential price curve.
 *
 * Model:
 *   The curve behaves like a Uniswap-style x*y=k pool with virtual starting reserves.
 *   - k = virtualAvax * virtualTokens (invariant, set once at config time)
 *   - effectiveTokens = virtualTokens - currentSupply (tokens remaining in virtual pool)
 *   - effectiveAvax = k / effectiveTokens (AVAX side of virtual pool)
 *
 * Price dynamics:
 *   - Price(s) = effectiveAvax * PRECISION / effectiveTokens
 *   - Price increases exponentially as supply is bought (effectiveTokens shrinks)
 *   - Early buyers get dramatically more tokens per AVAX than late buyers
 *   - Creates strong FOMO / early-buyer dynamics (same as Pump.fun)
 *
 * Rounding strategy (same as Arena/Pump.fun):
 *   - calculateBuyCost:        CEILING (buyer pays slightly more)
 *   - calculatePurchaseReturn:  FLOOR   (buyer gets fewer tokens)
 *   - calculateSaleReturn:      FLOOR   (seller gets less AVAX)
 *   This ensures the reserve always accumulates tiny dust, preventing drain exploits.
 *
 * Overflow protection:
 *   With virtualAvax = 30e18 and virtualTokens = 1.073e27,
 *   k = 3.219e46. Largest intermediate: k * effectiveTokens ≈ 3.45e73,
 *   well within uint256 max (~1.16e77).
 */
library BondingCurveMath {
    uint256 internal constant PRECISION = 1e18;
    uint256 internal constant BPS_DENOMINATOR = 10000;

    error MathOverflow();
    error InvalidInput();
    error InsufficientLiquidity();

    /**
     * @notice Calculate the instantaneous price at a given supply level
     * @param currentSupply Current tokens sold (wei)
     * @param virtualAvax Virtual AVAX reserve at launch
     * @param virtualTokens Virtual token reserve at launch
     * @return price Current price in wei per 1e18 tokens
     */
    function getCurrentPrice(
        uint256 currentSupply,
        uint256 virtualAvax,
        uint256 virtualTokens
    ) internal pure returns (uint256 price) {
        uint256 effectiveTokens = virtualTokens - currentSupply;
        if (effectiveTokens == 0) revert InsufficientLiquidity();

        // effectiveAvax = k / effectiveTokens = virtualAvax * virtualTokens / effectiveTokens
        // price per 1e18 tokens = effectiveAvax * PRECISION / effectiveTokens
        uint256 effectiveAvax = virtualAvax * virtualTokens / effectiveTokens;
        price = effectiveAvax * PRECISION / effectiveTokens;
    }

    /**
     * @notice Calculate AVAX cost for a specific token amount (CEILING — buyer pays more)
     * @dev cost = k * tokenAmount / (effectiveTokens * newEffectiveTokens)  [ceiling]
     *
     * @param tokenAmount Number of tokens to buy (wei)
     * @param currentSupply Current tokens sold
     * @param virtualAvax Virtual AVAX reserve
     * @param virtualTokens Virtual token reserve
     * @return cost AVAX cost (rounded UP)
     */
    function calculateBuyCost(
        uint256 tokenAmount,
        uint256 currentSupply,
        uint256 virtualAvax,
        uint256 virtualTokens
    ) internal pure returns (uint256 cost) {
        if (tokenAmount == 0) return 0;

        uint256 effectiveTokens = virtualTokens - currentSupply;
        if (tokenAmount >= effectiveTokens) revert InsufficientLiquidity();

        uint256 newEffectiveTokens = effectiveTokens - tokenAmount;
        uint256 k = virtualAvax * virtualTokens;

        // cost = k * tokenAmount / (effectiveTokens * newEffectiveTokens)  [ceiling]
        uint256 numerator = k * tokenAmount;
        uint256 denominator = effectiveTokens * newEffectiveTokens;
        cost = (numerator + denominator - 1) / denominator;
    }

    /**
     * @notice Calculate tokens received for a given AVAX amount (FLOOR — buyer gets less)
     * @dev tokensOut = effectiveTokens * avaxAmount / (effectiveAvax + avaxAmount)
     *
     *      Derived from constant product:
     *        newEffectiveAvax = effectiveAvax + avaxAmount
     *        newEffectiveTokens = k / newEffectiveAvax
     *        tokensOut = effectiveTokens - newEffectiveTokens
     *
     *      Simplified to avoid intermediate overflow.
     *
     * @param avaxAmount Amount of AVAX to spend (after fees)
     * @param currentSupply Current tokens sold
     * @param virtualAvax Virtual AVAX reserve
     * @param virtualTokens Virtual token reserve
     * @return tokensOut Tokens to receive (rounded DOWN)
     */
    function calculatePurchaseReturn(
        uint256 avaxAmount,
        uint256 currentSupply,
        uint256 virtualAvax,
        uint256 virtualTokens
    ) internal pure returns (uint256 tokensOut) {
        if (avaxAmount == 0) return 0;

        uint256 effectiveTokens = virtualTokens - currentSupply;
        uint256 k = virtualAvax * virtualTokens;

        // Ceiling effectiveAvax to be conservative (buyer gets fewer tokens)
        uint256 effectiveAvax = (k + effectiveTokens - 1) / effectiveTokens;

        // tokensOut = effectiveTokens * avaxAmount / (effectiveAvax + avaxAmount)  [floor]
        tokensOut = effectiveTokens * avaxAmount / (effectiveAvax + avaxAmount);
    }

    /**
     * @notice Calculate AVAX received for selling tokens (FLOOR — seller gets less)
     * @dev avaxOut = k * tokenAmount / (effectiveTokens * newEffectiveTokens)  [floor]
     *
     * @param tokenAmount Number of tokens to sell (wei)
     * @param currentSupply Current tokens sold
     * @param virtualAvax Virtual AVAX reserve
     * @param virtualTokens Virtual token reserve
     * @return avaxOut AVAX to receive (rounded DOWN)
     */
    function calculateSaleReturn(
        uint256 tokenAmount,
        uint256 currentSupply,
        uint256 virtualAvax,
        uint256 virtualTokens
    ) internal pure returns (uint256 avaxOut) {
        if (tokenAmount == 0) return 0;
        if (tokenAmount > currentSupply) revert InsufficientLiquidity();

        uint256 effectiveTokens = virtualTokens - currentSupply;
        uint256 newEffectiveTokens = effectiveTokens + tokenAmount;
        uint256 k = virtualAvax * virtualTokens;

        // avaxOut = k * tokenAmount / (effectiveTokens * newEffectiveTokens)  [floor]
        uint256 numerator = k * tokenAmount;
        uint256 denominator = effectiveTokens * newEffectiveTokens;
        avaxOut = numerator / denominator;
    }

    /**
     * @notice Calculate the market cap at current supply
     * @dev marketCap = currentPrice * totalSupply / PRECISION
     */
    function calculateMarketCap(
        uint256 currentSupply,
        uint256 totalSupply,
        uint256 virtualAvax,
        uint256 virtualTokens
    ) internal pure returns (uint256 marketCap) {
        uint256 currentPrice = getCurrentPrice(currentSupply, virtualAvax, virtualTokens);
        marketCap = currentPrice * totalSupply / PRECISION;
    }

    /**
     * @notice Calculate price impact of a trade in basis points
     */
    function calculatePriceImpact(
        uint256 amountIn,
        uint256 currentSupply,
        uint256 virtualAvax,
        uint256 virtualTokens,
        bool isBuy
    ) internal pure returns (uint256 priceImpactBps) {
        uint256 priceBefore = getCurrentPrice(currentSupply, virtualAvax, virtualTokens);

        uint256 priceAfter;
        if (isBuy) {
            uint256 tokensOut = calculatePurchaseReturn(amountIn, currentSupply, virtualAvax, virtualTokens);
            priceAfter = getCurrentPrice(currentSupply + tokensOut, virtualAvax, virtualTokens);
        } else {
            if (amountIn > currentSupply) revert InsufficientLiquidity();
            priceAfter = getCurrentPrice(currentSupply - amountIn, virtualAvax, virtualTokens);
        }

        if (priceAfter > priceBefore) {
            priceImpactBps = (priceAfter - priceBefore) * BPS_DENOMINATOR / priceBefore;
        } else {
            priceImpactBps = (priceBefore - priceAfter) * BPS_DENOMINATOR / priceBefore;
        }
    }
}
