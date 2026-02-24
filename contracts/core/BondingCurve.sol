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

/**
 * @title BondingCurve
 * @notice Linear bonding curve for fair token launches
 * @dev Implements buy/sell mechanics with automatic price discovery
 *
 * Price Formula: P(s) = basePrice + (slope * s)
 * Where s = current supply sold on curve
 *
 * Features:
 * - Linear price increase as supply is bought
 * - Instant liquidity through automated market making
 * - Anti-bot protection with cooldowns and limits
 * - Automatic graduation when threshold is met
 */
contract BondingCurve is
    Initializable,
    ReentrancyGuardUpgradeable,
    AntiBot
{
    using SafeERC20 for IERC20;
    using BondingCurveMath for uint256;

    // ============ Types (from IBondingCurve) ============

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

    // ============ Constants ============

    uint256 internal constant PRECISION = 1e18;

    uint256 internal constant DEFAULT_BASE_PRICE = 1e12;  // 1 AVAX buys ~1 million tokens initially
    uint256 internal constant DEFAULT_SLOPE = 0;         // Constant price (no bonding curve slope)
    uint256 internal constant DEFAULT_MAX_SUPPLY = 800_000_000 * 1e18;
    uint256 internal constant DEFAULT_GRADUATION_THRESHOLD = 69_000 ether;

    // ============ State Variables ============

    address public token;
    address public factory;
    address public router;
    address public feeManager;

    CurveParams public curveParams;

    uint256 public currentSupply;    // Tokens sold on curve
    uint256 public reserveBalance;   // AVAX held in reserve
    CurveState public state;

    // ============ Modifiers ============

    modifier onlyRouter() {
        if (msg.sender != router) revert LaunchpadErrors.OnlyRouter();
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

    // ============ Constructor ============

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    // ============ Initialization ============

    /**
     * @notice Initialize the bonding curve
     * @param token_ Token address
     * @param params_ Curve parameters (or use defaults if zero)
     */
    function initialize(address token_, CurveParams memory params_) external initializer {
        if (token_ == address(0)) revert LaunchpadErrors.ZeroAddress();

        __ReentrancyGuard_init();

        token = token_;
        factory = msg.sender;

        // Use defaults if not specified
        curveParams = CurveParams({
            basePrice: params_.basePrice > 0 ? params_.basePrice : DEFAULT_BASE_PRICE,
            slope: params_.slope > 0 ? params_.slope : DEFAULT_SLOPE,
            maxSupply: params_.maxSupply > 0 ? params_.maxSupply : DEFAULT_MAX_SUPPLY,
            graduationThreshold: params_.graduationThreshold > 0 ? params_.graduationThreshold : DEFAULT_GRADUATION_THRESHOLD
        });

        state = CurveState.Trading;

        // Initialize anti-bot with default settings
        _initAntiBot(AntiBotConfig({
            enabled: true,
            cooldownPeriod: 30,           // 30 seconds between trades
            maxTxAmountBps: 2000,         // 20% of supply per tx
            maxWalletAmountBps: 5000,     // 50% of supply per wallet
            launchProtectionTime: 300     // 5 minutes of stricter limits
        }));
    }

    /**
     * @notice Set the router address (called by factory after deployment)
     * @param router_ Router contract address
     */
    function setRouter(address router_) external onlyFactory {
        if (router_ == address(0)) revert LaunchpadErrors.ZeroAddress();
        router = router_;
    }

    /**
     * @notice Set the fee manager address
     * @param feeManager_ Fee manager contract address
     */
    function setFeeManager(address feeManager_) external onlyFactory {
        if (feeManager_ == address(0)) revert LaunchpadErrors.ZeroAddress();
        feeManager = feeManager_;
    }

    // ============ Trading Functions ============

    /**
     * @notice Buy tokens with AVAX
     * @param minTokensOut Minimum tokens to receive (slippage protection)
     * @return tokensOut Actual tokens received
     */
    function buy(uint256 minTokensOut)
        external
        payable
        nonReentrant
        whenTrading
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

        // Check we don't exceed max supply
        if (currentSupply + tokensOut > curveParams.maxSupply) {
            // Calculate actual tokens we can sell
            tokensOut = curveParams.maxSupply - currentSupply;
            if (tokensOut == 0) revert LaunchpadErrors.MaxSupplyReached();
        }

        // Anti-bot checks
        _checkAntiBot(msg.sender, tokensOut, curveParams.maxSupply, true);
        _checkMaxWallet(
            msg.sender,
            IERC20(token).balanceOf(msg.sender),
            tokensOut,
            curveParams.maxSupply
        );

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
    }

    /**
     * @notice Sell tokens for AVAX
     * @param tokenAmount Tokens to sell
     * @param minAvaxOut Minimum AVAX to receive (slippage protection)
     * @return avaxOut Actual AVAX received
     */
    function sell(uint256 tokenAmount, uint256 minAvaxOut)
        external
        nonReentrant
        whenTrading
        returns (uint256 avaxOut)
    {
        if (tokenAmount == 0) revert LaunchpadErrors.ZeroAmount();
        if (tokenAmount > currentSupply) revert LaunchpadErrors.InsufficientReserve();

        // Check user balance
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

        // Anti-bot checks
        _checkAntiBot(msg.sender, tokenAmount, curveParams.maxSupply, false);

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
    }

    // ============ Graduation ============

    /**
     * @notice Check if graduation threshold is met and trigger graduation
     */
    function _checkGraduation() internal {
        uint256 marketCap = getMarketCap();

        if (marketCap >= curveParams.graduationThreshold && state == CurveState.Trading) {
            state = CurveState.Graduating;
            emit GraduationTriggered(token, marketCap, reserveBalance);
        }
    }

    /**
     * @notice Complete the graduation process (called by factory)
     * @return avaxForLiquidity AVAX to be used for DEX liquidity
     */
    function executeGraduation() external onlyFactory returns (uint256 avaxForLiquidity) {
        if (state != CurveState.Graduating) revert LaunchpadErrors.GraduationThresholdNotMet();

        state = CurveState.Graduated;
        avaxForLiquidity = reserveBalance;
        reserveBalance = 0;

        // Transfer AVAX to factory for liquidity addition
        (bool success,) = factory.call{value: avaxForLiquidity}("");
        if (!success) revert LaunchpadErrors.FeeTransferFailed();

        return avaxForLiquidity;
    }

    /**
     * @notice Force graduation check (can be called by anyone)
     */
    function triggerGraduationCheck() external {
        _checkGraduation();
    }

    // ============ View Functions ============

    /**
     * @notice Get current price per token
     */
    function getCurrentPrice() public view returns (uint256) {
        return BondingCurveMath.getCurrentPrice(
            currentSupply,
            curveParams.basePrice,
            curveParams.slope
        );
    }

    /**
     * @notice Get quote for buying tokens
     * @param avaxAmount AVAX to spend
     * @return tokensOut Tokens to receive
     * @return priceImpact Price impact in basis points
     */
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

    /**
     * @notice Get quote for selling tokens
     * @param tokenAmount Tokens to sell
     * @return avaxOut AVAX to receive
     * @return priceImpact Price impact in basis points
     */
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

    /**
     * @notice Get current market cap
     * @return Market cap in wei (AVAX)
     */
    function getMarketCap() public view returns (uint256) {
        uint256 totalSupply = ILaunchpadToken(token).TOTAL_SUPPLY();
        return BondingCurveMath.calculateMarketCap(
            currentSupply,
            totalSupply,
            curveParams.basePrice,
            curveParams.slope
        );
    }

    /**
     * @notice Check if token has graduated
     */
    function isGraduated() external view returns (bool) {
        return state == CurveState.Graduated;
    }

    /**
     * @notice Get curve state info
     */
    function curveState() external view returns (CurveState_ memory) {
        return CurveState_({
            currentSupply: currentSupply,
            reserveBalance: reserveBalance,
            state: state
        });
    }

    /**
     * @notice Get progress towards graduation (in basis points)
     */
    function getGraduationProgress() external view returns (uint256 progressBps) {
        uint256 marketCap = getMarketCap();
        if (marketCap >= curveParams.graduationThreshold) {
            return BPS_DENOMINATOR; // 100%
        }
        return (marketCap * BPS_DENOMINATOR) / curveParams.graduationThreshold;
    }

    /**
     * @notice Get remaining supply on bonding curve
     */
    function getRemainingSupply() external view returns (uint256) {
        return curveParams.maxSupply - currentSupply;
    }

    // ============ Admin Functions ============

    modifier onlyFactoryOrRouter() {
        if (msg.sender != factory && msg.sender != router) revert LaunchpadErrors.OnlyFactory();
        _;
    }

    /**
     * @notice Update anti-bot configuration (factory or router)
     */
    function updateAntiBotConfig(AntiBotConfig memory config) external onlyFactoryOrRouter {
        _updateAntiBotConfig(config);
    }

    /**
     * @notice Whitelist an address (factory or router)
     */
    function setWhitelisted(address user, bool status) external onlyFactoryOrRouter {
        _setWhitelisted(user, status);
    }

    /**
     * @notice Blacklist an address (factory or router)
     */
    function setBlacklisted(address user, bool status) external onlyFactoryOrRouter {
        _setBlacklisted(user, status);
    }

    // ============ Receive Function ============

    receive() external payable {
        // Accept AVAX for liquidity operations
    }
}
