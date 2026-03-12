// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {BondingCurveMath} from "../libraries/BondingCurveMath.sol";
import {LaunchpadErrors} from "../libraries/LaunchpadErrors.sol";
import {ILiquidityManager} from "../interfaces/ILiquidityManager.sol";
import {Cre8Token} from "./Cre8Token.sol";

/**
 * @title Cre8Manager
 * @notice Single entry point for Cre8 token launchpad.
 *
 *         Two launch modes:
 *         - Easy Mode: createToken() — instant launch, anyone can buy immediately
 *         - Forge Mode: createTokenForge() — whitelist phase with AVAX-denominated limits,
 *           then transitions to public trading automatically
 *
 * @dev UUPS upgradeable. Arena-style single contract architecture.
 *
 *      Whitelist uses fixed AVAX amounts (not percentages) to prevent the common
 *      "0.1% allocation = $10 actual" confusion that frustrates non-technical creators.
 *      Creator sets: "max 5 AVAX per wallet, max 1 AVAX per buy" — everyone understands.
 */
contract Cre8Manager is
    Initializable,
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable,
    UUPSUpgradeable,
    PausableUpgradeable
{
    using SafeERC20 for IERC20;

    // ============ Types ============

    struct TokenParams {
        address tokenAddress;
        address creator;
        uint256 createdAt;
        bool graduated;
        bool lpDeployed;
        string name;
        string symbol;
    }

    struct CurveConfig {
        uint256 virtualAvax;
        uint256 virtualTokens;
        uint256 maxSupply;
        uint256 graduationThreshold;
    }

    struct FeeConfig {
        uint256 protocolFeeBps;
        uint256 creatorFeeBps;
        uint256 creationFee;
    }

    struct FeeData {
        uint256 protocolFee;
        uint256 creatorFee;
        uint256 totalFee;
        address creator;
    }

    /// @notice Whitelist configuration for Forge Mode launches
    /// @dev Uses fixed AVAX amounts, not percentages
    struct WhitelistConfig {
        uint256 endTime;       // Timestamp when whitelist phase ends (0 = no whitelist / Easy Mode)
        uint256 maxWalletAvax; // Max total AVAX a single wallet can spend during whitelist
        uint256 maxTxAvax;     // Max AVAX per single transaction during whitelist
    }

    // ============ Events ============

    event TokenCreated(
        uint256 indexed tokenId,
        address indexed token,
        address indexed creator,
        string name,
        string symbol,
        uint256 creatorBuyAmount
    );

    event TokenCreatedForge(
        uint256 indexed tokenId,
        address indexed token,
        address indexed creator,
        uint256 whitelistEndTime,
        uint256 maxWalletAvax,
        uint256 maxTxAvax,
        uint256 whitelistedCount
    );

    event Buy(
        address indexed buyer,
        uint256 indexed tokenId,
        uint256 avaxIn,
        uint256 tokensOut,
        uint256 newSupply,
        uint256 newPrice
    );

    event Sell(
        address indexed seller,
        uint256 indexed tokenId,
        uint256 tokensIn,
        uint256 avaxOut,
        uint256 newSupply,
        uint256 newPrice
    );

    event Graduated(
        uint256 indexed tokenId,
        address indexed token,
        address pair,
        uint256 avaxLiquidity,
        uint256 tokenLiquidity
    );

    event FeeConfigUpdated(uint256 protocolFeeBps, uint256 creatorFeeBps, uint256 creationFee);
    event ProtocolFeeDestinationSet(address destination);
    event WhitelistUpdated(uint256 indexed tokenId, address[] accounts, bool status);
    event BlacklistUpdated(uint256 indexed tokenId, address[] accounts, bool status);

    // ============ Constants ============

    uint256 internal constant PRECISION = 1e18;
    uint256 internal constant BPS_DENOMINATOR = 10000;

    uint256 internal constant DEFAULT_VIRTUAL_AVAX = 30 ether;
    uint256 internal constant DEFAULT_VIRTUAL_TOKENS = 1_073_000_000 * 1e18;
    uint256 internal constant DEFAULT_MAX_SUPPLY = 800_000_000 * 1e18;
    uint256 internal constant DEFAULT_GRADUATION_THRESHOLD = 420 ether;
    uint256 internal constant LIQUIDITY_SUPPLY = 200_000_000 * 1e18;

    uint256 public constant MAX_CREATOR_BUY_BPS = 2000;
    uint256 public constant MIN_WHITELIST_DURATION = 1 minutes;
    uint256 public constant MAX_WHITELIST_DURATION = 60 minutes;

    // ============ State ============

    uint256 public tokenCount;
    mapping(uint256 => TokenParams) public tokenParams;
    mapping(address => uint256) public tokenToId;
    mapping(uint256 => uint256) public tokenSupply;
    mapping(uint256 => uint256) public tokenBalance;

    CurveConfig public curveConfig;
    FeeConfig public feeConfig;
    address public protocolFeeDestination;
    address public liquidityManager;

    // Forge Mode: whitelist state per token
    mapping(uint256 => WhitelistConfig) public whitelistConfig;
    mapping(uint256 => mapping(address => bool)) public whitelisted;
    mapping(uint256 => mapping(address => uint256)) public walletSpentDuringWL;

    // Storage gap for future upgrades
    uint256[47] private __gap;

    // ============ Constructor ============

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    // ============ Initializer ============

    function initialize(address protocolFeeDestination_, address owner_) external initializer {
        if (protocolFeeDestination_ == address(0)) revert LaunchpadErrors.ZeroAddress();
        if (owner_ == address(0)) revert LaunchpadErrors.ZeroAddress();

        __Ownable_init();
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();
        __Pausable_init();

        _transferOwnership(owner_);

        protocolFeeDestination = protocolFeeDestination_;

        curveConfig = CurveConfig({
            virtualAvax: DEFAULT_VIRTUAL_AVAX,
            virtualTokens: DEFAULT_VIRTUAL_TOKENS,
            maxSupply: DEFAULT_MAX_SUPPLY,
            graduationThreshold: DEFAULT_GRADUATION_THRESHOLD
        });

        feeConfig = FeeConfig({
            protocolFeeBps: 100,
            creatorFeeBps: 0,
            creationFee: 0.02 ether
        });
    }

    // ============ UUPS ============

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    // ============ Easy Mode: Token Creation ============

    /**
     * @notice Create a token (Easy Mode — no whitelist, instant public trading)
     */
    function createToken(
        string calldata name,
        string calldata symbol,
        uint256 creatorBuyBps
    ) external payable nonReentrant whenNotPaused returns (uint256 tokenId, address tokenAddress) {
        (tokenId, tokenAddress) = _createToken(name, symbol, creatorBuyBps);

        emit TokenCreated(tokenId, tokenAddress, msg.sender, name, symbol, msg.value - feeConfig.creationFee);

        // Execute creator initial buy
        uint256 remainingAvax = msg.value - feeConfig.creationFee;
        if (creatorBuyBps > 0 && remainingAvax > 0) {
            _buy(tokenId, remainingAvax, msg.sender);
        } else if (remainingAvax > 0) {
            payable(msg.sender).transfer(remainingAvax);
        }
    }

    // ============ Forge Mode: Token Creation with Whitelist ============

    /**
     * @notice Create a token (Forge Mode — whitelist phase before public trading)
     * @param name Token name
     * @param symbol Token symbol
     * @param creatorBuyBps Creator initial buy (0-2000 = 0-20%)
     * @param whitelistDuration Whitelist phase duration in seconds (60-3600)
     * @param maxWalletAvax Max total AVAX per wallet during whitelist (e.g., 5 ether)
     * @param maxTxAvax Max AVAX per transaction during whitelist (e.g., 1 ether)
     * @param whitelistAddrs Addresses to whitelist (frontend parses CSV into array)
     * @param blacklistAddrs Addresses to blacklist permanently
     */
    function createTokenForge(
        string calldata name,
        string calldata symbol,
        uint256 creatorBuyBps,
        uint256 whitelistDuration,
        uint256 maxWalletAvax,
        uint256 maxTxAvax,
        address[] calldata whitelistAddrs,
        address[] calldata blacklistAddrs
    ) external payable nonReentrant whenNotPaused returns (uint256 tokenId, address tokenAddress) {
        // Validate whitelist params
        if (whitelistDuration < MIN_WHITELIST_DURATION || whitelistDuration > MAX_WHITELIST_DURATION) {
            revert LaunchpadErrors.InvalidInput();
        }
        if (maxWalletAvax == 0) revert LaunchpadErrors.ZeroAmount();
        if (maxTxAvax == 0) revert LaunchpadErrors.ZeroAmount();
        if (maxTxAvax > maxWalletAvax) revert LaunchpadErrors.InvalidInput();

        // Create token
        (tokenId, tokenAddress) = _createToken(name, symbol, creatorBuyBps);

        // Set whitelist config
        uint256 endTime = block.timestamp + whitelistDuration;
        whitelistConfig[tokenId] = WhitelistConfig({
            endTime: endTime,
            maxWalletAvax: maxWalletAvax,
            maxTxAvax: maxTxAvax
        });

        // Add whitelisted addresses
        for (uint256 i = 0; i < whitelistAddrs.length; i++) {
            whitelisted[tokenId][whitelistAddrs[i]] = true;
        }

        // Add blacklisted addresses on the token
        if (blacklistAddrs.length > 0) {
            Cre8Token(tokenAddress).setBlacklistBatch(blacklistAddrs, true);
        }

        // Creator is always whitelisted
        whitelisted[tokenId][msg.sender] = true;

        emit TokenCreatedForge(
            tokenId, tokenAddress, msg.sender,
            endTime, maxWalletAvax, maxTxAvax, whitelistAddrs.length
        );

        // Execute creator initial buy
        uint256 remainingAvax = msg.value - feeConfig.creationFee;
        if (creatorBuyBps > 0 && remainingAvax > 0) {
            _buy(tokenId, remainingAvax, msg.sender);
        } else if (remainingAvax > 0) {
            payable(msg.sender).transfer(remainingAvax);
        }
    }

    // ============ Whitelist Management (creator can update during WL phase) ============

    /**
     * @notice Add or remove whitelist addresses (only token creator, only during WL phase)
     */
    function updateWhitelist(uint256 tokenId, address[] calldata accounts, bool status) external {
        if (tokenParams[tokenId].creator != msg.sender) revert LaunchpadErrors.Unauthorized();
        WhitelistConfig memory wl = whitelistConfig[tokenId];
        if (wl.endTime == 0 || block.timestamp > wl.endTime) revert LaunchpadErrors.InvalidInput();

        for (uint256 i = 0; i < accounts.length; i++) {
            whitelisted[tokenId][accounts[i]] = status;
        }

        emit WhitelistUpdated(tokenId, accounts, status);
    }

    /**
     * @notice Add or remove blacklist addresses (only token creator)
     */
    function updateBlacklist(uint256 tokenId, address[] calldata accounts, bool status) external {
        if (tokenParams[tokenId].creator != msg.sender) revert LaunchpadErrors.Unauthorized();

        Cre8Token token = Cre8Token(tokenParams[tokenId].tokenAddress);
        for (uint256 i = 0; i < accounts.length; i++) {
            token.setBlacklist(accounts[i], status);
        }

        emit BlacklistUpdated(tokenId, accounts, status);
    }

    // ============ Trading ============

    /**
     * @notice Buy tokens with slippage + deadline protection
     * @dev During whitelist phase: enforces maxTxAvax and maxWalletAvax limits
     */
    function buy(uint256 tokenId, uint256 minTokensOut, uint256 deadline) external payable nonReentrant whenNotPaused {
        if (block.timestamp > deadline) revert LaunchpadErrors.DeadlineExpired();
        if (msg.value == 0) revert LaunchpadErrors.ZeroAmount();
        if (tokenParams[tokenId].tokenAddress == address(0)) revert LaunchpadErrors.TokenNotFound();
        if (tokenParams[tokenId].graduated) revert LaunchpadErrors.TokenAlreadyGraduated();

        // Whitelist: check eligibility before buy, track actual spend after
        _checkWhitelistEligibility(tokenId, msg.sender, msg.value);

        (uint256 tokensOut, uint256 avaxUsed) = _buy(tokenId, msg.value, msg.sender);

        _trackWhitelistSpend(tokenId, msg.sender, avaxUsed);

        if (tokensOut < minTokensOut) revert LaunchpadErrors.SlippageExceeded();

        if (_isGraduationReady(tokenId) && liquidityManager != address(0)) {
            _graduate(tokenId);
        }
    }

    /**
     * @notice Sell tokens with slippage + deadline protection
     */
    function sell(uint256 tokenId, uint256 amount, uint256 minAvaxOut, uint256 deadline) external nonReentrant whenNotPaused {
        if (block.timestamp > deadline) revert LaunchpadErrors.DeadlineExpired();
        if (amount == 0) revert LaunchpadErrors.ZeroAmount();
        if (tokenParams[tokenId].tokenAddress == address(0)) revert LaunchpadErrors.TokenNotFound();
        if (tokenParams[tokenId].graduated) revert LaunchpadErrors.TokenAlreadyGraduated();

        uint256 avaxOut = _sell(tokenId, amount, msg.sender);

        if (avaxOut < minAvaxOut) revert LaunchpadErrors.SlippageExceeded();
    }

    // ============ Internal: Token Creation ============

    function _createToken(
        string calldata name,
        string calldata symbol,
        uint256 creatorBuyBps
    ) internal returns (uint256 tokenId, address tokenAddress) {
        if (bytes(name).length == 0 || bytes(name).length > 32) revert LaunchpadErrors.InvalidTokenName();
        if (bytes(symbol).length == 0 || bytes(symbol).length > 10) revert LaunchpadErrors.InvalidTokenSymbol();
        if (creatorBuyBps > MAX_CREATOR_BUY_BPS) revert LaunchpadErrors.InvalidInput();
        if (msg.value < feeConfig.creationFee) revert LaunchpadErrors.InsufficientCreationFee();

        // Collect creation fee
        if (feeConfig.creationFee > 0) {
            _sendFeeToProtocol(feeConfig.creationFee);
        }

        // Deploy token
        tokenId = ++tokenCount;
        Cre8Token newToken = new Cre8Token(name, symbol, msg.sender, address(this));
        tokenAddress = address(newToken);

        tokenParams[tokenId] = TokenParams({
            tokenAddress: tokenAddress,
            creator: msg.sender,
            createdAt: block.timestamp,
            graduated: false,
            lpDeployed: false,
            name: name,
            symbol: symbol
        });
        tokenToId[tokenAddress] = tokenId;
    }

    // ============ Internal: Whitelist Enforcement ============

    /**
     * @notice Check whitelist eligibility (view-only, no state changes).
     * @dev Called BEFORE _buy() to validate the user can trade.
     *      Spending is tracked separately via _trackWhitelistSpend() AFTER
     *      _buy() returns the actual AVAX used, so supply-cap refunds
     *      don't inflate the tracked wallet spend.
     */
    function _checkWhitelistEligibility(uint256 tokenId, address buyer, uint256 avaxAmount) internal view {
        WhitelistConfig memory wl = whitelistConfig[tokenId];

        // No whitelist configured (Easy Mode) or whitelist phase ended
        if (wl.endTime == 0 || block.timestamp > wl.endTime) return;

        // Whitelist is active — enforce rules
        if (!whitelisted[tokenId][buyer]) revert LaunchpadErrors.TradingNotStarted();

        // Max per transaction
        if (avaxAmount > wl.maxTxAvax) revert LaunchpadErrors.MaxTransactionExceeded();

        // Max per wallet (cumulative) — pre-check against intended spend
        uint256 totalSpent = walletSpentDuringWL[tokenId][buyer] + avaxAmount;
        if (totalSpent > wl.maxWalletAvax) revert LaunchpadErrors.MaxWalletExceeded();
    }

    /**
     * @notice Track actual AVAX spent during whitelist phase.
     * @dev Called AFTER _buy() with the real amount used (cost + fees),
     *      not msg.value, to avoid overcounting when supply-cap refunds occur.
     */
    function _trackWhitelistSpend(uint256 tokenId, address buyer, uint256 avaxUsed) internal {
        WhitelistConfig memory wl = whitelistConfig[tokenId];
        if (wl.endTime == 0 || block.timestamp > wl.endTime) return;
        walletSpentDuringWL[tokenId][buyer] += avaxUsed;
    }

    // ============ Internal: Trading ============

    function _buy(uint256 tokenId, uint256 avaxAmount, address buyer) internal returns (uint256 tokensOut, uint256 avaxUsed) {
        FeeData memory fees = _calculateFees(tokenId, avaxAmount);
        uint256 buyAmount = avaxAmount - fees.totalFee;

        uint256 currentSupply = tokenSupply[tokenId];
        tokensOut = BondingCurveMath.calculatePurchaseReturn(
            buyAmount, currentSupply, curveConfig.virtualAvax, curveConfig.virtualTokens
        );

        if (tokensOut == 0) revert LaunchpadErrors.ZeroAmount();

        // Cap at max supply — recalculate fees proportionally and refund excess
        uint256 remaining = curveConfig.maxSupply - currentSupply;
        if (tokensOut > remaining) {
            tokensOut = remaining;
            if (tokensOut == 0) revert LaunchpadErrors.MaxSupplyReached();

            uint256 actualCost = BondingCurveMath.calculateBuyCost(
                tokensOut, currentSupply, curveConfig.virtualAvax, curveConfig.virtualTokens
            );

            // Recalculate fees on actual cost, not original amount
            fees = _calculateFees(tokenId, actualCost);
            buyAmount = actualCost;

            // Refund unused AVAX (excess buy amount + excess fees)
            uint256 totalUsed = actualCost + fees.totalFee;
            if (avaxAmount > totalUsed) {
                payable(buyer).transfer(avaxAmount - totalUsed);
            }
        }

        avaxUsed = buyAmount + fees.totalFee;

        // Update state (CEI pattern)
        tokenSupply[tokenId] = currentSupply + tokensOut;
        tokenBalance[tokenId] += buyAmount;

        Cre8Token(tokenParams[tokenId].tokenAddress).mint(buyer, tokensOut);
        _distributeFees(fees);

        uint256 newPrice = BondingCurveMath.getCurrentPrice(
            tokenSupply[tokenId], curveConfig.virtualAvax, curveConfig.virtualTokens
        );

        emit Buy(buyer, tokenId, avaxAmount, tokensOut, tokenSupply[tokenId], newPrice);
    }

    function _sell(uint256 tokenId, uint256 tokenAmount, address seller) internal returns (uint256 netAvax) {
        uint256 currentSupply = tokenSupply[tokenId];
        if (tokenAmount > currentSupply) revert LaunchpadErrors.InsufficientReserve();

        address tokenAddr = tokenParams[tokenId].tokenAddress;
        uint256 userBalance = IERC20(tokenAddr).balanceOf(seller);
        if (userBalance < tokenAmount) revert LaunchpadErrors.InsufficientBalance();

        uint256 grossAvax = BondingCurveMath.calculateSaleReturn(
            tokenAmount, currentSupply, curveConfig.virtualAvax, curveConfig.virtualTokens
        );
        if (grossAvax > tokenBalance[tokenId]) revert LaunchpadErrors.InsufficientReserve();

        FeeData memory fees = _calculateFees(tokenId, grossAvax);
        netAvax = grossAvax - fees.totalFee;

        // Update state (CEI pattern)
        tokenSupply[tokenId] = currentSupply - tokenAmount;
        tokenBalance[tokenId] -= grossAvax;

        Cre8Token(tokenAddr).burn(seller, tokenAmount);
        payable(seller).transfer(netAvax);
        _distributeFees(fees);

        uint256 newPrice = BondingCurveMath.getCurrentPrice(
            tokenSupply[tokenId], curveConfig.virtualAvax, curveConfig.virtualTokens
        );

        emit Sell(seller, tokenId, tokenAmount, netAvax, tokenSupply[tokenId], newPrice);
    }

    // ============ Fee Helpers ============

    function _calculateFees(uint256 tokenId, uint256 amount) internal view returns (FeeData memory fees) {
        fees.creator = tokenParams[tokenId].creator;
        fees.protocolFee = (amount * feeConfig.protocolFeeBps + 5000) / BPS_DENOMINATOR;
        fees.creatorFee = (amount * feeConfig.creatorFeeBps + 5000) / BPS_DENOMINATOR;
        fees.totalFee = fees.protocolFee + fees.creatorFee;
    }

    function _distributeFees(FeeData memory fees) internal {
        uint256 protocolAmount = fees.protocolFee;

        if (fees.creatorFee > 0 && fees.creator != address(0)) {
            (bool success,) = payable(fees.creator).call{value: fees.creatorFee, gas: 2300}("");
            if (!success) {
                protocolAmount += fees.creatorFee;
            }
        }

        if (protocolAmount > 0) {
            _sendFeeToProtocol(protocolAmount);
        }
    }

    function _sendFeeToProtocol(uint256 amount) internal {
        (bool success,) = payable(protocolFeeDestination).call{value: amount}("");
        if (!success) revert LaunchpadErrors.FeeTransferFailed();
    }

    // ============ Graduation ============

    function _isGraduationReady(uint256 tokenId) internal view returns (bool) {
        uint256 totalTokenSupply = Cre8Token(tokenParams[tokenId].tokenAddress).MAX_SUPPLY();
        uint256 marketCap = BondingCurveMath.calculateMarketCap(
            tokenSupply[tokenId], totalTokenSupply, curveConfig.virtualAvax, curveConfig.virtualTokens
        );
        return marketCap >= curveConfig.graduationThreshold;
    }

    function _graduate(uint256 tokenId) internal {
        TokenParams storage params = tokenParams[tokenId];
        if (params.graduated) return;

        params.graduated = true;
        params.lpDeployed = true;

        address tokenAddr = params.tokenAddress;
        uint256 avaxForLiquidity = tokenBalance[tokenId];
        tokenBalance[tokenId] = 0;

        Cre8Token(tokenAddr).mint(address(this), LIQUIDITY_SUPPLY);
        Cre8Token(tokenAddr).setGraduated();

        IERC20(tokenAddr).approve(liquidityManager, LIQUIDITY_SUPPLY);

        ILiquidityManager.LiquidityParams memory liqParams = ILiquidityManager.LiquidityParams({
            token: tokenAddr,
            tokenAmount: LIQUIDITY_SUPPLY,
            avaxAmount: avaxForLiquidity,
            minTokenAmount: (LIQUIDITY_SUPPLY * 95) / 100,
            minAvaxAmount: (avaxForLiquidity * 95) / 100,
            deadline: block.timestamp + 300
        });

        (address pair,) = ILiquidityManager(liquidityManager).addLiquidityAndLock{value: avaxForLiquidity}(
            liqParams, 365 days
        );

        Cre8Token(tokenAddr).renounceOwnership();

        emit Graduated(tokenId, tokenAddr, pair, avaxForLiquidity, LIQUIDITY_SUPPLY);
    }

    function graduate(uint256 tokenId) external nonReentrant whenNotPaused {
        if (tokenParams[tokenId].tokenAddress == address(0)) revert LaunchpadErrors.TokenNotFound();
        if (tokenParams[tokenId].graduated) revert LaunchpadErrors.TokenAlreadyGraduated();
        if (!_isGraduationReady(tokenId)) revert LaunchpadErrors.GraduationThresholdNotMet();
        if (liquidityManager == address(0)) revert LaunchpadErrors.ZeroAddress();

        _graduate(tokenId);
    }

    // ============ View Functions ============

    function getTokenInfo(uint256 tokenId) external view returns (
        address tokenAddress,
        address creator,
        string memory name,
        string memory symbol,
        uint256 currentSupply,
        uint256 reserveBalance,
        uint256 currentPrice,
        uint256 marketCap,
        uint256 graduationProgress,
        bool graduated
    ) {
        TokenParams memory p = tokenParams[tokenId];
        if (p.tokenAddress == address(0)) revert LaunchpadErrors.TokenNotFound();

        uint256 supply = tokenSupply[tokenId];
        uint256 price = BondingCurveMath.getCurrentPrice(supply, curveConfig.virtualAvax, curveConfig.virtualTokens);
        uint256 totalTokenSupply = Cre8Token(p.tokenAddress).MAX_SUPPLY();
        uint256 mCap = BondingCurveMath.calculateMarketCap(supply, totalTokenSupply, curveConfig.virtualAvax, curveConfig.virtualTokens);

        uint256 progress = mCap >= curveConfig.graduationThreshold
            ? BPS_DENOMINATOR
            : (mCap * BPS_DENOMINATOR) / curveConfig.graduationThreshold;

        return (p.tokenAddress, p.creator, p.name, p.symbol, supply, tokenBalance[tokenId], price, mCap, progress, p.graduated);
    }

    function getTokenByAddress(address tokenAddr) external view returns (uint256 tokenId) {
        tokenId = tokenToId[tokenAddr];
        if (tokenId == 0) revert LaunchpadErrors.TokenNotFound();
    }

    function getBuyQuote(uint256 tokenId, uint256 avaxAmount) external view returns (uint256 tokensOut, uint256 fee) {
        FeeData memory fees = _calculateFees(tokenId, avaxAmount);
        fee = fees.totalFee;
        uint256 buyAmount = avaxAmount - fee;
        tokensOut = BondingCurveMath.calculatePurchaseReturn(
            buyAmount, tokenSupply[tokenId], curveConfig.virtualAvax, curveConfig.virtualTokens
        );
        uint256 remaining = curveConfig.maxSupply - tokenSupply[tokenId];
        if (tokensOut > remaining) tokensOut = remaining;
    }

    function getSellQuote(uint256 tokenId, uint256 tokenAmount) external view returns (uint256 avaxOut, uint256 fee) {
        uint256 grossAvax = BondingCurveMath.calculateSaleReturn(
            tokenAmount, tokenSupply[tokenId], curveConfig.virtualAvax, curveConfig.virtualTokens
        );
        FeeData memory fees = _calculateFees(tokenId, grossAvax);
        fee = fees.totalFee;
        avaxOut = grossAvax - fee;
    }

    function getCurrentPrice(uint256 tokenId) external view returns (uint256) {
        return BondingCurveMath.getCurrentPrice(tokenSupply[tokenId], curveConfig.virtualAvax, curveConfig.virtualTokens);
    }

    /// @notice Check if whitelist is currently active for a token
    function isWhitelistActive(uint256 tokenId) external view returns (bool) {
        WhitelistConfig memory wl = whitelistConfig[tokenId];
        return wl.endTime > 0 && block.timestamp <= wl.endTime;
    }

    /// @notice Get remaining AVAX allocation for a wallet during whitelist
    function getWhitelistAllowance(uint256 tokenId, address wallet) external view returns (uint256 remaining) {
        WhitelistConfig memory wl = whitelistConfig[tokenId];
        if (wl.endTime == 0 || block.timestamp > wl.endTime) return type(uint256).max; // no limit
        if (!whitelisted[tokenId][wallet]) return 0;
        uint256 spent = walletSpentDuringWL[tokenId][wallet];
        return spent >= wl.maxWalletAvax ? 0 : wl.maxWalletAvax - spent;
    }

    // ============ Admin ============

    function setFeeConfig(uint256 protocolFeeBps_, uint256 creatorFeeBps_, uint256 creationFee_) external onlyOwner {
        if (protocolFeeBps_ + creatorFeeBps_ > 1000) revert LaunchpadErrors.InvalidInput();
        feeConfig = FeeConfig(protocolFeeBps_, creatorFeeBps_, creationFee_);
        emit FeeConfigUpdated(protocolFeeBps_, creatorFeeBps_, creationFee_);
    }

    function setProtocolFeeDestination(address dest) external onlyOwner {
        if (dest == address(0)) revert LaunchpadErrors.ZeroAddress();
        protocolFeeDestination = dest;
        emit ProtocolFeeDestinationSet(dest);
    }

    function setLiquidityManager(address lm) external onlyOwner {
        if (lm == address(0)) revert LaunchpadErrors.ZeroAddress();
        liquidityManager = lm;
    }

    function setCurveConfig(uint256 virtualAvax_, uint256 virtualTokens_, uint256 maxSupply_, uint256 graduationThreshold_) external onlyOwner {
        if (virtualAvax_ == 0 || virtualTokens_ == 0) revert LaunchpadErrors.ZeroAmount();
        if (maxSupply_ >= virtualTokens_) revert LaunchpadErrors.InvalidInput();
        curveConfig = CurveConfig(virtualAvax_, virtualTokens_, maxSupply_, graduationThreshold_);
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    function emergencyWithdraw(address to, uint256 amount) external onlyOwner {
        if (to == address(0)) revert LaunchpadErrors.ZeroAddress();
        (bool success,) = to.call{value: amount}("");
        if (!success) revert LaunchpadErrors.FeeTransferFailed();
    }

    function renounceOwnership() public override onlyOwner {}

    receive() external payable {}
}
