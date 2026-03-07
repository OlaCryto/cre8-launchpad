// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title BondingCurveMath
 * @notice Mathematical functions for linear bonding curve calculations
 * @dev Uses fixed-point arithmetic for precision.
 *
 * Linear Bonding Curve Formula:
 *   Price(s) = basePrice + (slope * s / PRECISION)
 *   Where s = current supply sold (in wei, i.e. 1 token = 1e18)
 *
 * Cost to buy from s1 to s2 (definite integral):
 *   Cost = ∫[s1 to s2] Price(s) ds / PRECISION
 *        = [basePrice * (s2-s1) + slope * (s2²-s1²) / (2*PRECISION)] / PRECISION
 *
 * Rounding strategy (learned from Arena's _integralCeil / _integralFloor):
 *   - calculateBuyCost:        CEILING (buyer pays slightly more)
 *   - calculatePurchaseReturn:  FLOOR   (buyer gets fewer tokens)
 *   - calculateSaleReturn:      FLOOR   (seller gets less AVAX)
 *   This ensures the reserve always accumulates tiny dust, preventing drain exploits.
 *
 * Overflow protection:
 *   With maxSupply = 800M * 1e18 = 8e26, intermediate products like (s1+s2)*delta
 *   can reach ~1.28e54. Multiplied by slope, this can overflow uint256 (~1.16e77).
 *   We carefully order divisions to keep intermediates within bounds.
 */
library BondingCurveMath {
    uint256 internal constant PRECISION = 1e18;
    uint256 internal constant BPS_DENOMINATOR = 10000;

    error MathOverflow();
    error InvalidInput();
    error InsufficientLiquidity();

    /**
     * @notice Calculate the price at a given supply level
     * @param currentSupply Current tokens sold (wei)
     * @param basePrice Starting price (wei per 1e18 tokens)
     * @param slope Price increase rate
     * @return price Current price in wei per 1e18 tokens
     */
    function getCurrentPrice(
        uint256 currentSupply,
        uint256 basePrice,
        uint256 slope
    ) internal pure returns (uint256 price) {
        price = basePrice + (slope * currentSupply / PRECISION);
    }

    /**
     * @notice Calculate AVAX cost for a specific token amount (CEILING — buyer pays more)
     * @dev Used when capping buy amount to recalculate the exact cost.
     *      Arena equivalent: _integralCeil
     *
     *      Cost = [basePrice * Δs + slope * (s1+s2) * Δs / (2*PRECISION)] / PRECISION
     *
     *      To avoid overflow with large supplies, we split the calculation:
     *      basePart  = basePrice * Δs           (max ~1e12 * 8e26 = 8e38, safe)
     *      slopePart = slope * ((s1+s2)/PRECISION) * (Δs/2)
     *                                            (divide early to keep in range)
     */
    function calculateBuyCost(
        uint256 tokenAmount,
        uint256 currentSupply,
        uint256 basePrice,
        uint256 slope
    ) internal pure returns (uint256 cost) {
        if (tokenAmount == 0) return 0;

        uint256 newSupply = currentSupply + tokenAmount;

        // Base component: basePrice * tokenAmount / PRECISION (ceiling)
        uint256 basePart = basePrice * tokenAmount;

        if (slope == 0) {
            // Ceiling: (a + PRECISION - 1) / PRECISION
            return (basePart + PRECISION - 1) / PRECISION;
        }

        // Slope component with overflow-safe ordering:
        // slope * (s1+s2) * delta / (2 * PRECISION)
        // Rewrite as: slope * ((s1+s2) / PRECISION) * (delta / 2)
        // But delta/2 loses precision for odd deltas, so:
        // = slope * sumSupply * tokenAmount / (2 * PRECISION)
        // Split: (slope * (sumSupply / PRECISION)) * tokenAmount / 2
        uint256 sumSupply = newSupply + currentSupply;
        uint256 slopePart = slope * (sumSupply / PRECISION) * tokenAmount / 2;

        // If sumSupply has remainder after /PRECISION, account for it
        uint256 sumRemainder = sumSupply % PRECISION;
        if (sumRemainder > 0) {
            slopePart += slope * sumRemainder * tokenAmount / (2 * PRECISION);
        }

        // Ceiling division of total
        cost = (basePart + slopePart + PRECISION - 1) / PRECISION;
    }

    /**
     * @notice Calculate tokens received for a given AVAX amount (FLOOR — buyer gets less)
     * @dev Uses quadratic formula. Integer division naturally floors.
     *      Arena takes token amount as input; we take AVAX amount (more natural for users).
     *
     * @param avaxAmount Amount of AVAX to spend (after fees)
     * @param currentSupply Current tokens sold
     * @param basePrice Starting price
     * @param slope Price increase per token
     * @return tokensOut Tokens to receive (rounded DOWN)
     */
    function calculatePurchaseReturn(
        uint256 avaxAmount,
        uint256 currentSupply,
        uint256 basePrice,
        uint256 slope
    ) internal pure returns (uint256 tokensOut) {
        if (avaxAmount == 0) return 0;

        uint256 currentPrice = getCurrentPrice(currentSupply, basePrice, slope);

        if (slope == 0) {
            // Constant price — floor division
            tokensOut = (avaxAmount * PRECISION) / currentPrice;
        } else {
            // Quadratic formula for linear bonding curve:
            // tokens = (sqrt(currentPrice² + 2*slope*avaxAmount/PRECISION) - currentPrice) * PRECISION / slope
            //
            // Using algebraic identity to avoid catastrophic cancellation:
            //   sqrt(a²+b) - a = b / (sqrt(a²+b) + a)
            //
            // So: tokens = 2 * avaxAmount / (sqrt(discriminant) + currentPrice)
            // Integer division naturally floors.

            uint256 twoSlopeAvax = 2 * slope * avaxAmount / PRECISION;
            uint256 discriminant = currentPrice * currentPrice + twoSlopeAvax;
            uint256 sqrtDisc = sqrt(discriminant);

            uint256 denom = sqrtDisc + currentPrice;
            if (denom > 0) {
                tokensOut = 2 * avaxAmount / denom;
            }
        }
    }

    /**
     * @notice Calculate AVAX received for selling tokens (FLOOR — seller gets less)
     * @dev Arena equivalent: _integralFloor
     *
     *      Return = [basePrice * Δs + slope * (s1+s2) * Δs / (2*PRECISION)] / PRECISION
     *
     *      Same overflow-safe ordering as calculateBuyCost, but with floor division.
     */
    function calculateSaleReturn(
        uint256 tokenAmount,
        uint256 currentSupply,
        uint256 basePrice,
        uint256 slope
    ) internal pure returns (uint256 avaxOut) {
        if (tokenAmount == 0) return 0;
        if (tokenAmount > currentSupply) revert InsufficientLiquidity();

        uint256 newSupply = currentSupply - tokenAmount;

        // Base component
        uint256 basePart = basePrice * tokenAmount;

        if (slope == 0) {
            // Floor division
            return basePart / PRECISION;
        }

        // Slope component (overflow-safe ordering)
        uint256 sumSupply = currentSupply + newSupply;
        uint256 slopePart = slope * (sumSupply / PRECISION) * tokenAmount / 2;

        uint256 sumRemainder = sumSupply % PRECISION;
        if (sumRemainder > 0) {
            slopePart += slope * sumRemainder * tokenAmount / (2 * PRECISION);
        }

        // Floor division (integer division naturally floors)
        avaxOut = (basePart + slopePart) / PRECISION;
    }

    /**
     * @notice Calculate the market cap at current supply
     */
    function calculateMarketCap(
        uint256 currentSupply,
        uint256 totalSupply,
        uint256 basePrice,
        uint256 slope
    ) internal pure returns (uint256 marketCap) {
        uint256 currentPrice = getCurrentPrice(currentSupply, basePrice, slope);
        marketCap = currentPrice * totalSupply / PRECISION;
    }

    /**
     * @notice Calculate price impact of a trade in basis points
     */
    function calculatePriceImpact(
        uint256 amountIn,
        uint256 currentSupply,
        uint256 basePrice,
        uint256 slope,
        bool isBuy
    ) internal pure returns (uint256 priceImpactBps) {
        uint256 priceBefore = getCurrentPrice(currentSupply, basePrice, slope);

        uint256 priceAfter;
        if (isBuy) {
            uint256 tokensOut = calculatePurchaseReturn(amountIn, currentSupply, basePrice, slope);
            priceAfter = getCurrentPrice(currentSupply + tokensOut, basePrice, slope);
        } else {
            if (amountIn > currentSupply) revert InsufficientLiquidity();
            priceAfter = getCurrentPrice(currentSupply - amountIn, basePrice, slope);
        }

        if (priceAfter > priceBefore) {
            priceImpactBps = (priceAfter - priceBefore) * BPS_DENOMINATOR / priceBefore;
        } else {
            priceImpactBps = (priceBefore - priceAfter) * BPS_DENOMINATOR / priceBefore;
        }
    }

    /**
     * @notice Square root using Babylonian method (floors)
     */
    function sqrt(uint256 x) internal pure returns (uint256 y) {
        if (x == 0) return 0;

        uint256 z = (x + 1) / 2;
        y = x;

        while (z < y) {
            y = z;
            z = (x / z + z) / 2;
        }
    }
}
