// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {ILiquidityManager} from "../interfaces/ILiquidityManager.sol";
import {ILiquidityLocker} from "../interfaces/ILiquidityLocker.sol";
import {LaunchpadErrors} from "../libraries/LaunchpadErrors.sol";

/**
 * @title LiquidityManager
 * @notice Manages DEX liquidity operations for graduated tokens
 * @dev Integrates with TraderJoe and other Avalanche DEXes
 *
 * Responsibilities:
 * - Add initial liquidity to DEX on graduation
 * - Lock LP tokens via LiquidityLocker
 * - Track LP info for each token
 */

// TraderJoe Router interface (compatible with Uniswap V2)
interface IJoeRouter {
    function factory() external pure returns (address);

    function WAVAX() external pure returns (address);

    function addLiquidityAVAX(
        address token,
        uint256 amountTokenDesired,
        uint256 amountTokenMin,
        uint256 amountAVAXMin,
        address to,
        uint256 deadline
    ) external payable returns (uint256 amountToken, uint256 amountAVAX, uint256 liquidity);

    function removeLiquidityAVAX(
        address token,
        uint256 liquidity,
        uint256 amountTokenMin,
        uint256 amountAVAXMin,
        address to,
        uint256 deadline
    ) external returns (uint256 amountToken, uint256 amountAVAX);
}

interface IJoeFactory {
    function getPair(address tokenA, address tokenB) external view returns (address pair);
    function createPair(address tokenA, address tokenB) external returns (address pair);
}

contract LiquidityManager is
    Ownable,
    ReentrancyGuard
{
    using SafeERC20 for IERC20;

    // ============ Types ============

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

    // ============ Events ============

    event LiquidityAdded(address indexed token, address indexed pair, uint256 tokenAmount, uint256 avaxAmount, uint256 lpTokens);
    event LiquidityLocked(address indexed token, address indexed pair, uint256 lpTokens, uint256 lockedUntil);
    event LiquidityUnlocked(address indexed token, address pair, uint256 lpTokens, address recipient);
    event DEXRouterUpdated(address indexed oldRouter, address indexed newRouter);
    event FactoryUpdated(address indexed oldFactory, address indexed newFactory);

    // ============ State Variables ============

    IJoeRouter public dexRouter;
    address public dexFactory;
    address public wavax;
    ILiquidityLocker public liquidityLocker;

    address public factory;

    mapping(address => LPInfo) public lpInfo;

    // ============ Modifiers ============

    modifier onlyAuthorized() {
        if (msg.sender != factory && msg.sender != owner()) {
            revert LaunchpadErrors.Unauthorized();
        }
        _;
    }

    // ============ Constructor ============

    constructor(
        address dexRouter_,
        address liquidityLocker_
    ) {
        if (dexRouter_ == address(0)) revert LaunchpadErrors.ZeroAddress();
        if (liquidityLocker_ == address(0)) revert LaunchpadErrors.ZeroAddress();

        dexRouter = IJoeRouter(dexRouter_);
        dexFactory = dexRouter.factory();
        wavax = dexRouter.WAVAX();
        liquidityLocker = ILiquidityLocker(liquidityLocker_);
    }

    // ============ Configuration ============

    /**
     * @notice Set the factory contract
     * @param factory_ Factory address
     */
    function setFactory(address factory_) external onlyOwner {
        if (factory_ == address(0)) revert LaunchpadErrors.ZeroAddress();
        emit FactoryUpdated(factory, factory_);
        factory = factory_;
    }

    /**
     * @notice Update DEX router
     * @param dexRouter_ New DEX router address
     */
    function setDEXRouter(address dexRouter_) external onlyOwner {
        if (dexRouter_ == address(0)) revert LaunchpadErrors.ZeroAddress();
        emit DEXRouterUpdated(address(dexRouter), dexRouter_);
        dexRouter = IJoeRouter(dexRouter_);
        dexFactory = dexRouter.factory();
        wavax = dexRouter.WAVAX();
    }

    /**
     * @notice Update liquidity locker
     * @param locker_ New locker address
     */
    function setLiquidityLocker(address locker_) external onlyOwner {
        if (locker_ == address(0)) revert LaunchpadErrors.ZeroAddress();
        liquidityLocker = ILiquidityLocker(locker_);
    }

    // ============ Liquidity Functions ============

    /**
     * @notice Add liquidity to DEX and lock LP tokens
     * @param params Liquidity parameters
     * @param lockDuration How long to lock LP tokens
     * @return pair DEX pair address
     * @return lpTokens Amount of LP tokens received and locked
     */
    function addLiquidityAndLock(LiquidityParams calldata params, uint256 lockDuration)
        external
        payable
        nonReentrant
        onlyAuthorized
        returns (address pair, uint256 lpTokens)
    {
        // Add liquidity
        (pair, lpTokens) = _addLiquidity(params);

        // Lock LP tokens
        _lockLiquidity(params.token, pair, lpTokens, lockDuration);

        return (pair, lpTokens);
    }

    /**
     * @notice Add liquidity without locking (for special cases)
     * @param params Liquidity parameters
     * @return pair DEX pair address
     * @return lpTokens Amount of LP tokens received
     */
    function addLiquidity(LiquidityParams calldata params)
        external
        payable
        nonReentrant
        onlyAuthorized
        returns (address pair, uint256 lpTokens)
    {
        return _addLiquidity(params);
    }

    /**
     * @notice Internal function to add liquidity
     */
    function _addLiquidity(LiquidityParams calldata params)
        internal
        returns (address pair, uint256 lpTokens)
    {
        if (params.token == address(0)) revert LaunchpadErrors.ZeroAddress();
        if (params.tokenAmount == 0) revert LaunchpadErrors.ZeroAmount();
        if (msg.value < params.avaxAmount) revert LaunchpadErrors.InsufficientPayment();
        if (block.timestamp > params.deadline) revert LaunchpadErrors.DeadlineExpired();

        // Get or create pair
        pair = IJoeFactory(dexFactory).getPair(params.token, wavax);
        if (pair == address(0)) {
            pair = IJoeFactory(dexFactory).createPair(params.token, wavax);
        }

        // Transfer tokens from sender
        IERC20(params.token).safeTransferFrom(msg.sender, address(this), params.tokenAmount);

        // Approve router
        IERC20(params.token).approve(address(dexRouter), params.tokenAmount);

        // Add liquidity
        uint256 amountToken;
        uint256 amountAVAX;

        (amountToken, amountAVAX, lpTokens) = dexRouter.addLiquidityAVAX{value: params.avaxAmount}(
            params.token,
            params.tokenAmount,
            params.minTokenAmount,
            params.minAvaxAmount,
            address(this),  // LP tokens come to this contract
            params.deadline
        );

        // Store LP info
        lpInfo[params.token] = LPInfo({
            pair: pair,
            lpTokens: lpTokens,
            tokenAmount: amountToken,
            avaxAmount: amountAVAX,
            lockedUntil: 0, // Will be set when locked
            isLocked: false
        });

        // Refund excess tokens
        uint256 tokenBalance = IERC20(params.token).balanceOf(address(this));
        if (tokenBalance > 0) {
            IERC20(params.token).safeTransfer(msg.sender, tokenBalance);
        }

        // Refund excess AVAX
        if (msg.value > amountAVAX) {
            (bool success,) = msg.sender.call{value: msg.value - amountAVAX}("");
            if (!success) revert LaunchpadErrors.FeeTransferFailed();
        }

        emit LiquidityAdded(params.token, pair, amountToken, amountAVAX, lpTokens);

        return (pair, lpTokens);
    }

    /**
     * @notice Internal function to lock LP tokens
     */
    function _lockLiquidity(
        address token,
        address pair,
        uint256 lpTokens,
        uint256 lockDuration
    ) internal {
        // Approve locker
        IERC20(pair).approve(address(liquidityLocker), lpTokens);

        // Lock LP tokens
        liquidityLocker.lock(
            token,
            pair,
            lpTokens,
            lockDuration,
            factory // Factory is the lock owner
        );

        // Update LP info
        lpInfo[token].lockedUntil = block.timestamp + lockDuration;
        lpInfo[token].isLocked = true;

        emit LiquidityLocked(token, pair, lpTokens, block.timestamp + lockDuration);
    }

    /**
     * @notice Unlock liquidity (after lock period)
     * @param token Token address
     * @param recipient Address to receive LP tokens
     * @return lpTokens Amount of LP tokens unlocked
     */
    function unlockLiquidity(address token, address recipient)
        external
        nonReentrant
        onlyAuthorized
        returns (uint256 lpTokens)
    {
        LPInfo storage info = lpInfo[token];

        if (!info.isLocked) revert LaunchpadErrors.LiquidityNotLocked();
        if (block.timestamp < info.lockedUntil) revert LaunchpadErrors.LiquidityStillLocked();

        (uint256 lockId,) = liquidityLocker.getLockByToken(token);
        lpTokens = liquidityLocker.unlock(lockId, recipient);

        info.isLocked = false;

        emit LiquidityUnlocked(token, info.pair, lpTokens, recipient);

        return lpTokens;
    }

    // ============ View Functions ============

    /**
     * @notice Get LP info for a token
     * @param token Token address
     */
    function getLPInfo(address token) external view returns (LPInfo memory) {
        return lpInfo[token];
    }

    /**
     * @notice Check if token's liquidity is locked
     * @param token Token address
     */
    function isLiquidityLocked(address token) external view returns (bool) {
        return lpInfo[token].isLocked && block.timestamp < lpInfo[token].lockedUntil;
    }

    /**
     * @notice Get unlock time for a token
     * @param token Token address
     */
    function getUnlockTime(address token) external view returns (uint256) {
        return lpInfo[token].lockedUntil;
    }

    /**
     * @notice Get DEX pair address for a token
     * @param token Token address
     */
    function getPair(address token) external view returns (address) {
        return IJoeFactory(dexFactory).getPair(token, wavax);
    }

    // ============ Emergency Functions ============

    /**
     * @notice Emergency withdraw stuck tokens
     * @param token_ Token to withdraw (address(0) for AVAX)
     * @param to Recipient address
     * @param amount Amount to withdraw
     */
    function emergencyWithdraw(
        address token_,
        address to,
        uint256 amount
    ) external onlyOwner {
        if (to == address(0)) revert LaunchpadErrors.ZeroAddress();

        if (token_ == address(0)) {
            (bool success,) = to.call{value: amount}("");
            if (!success) revert LaunchpadErrors.FeeTransferFailed();
        } else {
            IERC20(token_).safeTransfer(to, amount);
        }
    }

    // ============ Receive Function ============

    receive() external payable {
        // Accept AVAX for liquidity operations
    }
}
