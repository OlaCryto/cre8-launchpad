// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {IBondingCurve} from "../interfaces/IBondingCurve.sol";
import {ILaunchpadToken} from "../interfaces/ILaunchpadToken.sol";
import {BondingCurveMath} from "../libraries/BondingCurveMath.sol";
import {LaunchpadErrors} from "../libraries/LaunchpadErrors.sol";
import {AntiBot} from "../security/AntiBot.sol";

interface ILaunchpadTokenV2 is ILaunchpadToken {
    function canTrade(address account) external view returns (bool);
    function isProLaunch() external view returns (bool);
}

/**
 * @title BondingCurveV2
 * @notice Enhanced bonding curve with support for Easy/Pro launch modes
 * @dev Works with LaunchpadTokenV2 for whitelist/blacklist enforcement
 *
 * Features:
 * - Linear bonding curve pricing
 * - Creator initial buy support (percentage of supply)
 * - Integration with token whitelist/blacklist
 * - Trading phase awareness
 * - Anti-bot protection
 */
contract BondingCurveV2 is
    Initializable,
    ReentrancyGuardUpgradeable,
    AntiBot
{
    using SafeERC20 for IERC20;
    using BondingCurveMath for uint256;

    // ============ Types ============

    enum CurveState { Trading, Graduating, Graduated }

    struct CurveParams {
        uint256 basePrice;
        uint256 slope;
        uint256 maxSupply;
        uint256 graduationThreshold;
    }

    struct CurveState_ {
        uint256 currentSupply;
        uint256 reserveBalance;
        CurveState state;
    }

    // ============ Events ============

    event TokensPurchased(address indexed buyer, address indexed token, uint256 avaxIn, uint256 tokensOut, uint256 newPrice);
    event TokensSold(address indexed seller, address indexed token, uint256 tokensIn, uint256 avaxOut, uint256 newPrice);
    event GraduationTriggered(address indexed token, uint256 marketCap, uint256 reserveBalance);
    event CreatorInitialBuy(address indexed creator, uint256 avaxAmount, uint256 tokensReceived, uint256 percentageOfSupply);
    event TradingPairSet(address indexed pair);

    // ============ Constants ============

    uint256 internal constant PRECISION = 1e18;

    uint256 internal constant DEFAULT_BASE_PRICE = 1e12;  // 1 AVAX buys ~1 million tokens initially
    uint256 internal constant DEFAULT_SLOPE = 0;         // Constant price (no bonding curve slope)
    uint256 internal constant DEFAULT_MAX_SUPPLY = 800_000_000 * 1e18;
    uint256 internal constant DEFAULT_GRADUATION_THRESHOLD = 69_000 ether;

    uint256 public constant MAX_CREATOR_BUY_BPS = 2000;

    // ============ State Variables ============

    address public token;
    address public factory;
    address public router;
    address public feeManager;

    CurveParams public curveParams;

    uint256 public currentSupply;
    uint256 public reserveBalance;
    CurveState public state;

    address public creator;
    uint256 public creatorInitialBuyBps;
    uint256 public creatorInitialTokens;

    address public tradingPair;

    // ============ Modifiers ============

    modifier onlyRouter() {
        if (msg.sender != router && msg.sender != factory) {
            revert LaunchpadErrors.OnlyRouter();
        }
        _;
    }

    modifier onlyFactory() {
        if (msg.sender != factory) revert LaunchpadErrors.OnlyFactory();
        _;
    }

    modifier whenTrading() {
        if (state != CurveState.Trading) revert LaunchpadErrors.TradingDisabled();
        _;
    }

    modifier canUserTrade(address user) {
        // Check if token allows this user to trade
        if (!ILaunchpadTokenV2(token).canTrade(user)) {
            revert LaunchpadErrors.TradingDisabled();
        }
        _;
    }

    // ============ Constructor ============

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    // ============ Initialization ============

    /**
     * @notice Initialize the bonding curve
     * @param token_ Token address
     * @param params_ Curve parameters
     */
    function initialize(address token_, CurveParams memory params_) external initializer {
        if (token_ == address(0)) revert LaunchpadErrors.ZeroAddress();

        __ReentrancyGuard_init();

        token = token_;
        factory = msg.sender;
        creator = ILaunchpadToken(token_).creator();

        // Use defaults if not specified
        curveParams = CurveParams({
            basePrice: params_.basePrice > 0 ? params_.basePrice : DEFAULT_BASE_PRICE,
            slope: params_.slope > 0 ? params_.slope : DEFAULT_SLOPE,
            maxSupply: params_.maxSupply > 0 ? params_.maxSupply : DEFAULT_MAX_SUPPLY,
            graduationThreshold: params_.graduationThreshold > 0 ? params_.graduationThreshold : DEFAULT_GRADUATION_THRESHOLD
        });

        state = CurveState.Trading;
        tradingPair = address(0); // AVAX by default

        // Anti-bot disabled — Router is msg.sender so checks don't work correctly
        _initAntiBot(AntiBotConfig({
            enabled: false,
            cooldownPeriod: 0,
            maxTxAmountBps: 0,
            maxWalletAmountBps: 0,
            launchProtectionTime: 0
        }));
    }

    /**
     * @notice Initialize with creator initial buy
     * @param token_ Token address
     * @param params_ Curve parameters
     * @param initialBuyBps_ Percentage of supply for creator to buy (in BPS)
     */
    function initializeWithCreatorBuy(
        address token_,
        CurveParams memory params_,
        uint256 initialBuyBps_
    ) external payable initializer {
        if (token_ == address(0)) revert LaunchpadErrors.ZeroAddress();
        if (initialBuyBps_ > MAX_CREATOR_BUY_BPS) revert LaunchpadErrors.InvalidInput();

        __ReentrancyGuard_init();

        token = token_;
        factory = msg.sender;
        creator = ILaunchpadToken(token_).creator();
        creatorInitialBuyBps = initialBuyBps_;

        curveParams = CurveParams({
            basePrice: params_.basePrice > 0 ? params_.basePrice : DEFAULT_BASE_PRICE,
            slope: params_.slope > 0 ? params_.slope : DEFAULT_SLOPE,
            maxSupply: params_.maxSupply > 0 ? params_.maxSupply : DEFAULT_MAX_SUPPLY,
            graduationThreshold: params_.graduationThreshold > 0 ? params_.graduationThreshold : DEFAULT_GRADUATION_THRESHOLD
        });

        state = CurveState.Trading;

        _initAntiBot(AntiBotConfig({
            enabled: false,
            cooldownPeriod: 0,
            maxTxAmountBps: 0,
            maxWalletAmountBps: 0,
            launchProtectionTime: 0
        }));

        // Execute creator initial buy if specified and AVAX sent
        if (initialBuyBps_ > 0 && msg.value > 0) {
            _executeCreatorInitialBuy(msg.value, initialBuyBps_);
        }
    }

    /**
     * @notice Execute creator's initial token purchase
     * @param avaxAmount AVAX amount for purchase
     * @param targetBps Target percentage of supply to buy
     */
    function _executeCreatorInitialBuy(uint256 avaxAmount, uint256 targetBps) internal {
        // Calculate how many tokens this represents
        uint256 targetTokens = (curveParams.maxSupply * targetBps) / BPS_DENOMINATOR;

        // Calculate tokens from AVAX amount
        uint256 tokensOut = BondingCurveMath.calculatePurchaseReturn(
            avaxAmount,
            0, // Starting from 0 supply
            curveParams.basePrice,
            curveParams.slope
        );

        // Use the lesser of target or calculated
        uint256 actualTokens = tokensOut < targetTokens ? tokensOut : targetTokens;

        if (actualTokens > 0) {
            currentSupply = actualTokens;
            reserveBalance = avaxAmount;
            creatorInitialTokens = actualTokens;

            // Mint tokens to creator
            ILaunchpadToken(token).mint(creator, actualTokens);

            emit CreatorInitialBuy(creator, avaxAmount, actualTokens, targetBps);
        }
    }

    /**
     * @notice Set the router address
     */
    function setRouter(address router_) external onlyFactory {
        if (router_ == address(0)) revert LaunchpadErrors.ZeroAddress();
        router = router_;
    }

    /**
     * @notice Set the fee manager address
     */
    function setFeeManager(address feeManager_) external onlyFactory {
        if (feeManager_ == address(0)) revert LaunchpadErrors.ZeroAddress();
        feeManager = feeManager_;
    }

    // ============ Trading Functions ============

    /**
     * @notice Buy tokens with AVAX
     * @param minTokensOut Minimum tokens to receive
     * @return tokensOut Actual tokens received
     */
    function buy(uint256 minTokensOut)
        external
        payable
        nonReentrant
        whenTrading
        canUserTrade(msg.sender)
        returns (uint256 tokensOut)
    {
        if (msg.value == 0) revert LaunchpadErrors.ZeroAmount();

        // Calculate tokens to receive
        tokensOut = BondingCurveMath.calculatePurchaseReturn(
            msg.value,
            currentSupply,
            curveParams.basePrice,
            curveParams.slope
        );

        if (tokensOut < minTokensOut) revert LaunchpadErrors.SlippageExceeded();

        // Check max supply
        if (currentSupply + tokensOut > curveParams.maxSupply) {
            tokensOut = curveParams.maxSupply - currentSupply;
            if (tokensOut == 0) revert LaunchpadErrors.MaxSupplyReached();
        }

        // Update state
        currentSupply += tokensOut;
        reserveBalance += msg.value;

        // Mint tokens to buyer
        ILaunchpadToken(token).mint(msg.sender, tokensOut);

        // Update trade info
        _updateTradeInfo(msg.sender, tokensOut, true);

        uint256 newPrice = getCurrentPrice();
        emit TokensPurchased(msg.sender, token, msg.value, tokensOut, newPrice);

        // Check for graduation
        _checkGraduation();

        return tokensOut;
    }

    /**
     * @notice Sell tokens for AVAX
     * @param tokenAmount Tokens to sell
     * @param minAvaxOut Minimum AVAX to receive
     * @return avaxOut Actual AVAX received
     */
    function sell(uint256 tokenAmount, uint256 minAvaxOut)
        external
        nonReentrant
        whenTrading
        canUserTrade(msg.sender)
        returns (uint256 avaxOut)
    {
        if (tokenAmount == 0) revert LaunchpadErrors.ZeroAmount();
        if (tokenAmount > currentSupply) revert LaunchpadErrors.InsufficientReserve();

        uint256 userBalance = IERC20(token).balanceOf(msg.sender);
        if (userBalance < tokenAmount) revert LaunchpadErrors.InsufficientBalance();

        // Calculate AVAX to return
        avaxOut = BondingCurveMath.calculateSaleReturn(
            tokenAmount,
            currentSupply,
            curveParams.basePrice,
            curveParams.slope
        );

        if (avaxOut < minAvaxOut) revert LaunchpadErrors.SlippageExceeded();
        if (avaxOut > reserveBalance) revert LaunchpadErrors.InsufficientReserve();

        // Update state
        currentSupply -= tokenAmount;
        reserveBalance -= avaxOut;

        // Burn tokens from seller
        ILaunchpadToken(token).burn(msg.sender, tokenAmount);

        // Update trade info
        _updateTradeInfo(msg.sender, tokenAmount, false);

        // Transfer AVAX to seller
        (bool success,) = msg.sender.call{value: avaxOut}("");
        if (!success) revert LaunchpadErrors.FeeTransferFailed();

        uint256 newPrice = getCurrentPrice();
        emit TokensSold(msg.sender, token, tokenAmount, avaxOut, newPrice);

        return avaxOut;
    }

    // ============ Graduation ============

    function _checkGraduation() internal {
        uint256 marketCap = getMarketCap();

        if (marketCap >= curveParams.graduationThreshold && state == CurveState.Trading) {
            state = CurveState.Graduating;
            emit GraduationTriggered(token, marketCap, reserveBalance);
        }
    }

    function executeGraduation() external onlyFactory returns (uint256 avaxForLiquidity) {
        if (state != CurveState.Graduating) revert LaunchpadErrors.GraduationThresholdNotMet();

        state = CurveState.Graduated;
        avaxForLiquidity = reserveBalance;
        reserveBalance = 0;

        (bool success,) = factory.call{value: avaxForLiquidity}("");
        if (!success) revert LaunchpadErrors.FeeTransferFailed();

        return avaxForLiquidity;
    }

    function triggerGraduationCheck() external {
        _checkGraduation();
    }

    // ============ View Functions ============

    function getCurrentPrice() public view returns (uint256) {
        return BondingCurveMath.getCurrentPrice(
            currentSupply,
            curveParams.basePrice,
            curveParams.slope
        );
    }

    function getBuyPrice(uint256 avaxAmount)
        external
        view
        returns (uint256 tokensOut, uint256 priceImpact)
    {
        tokensOut = BondingCurveMath.calculatePurchaseReturn(
            avaxAmount,
            currentSupply,
            curveParams.basePrice,
            curveParams.slope
        );

        priceImpact = BondingCurveMath.calculatePriceImpact(
            avaxAmount,
            currentSupply,
            curveParams.basePrice,
            curveParams.slope,
            true
        );
    }

    function getSellPrice(uint256 tokenAmount)
        external
        view
        returns (uint256 avaxOut, uint256 priceImpact)
    {
        avaxOut = BondingCurveMath.calculateSaleReturn(
            tokenAmount,
            currentSupply,
            curveParams.basePrice,
            curveParams.slope
        );

        priceImpact = BondingCurveMath.calculatePriceImpact(
            tokenAmount,
            currentSupply,
            curveParams.basePrice,
            curveParams.slope,
            false
        );
    }

    function getMarketCap() public view returns (uint256) {
        uint256 totalSupply = ILaunchpadToken(token).TOTAL_SUPPLY();
        return BondingCurveMath.calculateMarketCap(
            currentSupply,
            totalSupply,
            curveParams.basePrice,
            curveParams.slope
        );
    }

    function isGraduated() external view returns (bool) {
        return state == CurveState.Graduated;
    }

    function curveState() external view returns (CurveState_ memory) {
        return CurveState_({
            currentSupply: currentSupply,
            reserveBalance: reserveBalance,
            state: state
        });
    }

    function getGraduationProgress() external view returns (uint256 progressBps) {
        uint256 marketCap = getMarketCap();
        if (marketCap >= curveParams.graduationThreshold) {
            return BPS_DENOMINATOR;
        }
        return (marketCap * BPS_DENOMINATOR) / curveParams.graduationThreshold;
    }

    function getRemainingSupply() external view returns (uint256) {
        return curveParams.maxSupply - currentSupply;
    }

    /**
     * @notice Get creator's initial buy info
     */
    function getCreatorBuyInfo() external view returns (
        uint256 initialBuyBps,
        uint256 initialTokens,
        uint256 currentBalance
    ) {
        return (
            creatorInitialBuyBps,
            creatorInitialTokens,
            IERC20(token).balanceOf(creator)
        );
    }

    // ============ Admin Functions ============

    function updateAntiBotConfig(AntiBotConfig memory config) external onlyFactory {
        _updateAntiBotConfig(config);
    }

    function setWhitelisted(address user, bool status) external onlyFactory {
        _setWhitelisted(user, status);
    }

    function setBlacklisted(address user, bool status) external onlyFactory {
        _setBlacklisted(user, status);
    }

    // ============ Receive Function ============

    receive() external payable {}
}
