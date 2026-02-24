// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title BondingCurveMath
 * @notice Mathematical functions for linear bonding curve calculations
 * @dev Uses fixed-point arithmetic for precision
 *
 * Linear Bonding Curve Formula:
 * Price(s) = basePrice + (slope * s)
 * Where s = current supply sold
 *
 * Cost to buy from s1 to s2:
 * Cost = ∫[s1 to s2] (basePrice + slope * s) ds
 *      = basePrice * (s2 - s1) + slope/2 * (s2² - s1²)
 */
library BondingCurveMath {
    uint256 internal constant PRECISION = 1e18;
    uint256 internal constant BPS_DENOMINATOR = 10000;

    error MathOverflow();
    error InvalidInput();
    error InsufficientLiquidity();

    /**
     * @notice Calculate the price at a given supply level
     * @param currentSupply Current tokens sold
     * @param basePrice Starting price (wei per token)
     * @param slope Price increase per token (wei)
     * @return price Current price per token in wei
     */
    function getCurrentPrice(
        uint256 currentSupply,
        uint256 basePrice,
        uint256 slope
    ) internal pure returns (uint256 price) {
        // Price = basePrice + (slope * currentSupply / PRECISION)
        price = basePrice + (slope * currentSupply / PRECISION);
    }

    /**
     * @notice Calculate tokens received for a given AVAX amount (buying)
     * @param avaxAmount Amount of AVAX to spend
     * @param currentSupply Current tokens sold
     * @param basePrice Starting price
     * @param slope Price increase per token
     * @return tokensOut Tokens to receive
     *
     * @dev Solves the integral equation for token amount:
     * avaxAmount = basePrice * tokens + slope/2 * (newSupply² - currentSupply²)
     *
     * Using quadratic formula to solve for newSupply:
     * a*x² + b*x + c = 0
     * where x = newSupply - currentSupply (tokens to buy)
     */
    function calculatePurchaseReturn(
        uint256 avaxAmount,
        uint256 currentSupply,
        uint256 basePrice,
        uint256 slope
    ) internal pure returns (uint256 tokensOut) {
        if (avaxAmount == 0) return 0;

        // For linear curve: Cost = basePrice * Δs + slope/2 * (s2² - s1²)
        // Rearranging: slope/2 * Δs² + (basePrice + slope*s1) * Δs - avaxAmount = 0
        // Using quadratic formula: Δs = (-b + sqrt(b² + 4ac)) / 2a
        // where a = slope/2, b = basePrice + slope*s1, c = avaxAmount

        uint256 currentPrice = getCurrentPrice(currentSupply, basePrice, slope);

        if (slope == 0) {
            // Constant price (no curve)
            tokensOut = (avaxAmount * PRECISION) / currentPrice;
        } else {
            // Quadratic formula for linear bonding curve
            // tokens = (sqrt(currentPrice² + 2*slope*avaxAmount/PRECISION) - currentPrice) * PRECISION / slope
            //
            // To avoid precision loss from catastrophic cancellation (sqrt(a²+b) - a ≈ 0 when b << a²),
            // we use the identity: sqrt(a²+b) - a = b / (sqrt(a²+b) + a)
            //
            // So: tokens = (2*slope*avaxAmount/PRECISION) / (sqrt(discriminant) + currentPrice) * PRECISION / slope
            //            = 2 * avaxAmount / (sqrt(discriminant) + currentPrice)

            uint256 twoSlopeAvax = 2 * slope * avaxAmount / PRECISION;
            uint256 discriminant = currentPrice * currentPrice + twoSlopeAvax;

            uint256 sqrtDiscriminant = sqrt(discriminant);

            // Using the identity: (sqrt(d) - cp) = twoSlopeAvax / (sqrt(d) + cp)
            // tokens = twoSlopeAvax / (sqrt(d) + cp) * PRECISION / slope
            //        = (2 * slope * avaxAmount / PRECISION) / (sqrt(d) + cp) * PRECISION / slope
            //        = 2 * avaxAmount / (sqrt(d) + cp)
            uint256 denom = sqrtDiscriminant + currentPrice;
            if (denom > 0) {
                tokensOut = 2 * avaxAmount / denom;
            } else {
                tokensOut = 0;
            }
        }
    }

    /**
     * @notice Calculate AVAX received for selling tokens
     * @param tokenAmount Tokens to sell
     * @param currentSupply Current tokens sold (before sale)
     * @param basePrice Starting price
     * @param slope Price increase per token
     * @return avaxOut AVAX to receive
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

        // AVAX = integral from newSupply to currentSupply
        // = basePrice * (currentSupply - newSupply) + slope/2 * (currentSupply² - newSupply²) / PRECISION

        uint256 supplyDiff = tokenAmount;
        uint256 baseCost = basePrice * supplyDiff / PRECISION;

        // slope/2 * (s1² - s2²) / PRECISION = slope/2 * (s1+s2) * (s1-s2) / PRECISION
        uint256 slopeCost = slope * (currentSupply + newSupply) * supplyDiff / (2 * PRECISION * PRECISION);

        avaxOut = baseCost + slopeCost;
    }

    /**
     * @notice Calculate the market cap at current supply
     * @param currentSupply Current tokens sold
     * @param totalSupply Total token supply
     * @param basePrice Starting price
     * @param slope Price increase per token
     * @return marketCap in wei
     */
    function calculateMarketCap(
        uint256 currentSupply,
        uint256 totalSupply,
        uint256 basePrice,
        uint256 slope
    ) internal pure returns (uint256 marketCap) {
        uint256 currentPrice = getCurrentPrice(currentSupply, basePrice, slope);
        // Market cap = current price * total supply (fully diluted)
        marketCap = currentPrice * totalSupply / PRECISION;
    }

    /**
     * @notice Calculate price impact of a trade
     * @param amountIn Amount being traded
     * @param currentSupply Current supply
     * @param basePrice Base price
     * @param slope Curve slope
     * @param isBuy True if buying, false if selling
     * @return priceImpactBps Price impact in basis points
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
     * @notice Apply fee to an amount
     * @param amount Original amount
     * @param feeBps Fee in basis points
     * @return amountAfterFee Amount after fee deduction
     * @return fee Fee amount
     */
    function applyFee(
        uint256 amount,
        uint256 feeBps
    ) internal pure returns (uint256 amountAfterFee, uint256 fee) {
        fee = (amount * feeBps) / BPS_DENOMINATOR;
        amountAfterFee = amount - fee;
    }

    /**
     * @notice Calculate square root using Babylonian method
     * @param x Number to find square root of
     * @return y Square root of x
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

    /**
     * @notice Safe multiplication with overflow check
     */
    function safeMul(uint256 a, uint256 b) internal pure returns (uint256) {
        if (a == 0) return 0;
        uint256 c = a * b;
        if (c / a != b) revert MathOverflow();
        return c;
    }
}
