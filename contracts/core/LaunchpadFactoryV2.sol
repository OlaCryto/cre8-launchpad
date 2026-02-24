// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {ILaunchpadFactory} from "../interfaces/ILaunchpadFactory.sol";
import {ILaunchpadToken} from "../interfaces/ILaunchpadToken.sol";
import {IBondingCurve} from "../interfaces/IBondingCurve.sol";
import {IFeeManager} from "../interfaces/IFeeManager.sol";
import {FeeManager} from "./FeeManager.sol";
import {ILiquidityManager} from "../interfaces/ILiquidityManager.sol";
import {LaunchpadErrors} from "../libraries/LaunchpadErrors.sol";
import {Pausable} from "../security/Pausable.sol";

// Import V2 contracts
import {LaunchpadTokenV2} from "./LaunchpadTokenV2.sol";
import {BondingCurveV2} from "./BondingCurveV2.sol";
import {CreatorRegistry} from "./CreatorRegistry.sol";
import {ActivityTracker} from "./ActivityTracker.sol";

/**
 * @title LaunchpadFactoryV2
 * @notice Factory contract supporting Easy and Pro launch modes (Arena-style)
 * @dev Supports creator profiles, whitelist/blacklist, trading phases
 *
 * Launch Modes:
 * - Easy Launch: Simple token creation with immediate public trading
 * - Pro Launch: Advanced features (whitelist, blacklist, presale phases)
 *
 * Requirements:
 * - Creators must have a registered profile to launch tokens
 * - Tokens can be paired with AVAX (default)
 */
contract LaunchpadFactoryV2 is
    Ownable,
    ReentrancyGuard,
    Pausable
{
    using Clones for address;
    using SafeERC20 for IERC20;

    // ============ Structs ============

    struct EasyLaunchParams {
        string name;
        string symbol;
        string imageURI;
        string description;
        string twitter;
        string telegram;
        string website;
        uint256 creatorBuyBps;      // Percentage of supply for creator to buy (0-2000 = 0-20%)
    }

    struct ProLaunchParams {
        string name;
        string symbol;
        string imageURI;
        string description;
        string twitter;
        string telegram;
        string website;
        uint256 creatorBuyBps;
        address[] whitelist;        // Initial whitelist addresses
        uint256 whitelistDuration;  // Whitelist phase duration in seconds
        uint256 tradingStartTime;   // When trading begins (0 = immediately)
    }

    struct LaunchInfo {
        address token;
        address bondingCurve;
        address creator;
        uint256 createdAt;
        bool isGraduated;
        bool isProLaunch;
        string creatorHandle;
    }

    // ============ State Variables ============

    // Implementation contracts
    address public tokenImplementation;
    address public bondingCurveImplementation;

    // Core contracts
    address public router;
    address public feeManager;
    address public liquidityManager;
    CreatorRegistry public creatorRegistry;
    ActivityTracker public activityTracker;

    // Token tracking
    address[] public allTokens;
    mapping(address => LaunchInfo) public launchInfo;
    mapping(address => bool) public isLaunchpadToken;

    // Category tracking
    address[] public graduatedTokens;     // Tokens that passed bonding curve
    mapping(address => bool) public isGraduatedToken;

    // Configuration
    uint256 public graduationThreshold = 69_000 ether;
    bool public requireProfile = true;  // Require creator profile to launch

    // ============ Events ============

    event TokenLaunched(
        address indexed token,
        address indexed bondingCurve,
        address indexed creator,
        string name,
        string symbol,
        bool isProLaunch
    );

    event TokenGraduated(
        address indexed token,
        address indexed pair,
        uint256 liquidityAdded
    );

    event RouterUpdated(address indexed oldRouter, address indexed newRouter);
    event FeeManagerUpdated(address indexed oldFeeManager, address indexed newFeeManager);
    event LiquidityManagerUpdated(address indexed oldManager, address indexed newManager);
    event CreatorRegistryUpdated(address indexed oldRegistry, address indexed newRegistry);
    event ActivityTrackerUpdated(address indexed oldTracker, address indexed newTracker);
    event ImplementationUpdated(address indexed oldImpl, address indexed newImpl);
    event BondingCurveImplUpdated(address indexed oldImpl, address indexed newImpl);
    event GraduationThresholdUpdated(uint256 oldThreshold, uint256 newThreshold);

    // ============ Constructor ============

    constructor(
        address tokenImpl_,
        address bondingCurveImpl_,
        address creatorRegistry_,
        address activityTracker_
    ) {
        if (tokenImpl_ == address(0)) revert LaunchpadErrors.ZeroAddress();
        if (bondingCurveImpl_ == address(0)) revert LaunchpadErrors.ZeroAddress();

        tokenImplementation = tokenImpl_;
        bondingCurveImplementation = bondingCurveImpl_;

        if (creatorRegistry_ != address(0)) {
            creatorRegistry = CreatorRegistry(creatorRegistry_);
        }

        if (activityTracker_ != address(0)) {
            activityTracker = ActivityTracker(activityTracker_);
        }
    }

    // ============ Configuration ============

    function setRouter(address router_) external onlyOwner {
        if (router_ == address(0)) revert LaunchpadErrors.ZeroAddress();
        emit RouterUpdated(router, router_);
        router = router_;
    }

    function setFeeManager(address feeManager_) external onlyOwner {
        if (feeManager_ == address(0)) revert LaunchpadErrors.ZeroAddress();
        emit FeeManagerUpdated(feeManager, feeManager_);
        feeManager = feeManager_;
    }

    function setLiquidityManager(address liquidityManager_) external onlyOwner {
        if (liquidityManager_ == address(0)) revert LaunchpadErrors.ZeroAddress();
        emit LiquidityManagerUpdated(liquidityManager, liquidityManager_);
        liquidityManager = liquidityManager_;
    }

    function setCreatorRegistry(address registry_) external onlyOwner {
        if (registry_ == address(0)) revert LaunchpadErrors.ZeroAddress();
        emit CreatorRegistryUpdated(address(creatorRegistry), registry_);
        creatorRegistry = CreatorRegistry(registry_);
    }

    function setActivityTracker(address tracker_) external onlyOwner {
        if (tracker_ == address(0)) revert LaunchpadErrors.ZeroAddress();
        emit ActivityTrackerUpdated(address(activityTracker), tracker_);
        activityTracker = ActivityTracker(tracker_);
    }

    function setTokenImplementation(address newImpl) external onlyOwner {
        if (newImpl == address(0)) revert LaunchpadErrors.ZeroAddress();
        emit ImplementationUpdated(tokenImplementation, newImpl);
        tokenImplementation = newImpl;
    }

    function setBondingCurveImplementation(address newImpl) external onlyOwner {
        if (newImpl == address(0)) revert LaunchpadErrors.ZeroAddress();
        emit BondingCurveImplUpdated(bondingCurveImplementation, newImpl);
        bondingCurveImplementation = newImpl;
    }

    function setGraduationThreshold(uint256 threshold) external onlyOwner {
        emit GraduationThresholdUpdated(graduationThreshold, threshold);
        graduationThreshold = threshold;
    }

    function setRequireProfile(bool required) external onlyOwner {
        requireProfile = required;
    }

    // ============ Easy Launch ============

    /**
     * @notice Create a token with Easy Launch mode
     * @param params Easy launch parameters
     * @return token Token address
     * @return bondingCurve Bonding curve address
     */
    function createTokenEasy(EasyLaunchParams calldata params)
        external
        payable
        nonReentrant
        whenNotPaused
        returns (address token, address bondingCurve)
    {
        // Validate creator has profile if required
        string memory creatorHandle = _validateCreator(msg.sender);

        // Validate params
        _validateTokenParams(params.name, params.symbol);

        // Collect creation fee
        _collectCreationFee();

        // Deploy contracts
        (token, bondingCurve) = _deployTokenEasy(params, msg.sender);

        // Record launch
        _recordLaunch(token, bondingCurve, msg.sender, params.name, params.symbol, false, creatorHandle);

        // Handle creator initial buy if specified
        if (params.creatorBuyBps > 0 && msg.value > _getCreationFee()) {
            uint256 buyAmount = msg.value - _getCreationFee();
            _executeCreatorBuy(bondingCurve, buyAmount);
        }

        return (token, bondingCurve);
    }

    /**
     * @notice Deploy Easy Launch token
     */
    function _deployTokenEasy(
        EasyLaunchParams calldata params,
        address creator_
    ) internal returns (address token, address bondingCurve) {
        // Deploy bonding curve clone
        bondingCurve = bondingCurveImplementation.clone();

        // Deploy token clone
        token = tokenImplementation.clone();

        // Initialize token (Easy mode)
        LaunchpadTokenV2.TokenMetadata memory metadata = LaunchpadTokenV2.TokenMetadata({
            name: params.name,
            symbol: params.symbol,
            description: params.description,
            imageURI: params.imageURI,
            twitter: params.twitter,
            telegram: params.telegram,
            website: params.website
        });

        LaunchpadTokenV2(token).initialize(
            params.name,
            params.symbol,
            creator_,
            bondingCurve,
            metadata
        );

        // Initialize bonding curve
        BondingCurveV2.CurveParams memory curveParams = BondingCurveV2.CurveParams({
            basePrice: 0,
            slope: 0,
            maxSupply: 0,
            graduationThreshold: graduationThreshold
        });

        BondingCurveV2(payable(bondingCurve)).initialize(token, curveParams);

        // Configure bonding curve
        if (router != address(0)) {
            BondingCurveV2(payable(bondingCurve)).setRouter(router);
        }
        if (feeManager != address(0)) {
            BondingCurveV2(payable(bondingCurve)).setFeeManager(feeManager);
        }

        return (token, bondingCurve);
    }

    // ============ Pro Launch ============

    /**
     * @notice Create a token with Pro Launch mode
     * @param params Pro launch parameters
     * @return token Token address
     * @return bondingCurve Bonding curve address
     */
    function createTokenPro(ProLaunchParams calldata params)
        external
        payable
        nonReentrant
        whenNotPaused
        returns (address token, address bondingCurve)
    {
        // Pro launch requires verified creator status
        string memory creatorHandle = _validateVerifiedCreator(msg.sender);

        // Validate params
        _validateTokenParams(params.name, params.symbol);

        // Collect creation fee
        _collectCreationFee();

        // Deploy contracts
        (token, bondingCurve) = _deployTokenPro(params, msg.sender);

        // Record launch
        _recordLaunch(token, bondingCurve, msg.sender, params.name, params.symbol, true, creatorHandle);

        // Handle creator initial buy if specified
        if (params.creatorBuyBps > 0 && msg.value > _getCreationFee()) {
            uint256 buyAmount = msg.value - _getCreationFee();
            _executeCreatorBuy(bondingCurve, buyAmount);
        }

        return (token, bondingCurve);
    }

    /**
     * @notice Deploy Pro Launch token
     */
    function _deployTokenPro(
        ProLaunchParams calldata params,
        address creator_
    ) internal returns (address token, address bondingCurve) {
        // Deploy bonding curve clone
        bondingCurve = bondingCurveImplementation.clone();

        // Deploy token clone
        token = tokenImplementation.clone();

        // Initialize token (Pro mode with whitelist)
        LaunchpadTokenV2.TokenMetadata memory metadata = LaunchpadTokenV2.TokenMetadata({
            name: params.name,
            symbol: params.symbol,
            description: params.description,
            imageURI: params.imageURI,
            twitter: params.twitter,
            telegram: params.telegram,
            website: params.website
        });

        LaunchpadTokenV2(token).initializePro(
            params.name,
            params.symbol,
            creator_,
            bondingCurve,
            metadata,
            params.whitelist,
            params.whitelistDuration,
            params.tradingStartTime
        );

        // Initialize bonding curve
        BondingCurveV2.CurveParams memory curveParams = BondingCurveV2.CurveParams({
            basePrice: 0,
            slope: 0,
            maxSupply: 0,
            graduationThreshold: graduationThreshold
        });

        BondingCurveV2(payable(bondingCurve)).initialize(token, curveParams);

        // Configure bonding curve
        if (router != address(0)) {
            BondingCurveV2(payable(bondingCurve)).setRouter(router);
        }
        if (feeManager != address(0)) {
            BondingCurveV2(payable(bondingCurve)).setFeeManager(feeManager);
        }

        return (token, bondingCurve);
    }

    // ============ Internal Functions ============

    function _validateCreator(address creator_) internal view returns (string memory handle) {
        if (requireProfile && address(creatorRegistry) != address(0)) {
            if (!creatorRegistry.hasProfile(creator_)) {
                revert LaunchpadErrors.Unauthorized();
            }
            CreatorRegistry.CreatorProfile memory profile = creatorRegistry.getProfile(creator_);
            return profile.handle;
        }
        return "";
    }

    function _validateVerifiedCreator(address creator_) internal view returns (string memory handle) {
        if (address(creatorRegistry) == address(0)) revert LaunchpadErrors.Unauthorized();
        if (!creatorRegistry.hasProfile(creator_)) revert LaunchpadErrors.Unauthorized();
        CreatorRegistry.CreatorProfile memory profile = creatorRegistry.getProfile(creator_);
        if (!profile.isVerified) revert LaunchpadErrors.Unauthorized();
        return profile.handle;
    }

    function _validateTokenParams(string calldata name, string calldata symbol) internal pure {
        if (bytes(name).length == 0 || bytes(name).length > 32) {
            revert LaunchpadErrors.InvalidTokenName();
        }
        if (bytes(symbol).length == 0 || bytes(symbol).length > 10) {
            revert LaunchpadErrors.InvalidTokenSymbol();
        }
    }

    function _collectCreationFee() internal {
        if (feeManager != address(0)) {
            uint256 creationFee = IFeeManager(feeManager).feeConfig().creationFee;
            if (msg.value < creationFee) {
                revert LaunchpadErrors.InsufficientCreationFee();
            }
            IFeeManager(feeManager).collectCreationFee{value: creationFee}(msg.sender);
        }
    }

    function _getCreationFee() internal view returns (uint256) {
        if (feeManager != address(0)) {
            return IFeeManager(feeManager).feeConfig().creationFee;
        }
        return 0;
    }

    function _executeCreatorBuy(address bondingCurve, uint256 amount) internal {
        // Forward AVAX to bonding curve for creator buy
        BondingCurveV2(payable(bondingCurve)).buy{value: amount}(0);
    }

    function _recordLaunch(
        address token,
        address bondingCurve,
        address creator_,
        string calldata name,
        string calldata symbol,
        bool isProLaunch,
        string memory creatorHandle
    ) internal {
        launchInfo[token] = LaunchInfo({
            token: token,
            bondingCurve: bondingCurve,
            creator: creator_,
            createdAt: block.timestamp,
            isGraduated: false,
            isProLaunch: isProLaunch,
            creatorHandle: creatorHandle
        });

        allTokens.push(token);
        isLaunchpadToken[token] = true;

        // Update creator registry
        if (address(creatorRegistry) != address(0)) {
            creatorRegistry.recordTokenLaunch(creator_, token);
        }

        // Record activity
        if (address(activityTracker) != address(0)) {
            activityTracker.recordTokenLaunch(token, creator_, name, symbol, creatorHandle);
        }

        // Register with fee manager
        if (feeManager != address(0)) {
            FeeManager(payable(feeManager)).registerTokenCreator(token, creator_);
        }

        emit TokenLaunched(token, bondingCurve, creator_, name, symbol, isProLaunch);
    }

    // ============ Graduation ============

    /**
     * @notice Graduate a token to DEX
     * @param token Token to graduate
     * @return pair DEX pair address
     */
    function graduateToken(address token)
        external
        nonReentrant
        returns (address pair)
    {
        if (!isLaunchpadToken[token]) revert LaunchpadErrors.NotLaunchpadToken();

        LaunchInfo storage info = launchInfo[token];
        if (info.isGraduated) revert LaunchpadErrors.TokenAlreadyGraduated();

        address bondingCurve = info.bondingCurve;
        BondingCurveV2 curve = BondingCurveV2(payable(bondingCurve));

        // Check graduation status
        BondingCurveV2.CurveState curveState = curve.state();
        if (curveState != BondingCurveV2.CurveState.Graduating) {
            revert LaunchpadErrors.GraduationThresholdNotMet();
        }

        // Get AVAX from bonding curve
        uint256 avaxForLiquidity = curve.executeGraduation();

        // Graduate the token — this transfers LIQUIDITY_SUPPLY to this contract
        LaunchpadTokenV2(token).graduate();

        // Tokens are now in the factory after graduate() call
        uint256 tokenLiquidity = LaunchpadTokenV2(token).LIQUIDITY_SUPPLY();

        // Approve liquidity manager
        IERC20(token).approve(liquidityManager, tokenLiquidity);

        // Add liquidity and lock
        ILiquidityManager.LiquidityParams memory liquidityParams = ILiquidityManager.LiquidityParams({
            token: token,
            tokenAmount: tokenLiquidity,
            avaxAmount: avaxForLiquidity,
            minTokenAmount: (tokenLiquidity * 95) / 100,
            minAvaxAmount: (avaxForLiquidity * 95) / 100,
            deadline: block.timestamp + 300
        });

        uint256 lockDuration = 365 days;

        (pair,) = ILiquidityManager(liquidityManager).addLiquidityAndLock{value: avaxForLiquidity}(
            liquidityParams,
            lockDuration
        );

        // Update state
        info.isGraduated = true;
        graduatedTokens.push(token);
        isGraduatedToken[token] = true;

        // Update creator registry
        if (address(creatorRegistry) != address(0)) {
            creatorRegistry.recordGraduation(info.creator);
        }

        // Record activity
        if (address(activityTracker) != address(0)) {
            activityTracker.recordGraduation(
                token,
                pair,
                avaxForLiquidity,
                tokenLiquidity,
                LaunchpadTokenV2(token).symbol()
            );
        }

        emit TokenGraduated(token, pair, avaxForLiquidity);

        return pair;
    }

    // ============ View Functions ============

    function getTokenCount() external view returns (uint256) {
        return allTokens.length;
    }

    function getGraduatedTokenCount() external view returns (uint256) {
        return graduatedTokens.length;
    }

    function getTokenByIndex(uint256 index) external view returns (address) {
        if (index >= allTokens.length) revert LaunchpadErrors.TokenNotFound();
        return allTokens[index];
    }

    function getLaunchInfo(address token) external view returns (LaunchInfo memory) {
        if (!isLaunchpadToken[token]) revert LaunchpadErrors.NotLaunchpadToken();
        return launchInfo[token];
    }

    /**
     * @notice Get tokens paginated
     */
    function getTokens(uint256 offset, uint256 limit)
        external
        view
        returns (address[] memory tokens)
    {
        uint256 total = allTokens.length;
        if (offset >= total) return new address[](0);

        uint256 end = offset + limit;
        if (end > total) end = total;

        tokens = new address[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            tokens[i - offset] = allTokens[i];
        }
    }

    /**
     * @notice Get graduated tokens (official tokens)
     */
    function getGraduatedTokens(uint256 offset, uint256 limit)
        external
        view
        returns (address[] memory tokens)
    {
        uint256 total = graduatedTokens.length;
        if (offset >= total) return new address[](0);

        uint256 end = offset + limit;
        if (end > total) end = total;

        tokens = new address[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            tokens[i - offset] = graduatedTokens[i];
        }
    }

    /**
     * @notice Get tokens by creator
     */
    function getTokensByCreator(address creator_)
        external
        view
        returns (address[] memory tokens)
    {
        uint256 count = 0;

        for (uint256 i = 0; i < allTokens.length; i++) {
            if (launchInfo[allTokens[i]].creator == creator_) {
                count++;
            }
        }

        tokens = new address[](count);
        uint256 index = 0;

        for (uint256 i = 0; i < allTokens.length; i++) {
            if (launchInfo[allTokens[i]].creator == creator_) {
                tokens[index++] = allTokens[i];
            }
        }
    }

    /**
     * @notice Get newest tokens
     */
    function getNewestTokens(uint256 count) external view returns (address[] memory tokens) {
        uint256 total = allTokens.length;
        if (count > total) count = total;

        tokens = new address[](count);
        for (uint256 i = 0; i < count; i++) {
            tokens[i] = allTokens[total - 1 - i];
        }
    }

    // ============ Admin Functions ============

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

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

    receive() external payable {}
}
