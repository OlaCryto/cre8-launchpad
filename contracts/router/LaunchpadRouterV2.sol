// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {ILaunchpadRouter} from "../interfaces/ILaunchpadRouter.sol";
import {IFeeManager} from "../interfaces/IFeeManager.sol";
import {IBondingCurve} from "../interfaces/IBondingCurve.sol";
import {LaunchpadErrors} from "../libraries/LaunchpadErrors.sol";
import {Pausable} from "../security/Pausable.sol";

import {LaunchpadFactoryV2} from "../core/LaunchpadFactoryV2.sol";
import {LaunchpadTokenV2} from "../core/LaunchpadTokenV2.sol";
import {BondingCurveV2} from "../core/BondingCurveV2.sol";
import {CreatorRegistry} from "../core/CreatorRegistry.sol";
import {ActivityTracker} from "../core/ActivityTracker.sol";

/**
 * @title LaunchpadRouterV2
 * @notice Main entry point for Arena-style launchpad interactions
 * @dev Supports Easy/Pro launch modes with creator profiles
 *
 * Features:
 * - Easy Launch: Simple token creation
 * - Pro Launch: Whitelist, blacklist, presale phases
 * - Creator initial buy (percentage slider)
 * - Trade activity tracking for live feed
 */
contract LaunchpadRouterV2 is
    Ownable,
    ReentrancyGuard,
    Pausable
{
    using SafeERC20 for IERC20;

    // ============ Structs ============

    struct SwapParams {
        address token;
        uint256 amountIn;
        uint256 minAmountOut;
        address recipient;
        uint256 deadline;
    }

    // ============ State Variables ============

    LaunchpadFactoryV2 public factory;
    IFeeManager public feeManager;
    CreatorRegistry public creatorRegistry;
    ActivityTracker public activityTracker;

    // ============ Events ============

    event TokenCreatedEasy(
        address indexed token,
        address indexed creator,
        string name,
        string symbol,
        uint256 creatorBuyAmount
    );

    event TokenCreatedPro(
        address indexed token,
        address indexed creator,
        string name,
        string symbol,
        uint256 whitelistCount,
        uint256 whitelistDuration
    );

    event SwapExecuted(
        address indexed user,
        address indexed token,
        bool isBuy,
        uint256 amountIn,
        uint256 amountOut,
        uint256 newPrice
    );

    event GraduationExecuted(
        address indexed token,
        address indexed pair,
        uint256 avaxLiquidity,
        uint256 tokenLiquidity
    );

    // ============ Modifiers ============

    modifier ensureDeadline(uint256 deadline) {
        if (block.timestamp > deadline) revert LaunchpadErrors.DeadlineExpired();
        _;
    }

    modifier validToken(address token) {
        if (!factory.isLaunchpadToken(token)) revert LaunchpadErrors.NotLaunchpadToken();
        _;
    }

    modifier hasProfile() {
        if (address(creatorRegistry) != address(0)) {
            if (!creatorRegistry.hasProfile(msg.sender)) {
                revert LaunchpadErrors.Unauthorized();
            }
        }
        _;
    }

    // ============ Constructor ============

    constructor(
        address factory_,
        address feeManager_,
        address creatorRegistry_,
        address activityTracker_
    ) Ownable(msg.sender) {
        if (factory_ == address(0)) revert LaunchpadErrors.ZeroAddress();

        factory = LaunchpadFactoryV2(payable(factory_));

        if (feeManager_ != address(0)) {
            feeManager = IFeeManager(feeManager_);
        }

        if (creatorRegistry_ != address(0)) {
            creatorRegistry = CreatorRegistry(creatorRegistry_);
        }

        if (activityTracker_ != address(0)) {
            activityTracker = ActivityTracker(activityTracker_);
        }
    }

    // ============ Configuration ============

    function setFactory(address factory_) external onlyOwner {
        if (factory_ == address(0)) revert LaunchpadErrors.ZeroAddress();
        factory = LaunchpadFactoryV2(payable(factory_));
    }

    function setFeeManager(address feeManager_) external onlyOwner {
        feeManager = IFeeManager(feeManager_);
    }

    function setCreatorRegistry(address registry_) external onlyOwner {
        creatorRegistry = CreatorRegistry(registry_);
    }

    function setActivityTracker(address tracker_) external onlyOwner {
        activityTracker = ActivityTracker(tracker_);
    }

    // ============ Easy Launch ============

    /**
     * @notice Create a token with Easy Launch (simple mode)
     * @param name Token name
     * @param symbol Token symbol
     * @param imageURI Token image URI
     * @param description Token description
     * @param creatorBuyBps Percentage of supply for creator to buy (0-2000 = 0-20%)
     * @return token Token address
     * @return bondingCurve Bonding curve address
     */
    function createTokenEasy(
        string calldata name,
        string calldata symbol,
        string calldata imageURI,
        string calldata description,
        uint256 creatorBuyBps
    )
        external
        payable
        nonReentrant
        whenNotPaused
        hasProfile
        returns (address token, address bondingCurve)
    {
        LaunchpadFactoryV2.EasyLaunchParams memory params = LaunchpadFactoryV2.EasyLaunchParams({
            name: name,
            symbol: symbol,
            imageURI: imageURI,
            description: description,
            creatorBuyBps: creatorBuyBps
        });

        (token, bondingCurve) = factory.createTokenEasy{value: msg.value}(params);

        emit TokenCreatedEasy(token, msg.sender, name, symbol, creatorBuyBps);

        return (token, bondingCurve);
    }

    // ============ Pro Launch ============

    /**
     * @notice Create a token with Pro Launch (advanced mode)
     * @param name Token name
     * @param symbol Token symbol
     * @param imageURI Token image URI
     * @param description Token description
     * @param creatorBuyBps Percentage of supply for creator to buy
     * @param whitelist Initial whitelist addresses
     * @param whitelistDuration Duration of whitelist phase (seconds)
     * @param tradingStartTime When trading begins (0 = immediately)
     * @return token Token address
     * @return bondingCurve Bonding curve address
     */
    function createTokenPro(
        string calldata name,
        string calldata symbol,
        string calldata imageURI,
        string calldata description,
        uint256 creatorBuyBps,
        address[] calldata whitelist,
        uint256 whitelistDuration,
        uint256 tradingStartTime
    )
        external
        payable
        nonReentrant
        whenNotPaused
        hasProfile
        returns (address token, address bondingCurve)
    {
        LaunchpadFactoryV2.ProLaunchParams memory params = LaunchpadFactoryV2.ProLaunchParams({
            name: name,
            symbol: symbol,
            imageURI: imageURI,
            description: description,
            creatorBuyBps: creatorBuyBps,
            whitelist: whitelist,
            whitelistDuration: whitelistDuration,
            tradingStartTime: tradingStartTime
        });

        (token, bondingCurve) = factory.createTokenPro{value: msg.value}(params);

        emit TokenCreatedPro(token, msg.sender, name, symbol, whitelist.length, whitelistDuration);

        return (token, bondingCurve);
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

        LaunchpadFactoryV2.LaunchInfo memory info = factory.getLaunchInfo(params.token);
        if (info.isGraduated) revert LaunchpadErrors.TokenAlreadyGraduated();

        // Execute buy
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

        LaunchpadFactoryV2.LaunchInfo memory info = factory.getLaunchInfo(params.token);
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
     * @notice Execute buy operation
     */
    function _executeBuy(
        address token,
        address bondingCurve,
        uint256 avaxAmount,
        uint256 minTokensOut,
        address recipient
    ) internal returns (uint256 tokensOut) {
        BondingCurveV2 curve = BondingCurveV2(payable(bondingCurve));

        // Calculate and collect fee
        uint256 feeAmount = 0;
        if (address(feeManager) != address(0)) {
            IFeeManager.FeeDistribution memory feeDist = feeManager.calculateTradingFee(avaxAmount);
            feeAmount = feeDist.totalFee;
            feeManager.collectTradingFee{value: feeAmount}(token, msg.sender, avaxAmount, true);
        }

        // Execute buy
        uint256 buyAmount = avaxAmount - feeAmount;
        tokensOut = curve.buy{value: buyAmount}(minTokensOut);

        // Transfer tokens if recipient is different
        if (recipient != msg.sender) {
            IERC20(token).safeTransfer(recipient, tokensOut);
        }

        // Get new price for activity tracking
        uint256 newPrice = curve.getCurrentPrice();

        // Record activity
        if (address(activityTracker) != address(0)) {
            string memory userHandle = "";
            if (address(creatorRegistry) != address(0) && creatorRegistry.hasProfile(msg.sender)) {
                userHandle = creatorRegistry.getProfile(msg.sender).handle;
            }

            activityTracker.recordTrade(
                token,
                msg.sender,
                true, // isBuy
                avaxAmount,
                tokensOut,
                newPrice,
                LaunchpadTokenV2(token).TOTAL_SUPPLY(),
                LaunchpadTokenV2(token).symbol(),
                userHandle
            );
        }

        emit SwapExecuted(msg.sender, token, true, avaxAmount, tokensOut, newPrice);

        return tokensOut;
    }

    /**
     * @notice Execute sell operation
     */
    function _executeSell(
        address token,
        address bondingCurve,
        uint256 tokenAmount,
        uint256 minAvaxOut,
        address recipient
    ) internal returns (uint256 avaxOut) {
        BondingCurveV2 curve = BondingCurveV2(payable(bondingCurve));

        // Transfer tokens from user
        IERC20(token).safeTransferFrom(msg.sender, address(this), tokenAmount);
        IERC20(token).approve(bondingCurve, tokenAmount);

        // Execute sell
        uint256 grossAvaxOut = curve.sell(tokenAmount, 0);

        // Calculate and collect fee
        uint256 feeAmount = 0;
        if (address(feeManager) != address(0)) {
            IFeeManager.FeeDistribution memory feeDist = feeManager.calculateTradingFee(grossAvaxOut);
            feeAmount = feeDist.totalFee;
            feeManager.collectTradingFee{value: feeAmount}(token, msg.sender, grossAvaxOut, false);
        }

        avaxOut = grossAvaxOut - feeAmount;

        if (avaxOut < minAvaxOut) revert LaunchpadErrors.SlippageExceeded();

        // Transfer AVAX to recipient
        (bool success,) = recipient.call{value: avaxOut}("");
        if (!success) revert LaunchpadErrors.FeeTransferFailed();

        // Get new price for activity tracking
        uint256 newPrice = curve.getCurrentPrice();

        // Record activity
        if (address(activityTracker) != address(0)) {
            string memory userHandle = "";
            if (address(creatorRegistry) != address(0) && creatorRegistry.hasProfile(msg.sender)) {
                userHandle = creatorRegistry.getProfile(msg.sender).handle;
            }

            activityTracker.recordTrade(
                token,
                msg.sender,
                false, // isBuy
                avaxOut,
                tokenAmount,
                newPrice,
                LaunchpadTokenV2(token).TOTAL_SUPPLY(),
                LaunchpadTokenV2(token).symbol(),
                userHandle
            );
        }

        emit SwapExecuted(msg.sender, token, false, tokenAmount, avaxOut, newPrice);

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
        LaunchpadFactoryV2.LaunchInfo memory info = factory.getLaunchInfo(token);
        if (info.isGraduated) revert LaunchpadErrors.TokenAlreadyGraduated();

        BondingCurveV2 curve = BondingCurveV2(payable(info.bondingCurve));

        // Check/trigger graduation
        IBondingCurve.CurveState curveState = curve.state();
        if (curveState != IBondingCurve.CurveState.Graduating) {
            curve.triggerGraduationCheck();
            curveState = curve.state();

            if (curveState != IBondingCurve.CurveState.Graduating) {
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
     */
    function getQuoteBuy(address token, uint256 avaxAmount)
        external
        view
        returns (uint256 tokensOut, uint256 fee, uint256 priceImpact)
    {
        if (!factory.isLaunchpadToken(token)) revert LaunchpadErrors.NotLaunchpadToken();

        LaunchpadFactoryV2.LaunchInfo memory info = factory.getLaunchInfo(token);
        BondingCurveV2 curve = BondingCurveV2(payable(info.bondingCurve));

        // Calculate fee
        if (address(feeManager) != address(0)) {
            IFeeManager.FeeDistribution memory feeDist = feeManager.calculateTradingFee(avaxAmount);
            fee = feeDist.totalFee;
        }

        uint256 buyAmount = avaxAmount - fee;
        (tokensOut, priceImpact) = curve.getBuyPrice(buyAmount);

        return (tokensOut, fee, priceImpact);
    }

    /**
     * @notice Get quote for selling tokens
     */
    function getQuoteSell(address token, uint256 tokenAmount)
        external
        view
        returns (uint256 avaxOut, uint256 fee, uint256 priceImpact)
    {
        if (!factory.isLaunchpadToken(token)) revert LaunchpadErrors.NotLaunchpadToken();

        LaunchpadFactoryV2.LaunchInfo memory info = factory.getLaunchInfo(token);
        BondingCurveV2 curve = BondingCurveV2(payable(info.bondingCurve));

        uint256 grossAvaxOut;
        (grossAvaxOut, priceImpact) = curve.getSellPrice(tokenAmount);

        if (address(feeManager) != address(0)) {
            IFeeManager.FeeDistribution memory feeDist = feeManager.calculateTradingFee(grossAvaxOut);
            fee = feeDist.totalFee;
        }

        avaxOut = grossAvaxOut - fee;

        return (avaxOut, fee, priceImpact);
    }

    /**
     * @notice Get token info for display
     */
    function getTokenInfo(address token) external view returns (
        string memory name,
        string memory symbol,
        address creator,
        string memory creatorHandle,
        bool isGraduated,
        bool isProLaunch,
        uint256 currentPrice,
        uint256 marketCap,
        uint256 graduationProgress
    ) {
        if (!factory.isLaunchpadToken(token)) revert LaunchpadErrors.NotLaunchpadToken();

        LaunchpadFactoryV2.LaunchInfo memory info = factory.getLaunchInfo(token);
        LaunchpadTokenV2 tokenContract = LaunchpadTokenV2(token);
        BondingCurveV2 curve = BondingCurveV2(payable(info.bondingCurve));

        return (
            tokenContract.name(),
            tokenContract.symbol(),
            info.creator,
            info.creatorHandle,
            info.isGraduated,
            info.isProLaunch,
            curve.getCurrentPrice(),
            curve.getMarketCap(),
            curve.getGraduationProgress()
        );
    }

    /**
     * @notice Check if user can trade a token
     */
    function canUserTrade(address token, address user) external view returns (bool) {
        if (!factory.isLaunchpadToken(token)) return false;
        return LaunchpadTokenV2(token).canTrade(user);
    }

    /**
     * @notice Get creation fee
     */
    function getCreationFee() external view returns (uint256) {
        if (address(feeManager) != address(0)) {
            return feeManager.feeConfig().creationFee;
        }
        return 0;
    }

    // ============ Admin Functions ============

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

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

    receive() external payable {}
}
