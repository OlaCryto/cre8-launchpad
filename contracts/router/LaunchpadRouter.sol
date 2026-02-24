// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {LaunchpadFactory} from "../core/LaunchpadFactory.sol";
import {BondingCurve} from "../core/BondingCurve.sol";
import {IFeeManager} from "../interfaces/IFeeManager.sol";
import {FeeManager} from "../core/FeeManager.sol";
import {ILiquidityManager} from "../interfaces/ILiquidityManager.sol";
import {LaunchpadErrors} from "../libraries/LaunchpadErrors.sol";
import {Pausable} from "../security/Pausable.sol";

/**
 * @title LaunchpadRouter
 * @notice Main entry point for all user interactions with the launchpad
 * @dev Routes calls to appropriate contracts (Factory, BondingCurve, etc.)
 *
 * Features:
 * - Single entry point for token creation, buying, selling
 * - Automatic fee handling
 * - Slippage and deadline protection
 * - Multi-token batch operations
 * - Graduation triggering
 */
contract LaunchpadRouter is
    Ownable,
    ReentrancyGuard,
    Pausable
{
    using SafeERC20 for IERC20;

    // ============ Types ============

    struct SwapParams {
        address token;
        uint256 amountIn;
        uint256 minAmountOut;
        address recipient;
        uint256 deadline;
    }

    // ============ Events ============

    event TokenCreated(address indexed token, address indexed creator, string name, string symbol);
    event SwapExecuted(address indexed user, address indexed token, bool isBuy, uint256 amountIn, uint256 amountOut);
    event GraduationExecuted(address indexed token, address indexed pair, uint256 avaxLiquidity, uint256 tokenLiquidity);

    // ============ State Variables ============

    LaunchpadFactory public factory;
    IFeeManager public feeManager;
    ILiquidityManager public liquidityManager;

    // ============ Modifiers ============

    modifier ensureDeadline(uint256 deadline) {
        if (block.timestamp > deadline) revert LaunchpadErrors.DeadlineExpired();
        _;
    }

    modifier validToken(address token) {
        if (!factory.isLaunchpadToken(token)) revert LaunchpadErrors.NotLaunchpadToken();
        _;
    }

    // ============ Constructor ============

    constructor(
        address factory_,
        address feeManager_,
        address liquidityManager_
    ) {
        if (factory_ == address(0)) revert LaunchpadErrors.ZeroAddress();

        factory = LaunchpadFactory(payable(factory_));

        if (feeManager_ != address(0)) {
            feeManager = IFeeManager(feeManager_);
        }

        if (liquidityManager_ != address(0)) {
            liquidityManager = ILiquidityManager(liquidityManager_);
        }
    }

    // ============ Configuration ============

    /**
     * @notice Update factory address
     * @param factory_ New factory address
     */
    function setFactory(address factory_) external onlyOwner {
        if (factory_ == address(0)) revert LaunchpadErrors.ZeroAddress();
        factory = LaunchpadFactory(payable(factory_));
    }

    /**
     * @notice Update fee manager address
     * @param feeManager_ New fee manager address
     */
    function setFeeManager(address feeManager_) external onlyOwner {
        if (feeManager_ == address(0)) revert LaunchpadErrors.ZeroAddress();
        feeManager = IFeeManager(feeManager_);
    }

    /**
     * @notice Update liquidity manager address
     * @param liquidityManager_ New liquidity manager address
     */
    function setLiquidityManager(address liquidityManager_) external onlyOwner {
        if (liquidityManager_ == address(0)) revert LaunchpadErrors.ZeroAddress();
        liquidityManager = ILiquidityManager(liquidityManager_);
    }

    // ============ Token Creation ============

    /**
     * @notice Create a new token
     * @param params Launch parameters
     * @return token New token address
     * @return bondingCurve New bonding curve address
     */
    function createToken(LaunchpadFactory.LaunchParams calldata params)
        external
        payable
        nonReentrant
        whenNotPaused
        returns (address token, address bondingCurve)
    {
        // Get creation fee
        uint256 creationFee = address(feeManager) != address(0)
            ? feeManager.feeConfig().creationFee
            : 0;

        if (msg.value < creationFee) revert LaunchpadErrors.InsufficientCreationFee();

        // Create token through factory (pass msg.sender as actual creator)
        (token, bondingCurve) = factory.createTokenFor{value: creationFee}(params, msg.sender);

        // Register creator with fee manager
        if (address(feeManager) != address(0)) {
            FeeManager(payable(address(feeManager))).registerTokenCreator(token, msg.sender);
        }

        // Refund excess
        if (msg.value > creationFee) {
            (bool success,) = msg.sender.call{value: msg.value - creationFee}("");
            if (!success) revert LaunchpadErrors.FeeTransferFailed();
        }

        emit TokenCreated(token, msg.sender, params.name, params.symbol);

        return (token, bondingCurve);
    }

    /**
     * @notice Create a new token and immediately buy tokens
     * @param params Launch parameters
     * @param minTokensOut Minimum tokens to receive
     * @return token New token address
     * @return bondingCurve New bonding curve address
     * @return tokensReceived Amount of tokens bought
     */
    function createTokenAndBuy(
        LaunchpadFactory.LaunchParams calldata params,
        uint256 minTokensOut
    )
        external
        payable
        nonReentrant
        whenNotPaused
        returns (address token, address bondingCurve, uint256 tokensReceived)
    {
        // Get creation fee
        uint256 creationFee = address(feeManager) != address(0)
            ? feeManager.feeConfig().creationFee
            : 0;

        if (msg.value <= creationFee) revert LaunchpadErrors.InsufficientPayment();

        // Create token (pass msg.sender as actual creator)
        (token, bondingCurve) = factory.createTokenFor{value: creationFee}(params, msg.sender);

        // Register creator
        if (address(feeManager) != address(0)) {
            FeeManager(payable(address(feeManager))).registerTokenCreator(token, msg.sender);
        }

        // Buy tokens with remaining AVAX
        uint256 buyAmount = msg.value - creationFee;
        tokensReceived = _executeBuy(token, bondingCurve, buyAmount, minTokensOut, msg.sender);

        emit TokenCreated(token, msg.sender, params.name, params.symbol);

        return (token, bondingCurve, tokensReceived);
    }

    // ============ Trading Functions ============

    /**
     * @notice Buy tokens from bonding curve
     * @param params Swap parameters
     * @return tokensOut Amount of tokens received
     */
    function buy(SwapParams calldata params)
        external
        payable
        nonReentrant
        whenNotPaused
        validToken(params.token)
        ensureDeadline(params.deadline)
        returns (uint256 tokensOut)
    {
        if (msg.value == 0) revert LaunchpadErrors.ZeroAmount();

        LaunchpadFactory.LaunchInfo memory info = factory.getLaunchInfo(params.token);
        if (info.isGraduated) revert LaunchpadErrors.TokenAlreadyGraduated();

        tokensOut = _executeBuy(
            params.token,
            info.bondingCurve,
            msg.value,
            params.minAmountOut,
            params.recipient == address(0) ? msg.sender : params.recipient
        );

        return tokensOut;
    }

    /**
     * @notice Sell tokens to bonding curve
     * @param params Swap parameters
     * @return avaxOut Amount of AVAX received
     */
    function sell(SwapParams calldata params)
        external
        nonReentrant
        whenNotPaused
        validToken(params.token)
        ensureDeadline(params.deadline)
        returns (uint256 avaxOut)
    {
        if (params.amountIn == 0) revert LaunchpadErrors.ZeroAmount();

        LaunchpadFactory.LaunchInfo memory info = factory.getLaunchInfo(params.token);
        if (info.isGraduated) revert LaunchpadErrors.TokenAlreadyGraduated();

        avaxOut = _executeSell(
            params.token,
            info.bondingCurve,
            params.amountIn,
            params.minAmountOut,
            params.recipient == address(0) ? msg.sender : params.recipient
        );

        return avaxOut;
    }

    /**
     * @notice Buy multiple tokens in one transaction
     * @param params Array of swap parameters
     * @return tokensOut Array of tokens received for each swap
     */
    function buyMultiple(SwapParams[] calldata params)
        external
        payable
        nonReentrant
        whenNotPaused
        returns (uint256[] memory tokensOut)
    {
        tokensOut = new uint256[](params.length);
        uint256 totalValue = msg.value;
        uint256 usedValue = 0;

        for (uint256 i = 0; i < params.length; i++) {
            if (!factory.isLaunchpadToken(params[i].token)) continue;
            if (block.timestamp > params[i].deadline) continue;

            LaunchpadFactory.LaunchInfo memory info = factory.getLaunchInfo(params[i].token);
            if (info.isGraduated) continue;

            uint256 buyValue = params[i].amountIn;
            if (usedValue + buyValue > totalValue) {
                buyValue = totalValue - usedValue;
            }

            if (buyValue > 0) {
                tokensOut[i] = _executeBuy(
                    params[i].token,
                    info.bondingCurve,
                    buyValue,
                    params[i].minAmountOut,
                    params[i].recipient == address(0) ? msg.sender : params[i].recipient
                );
                usedValue += buyValue;
            }
        }

        // Refund unused AVAX
        if (usedValue < totalValue) {
            (bool success,) = msg.sender.call{value: totalValue - usedValue}("");
            if (!success) revert LaunchpadErrors.FeeTransferFailed();
        }

        return tokensOut;
    }

    // ============ Internal Trading Functions ============

    /**
     * @notice Execute a buy operation
     */
    function _executeBuy(
        address token,
        address bondingCurve,
        uint256 avaxAmount,
        uint256 minTokensOut,
        address recipient
    ) internal returns (uint256 tokensOut) {
        BondingCurve curve = BondingCurve(payable(bondingCurve));

        // Calculate and collect fee
        uint256 feeAmount = 0;
        if (address(feeManager) != address(0)) {
            IFeeManager.FeeDistribution memory feeDist = feeManager.calculateTradingFee(avaxAmount);
            feeAmount = feeDist.totalFee;

            // Collect fee
            feeManager.collectTradingFee{value: feeAmount}(token, msg.sender, avaxAmount, true);
        }

        // Execute buy on bonding curve (tokens are minted to this router contract)
        uint256 buyAmount = avaxAmount - feeAmount;
        tokensOut = curve.buy{value: buyAmount}(minTokensOut);

        // Transfer tokens from router to recipient
        IERC20(token).safeTransfer(recipient, tokensOut);

        emit SwapExecuted(msg.sender, token, true, avaxAmount, tokensOut);

        return tokensOut;
    }

    /**
     * @notice Execute a sell operation
     */
    function _executeSell(
        address token,
        address bondingCurve,
        uint256 tokenAmount,
        uint256 minAvaxOut,
        address recipient
    ) internal returns (uint256 avaxOut) {
        BondingCurve curve = BondingCurve(payable(bondingCurve));

        // Transfer tokens from user to this contract
        IERC20(token).safeTransferFrom(msg.sender, address(this), tokenAmount);

        // Approve bonding curve to burn tokens
        IERC20(token).approve(bondingCurve, tokenAmount);

        // Execute sell on bonding curve
        uint256 grossAvaxOut = curve.sell(tokenAmount, 0);

        // Calculate and collect fee
        uint256 feeAmount = 0;
        if (address(feeManager) != address(0)) {
            IFeeManager.FeeDistribution memory feeDist = feeManager.calculateTradingFee(grossAvaxOut);
            feeAmount = feeDist.totalFee;

            // Collect fee
            feeManager.collectTradingFee{value: feeAmount}(token, msg.sender, grossAvaxOut, false);
        }

        avaxOut = grossAvaxOut - feeAmount;

        if (avaxOut < minAvaxOut) revert LaunchpadErrors.SlippageExceeded();

        // Transfer AVAX to recipient
        (bool success,) = recipient.call{value: avaxOut}("");
        if (!success) revert LaunchpadErrors.FeeTransferFailed();

        emit SwapExecuted(msg.sender, token, false, tokenAmount, avaxOut);

        return avaxOut;
    }

    // ============ Graduation ============

    /**
     * @notice Graduate a token to DEX
     * @param token Token to graduate
     * @return pair DEX pair address
     */
    function graduate(address token)
        external
        nonReentrant
        validToken(token)
        returns (address pair)
    {
        LaunchpadFactory.LaunchInfo memory info = factory.getLaunchInfo(token);
        if (info.isGraduated) revert LaunchpadErrors.TokenAlreadyGraduated();

        BondingCurve curve = BondingCurve(payable(info.bondingCurve));

        // Check if graduation threshold is met
        BondingCurve.CurveState curveState = curve.state();
        if (curveState != BondingCurve.CurveState.Graduating) {
            // Try to trigger graduation check
            curve.triggerGraduationCheck();
            curveState = curve.state();

            if (curveState != BondingCurve.CurveState.Graduating) {
                revert LaunchpadErrors.GraduationThresholdNotMet();
            }
        }

        // Execute graduation through factory
        pair = factory.graduateToken(token);

        emit GraduationExecuted(token, pair, 0, 0);

        return pair;
    }

    // ============ View Functions ============

    /**
     * @notice Get quote for buying tokens
     * @param token Token address
     * @param avaxAmount AVAX to spend
     * @return tokensOut Tokens to receive
     * @return fee Total fee
     * @return priceImpact Price impact in basis points
     */
    function getQuoteBuy(address token, uint256 avaxAmount)
        external
        view
        returns (uint256 tokensOut, uint256 fee, uint256 priceImpact)
    {
        if (!factory.isLaunchpadToken(token)) revert LaunchpadErrors.NotLaunchpadToken();

        LaunchpadFactory.LaunchInfo memory info = factory.getLaunchInfo(token);
        BondingCurve curve = BondingCurve(payable(info.bondingCurve));

        // Calculate fee
        if (address(feeManager) != address(0)) {
            IFeeManager.FeeDistribution memory feeDist = feeManager.calculateTradingFee(avaxAmount);
            fee = feeDist.totalFee;
        }

        // Get quote from bonding curve
        uint256 buyAmount = avaxAmount - fee;
        (tokensOut, priceImpact) = curve.getBuyPrice(buyAmount);

        return (tokensOut, fee, priceImpact);
    }

    /**
     * @notice Get quote for selling tokens
     * @param token Token address
     * @param tokenAmount Tokens to sell
     * @return avaxOut AVAX to receive
     * @return fee Total fee
     * @return priceImpact Price impact in basis points
     */
    function getQuoteSell(address token, uint256 tokenAmount)
        external
        view
        returns (uint256 avaxOut, uint256 fee, uint256 priceImpact)
    {
        if (!factory.isLaunchpadToken(token)) revert LaunchpadErrors.NotLaunchpadToken();

        LaunchpadFactory.LaunchInfo memory info = factory.getLaunchInfo(token);
        BondingCurve curve = BondingCurve(payable(info.bondingCurve));

        // Get quote from bonding curve
        uint256 grossAvaxOut;
        (grossAvaxOut, priceImpact) = curve.getSellPrice(tokenAmount);

        // Calculate fee
        if (address(feeManager) != address(0)) {
            IFeeManager.FeeDistribution memory feeDist = feeManager.calculateTradingFee(grossAvaxOut);
            fee = feeDist.totalFee;
        }

        avaxOut = grossAvaxOut - fee;

        return (avaxOut, fee, priceImpact);
    }

    // ============ Admin Functions ============

    /**
     * @notice Pause all operations
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Unpause all operations
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @notice Emergency withdraw stuck funds
     */
    function emergencyWithdraw(address token_, address to, uint256 amount) external onlyOwner {
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
        // Accept AVAX for trading operations
    }
}
