// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title ILiquidityManager
 * @notice Interface for managing DEX liquidity operations
 */
interface ILiquidityManager {
    struct LiquidityParams {
        address token;
        uint256 tokenAmount;
        uint256 avaxAmount;
        uint256 minTokenAmount;
        uint256 minAvaxAmount;
        uint256 deadline;
    }

    struct LPInfo {
        address pair;
        uint256 lpTokens;
        uint256 tokenAmount;
        uint256 avaxAmount;
        uint256 lockedUntil;
        bool isLocked;
    }

    event LiquidityAdded(
        address indexed token,
        address indexed pair,
        uint256 tokenAmount,
        uint256 avaxAmount,
        uint256 lpTokens
    );

    event LiquidityLocked(
        address indexed token,
        address indexed pair,
        uint256 lpTokens,
        uint256 lockedUntil
    );

    event LiquidityUnlocked(
        address indexed token,
        address indexed pair,
        uint256 lpTokens,
        address recipient
    );

    event DEXRouterUpdated(address indexed oldRouter, address indexed newRouter);

    function addLiquidityAndLock(LiquidityParams calldata params, uint256 lockDuration)
        external
        payable
        returns (address pair, uint256 lpTokens);

    function addLiquidity(LiquidityParams calldata params)
        external
        payable
        returns (address pair, uint256 lpTokens);

    function unlockLiquidity(address token, address recipient) external returns (uint256 lpTokens);

    function getLPInfo(address token) external view returns (LPInfo memory);
    function isLiquidityLocked(address token) external view returns (bool);
    function getUnlockTime(address token) external view returns (uint256);

    function dexRouter() external view returns (address);
    function dexFactory() external view returns (address);
    function liquidityLocker() external view returns (address);
}
