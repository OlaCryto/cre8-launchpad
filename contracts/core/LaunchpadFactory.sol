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
import {ILiquidityManager} from "../interfaces/ILiquidityManager.sol";
import {LaunchpadToken} from "./LaunchpadToken.sol";
import {BondingCurve} from "./BondingCurve.sol";
import {LaunchpadErrors} from "../libraries/LaunchpadErrors.sol";
import {Pausable} from "../security/Pausable.sol";

/**
 * @title LaunchpadFactory
 * @notice Factory contract for creating new token launches
 * @dev Uses minimal proxy pattern (EIP-1167) for gas-efficient deployments
 *
 * Architecture:
 * - Factory deploys clones of token and bonding curve implementations
 * - Each token has its own bonding curve instance
 * - Router handles all user-facing interactions
 * - Fee Manager collects and distributes fees
 * - Liquidity Manager handles DEX integration
 */
contract LaunchpadFactory is
    Ownable,
    ReentrancyGuard,
    Pausable
{
    using Clones for address;
    using SafeERC20 for IERC20;

    // ============ Types ============

    struct LaunchParams {
        string name;
        string symbol;
        string description;
        string imageURI;
        string twitter;
        string telegram;
        string website;
    }

    struct LaunchInfo {
        address token;
        address bondingCurve;
        address creator;
        uint256 createdAt;
        bool isGraduated;
    }

    // ============ Events ============

    event TokenLaunched(address indexed token, address indexed bondingCurve, address indexed creator, string name, string symbol);
    event TokenGraduated(address indexed token, address indexed pair, uint256 liquidityAdded);
    event ImplementationUpdated(address indexed oldImpl, address indexed newImpl);
    event BondingCurveImplUpdated(address indexed oldImpl, address indexed newImpl);
    event RouterUpdated(address indexed oldRouter, address indexed newRouter);
    event FeeManagerUpdated(address indexed oldFeeManager, address indexed newFeeManager);
    event LiquidityManagerUpdated(address indexed oldManager, address indexed newManager);

    // ============ State Variables ============

    address public tokenImplementation;
    address public bondingCurveImplementation;

    address public router;
    address public feeManager;
    address public liquidityManager;

    address[] public allTokens;
    mapping(address => LaunchInfo) public launchInfo;
    mapping(address => bool) public isLaunchpadToken;

    uint256 public graduationThreshold = 69_000 ether;
    event GraduationThresholdUpdated(uint256 oldThreshold, uint256 newThreshold);

    // ============ Constructor ============

    constructor(
        address tokenImpl_,
        address bondingCurveImpl_
    ) {
        if (tokenImpl_ == address(0)) revert LaunchpadErrors.ZeroAddress();
        if (bondingCurveImpl_ == address(0)) revert LaunchpadErrors.ZeroAddress();

        tokenImplementation = tokenImpl_;
        bondingCurveImplementation = bondingCurveImpl_;
    }

    // ============ Configuration ============

    /**
     * @notice Set the router contract
     * @param router_ New router address
     */
    function setRouter(address router_) external onlyOwner {
        if (router_ == address(0)) revert LaunchpadErrors.ZeroAddress();
        emit RouterUpdated(router, router_);
        router = router_;
    }

    /**
     * @notice Set the fee manager contract
     * @param feeManager_ New fee manager address
     */
    function setFeeManager(address feeManager_) external onlyOwner {
        if (feeManager_ == address(0)) revert LaunchpadErrors.ZeroAddress();
        emit FeeManagerUpdated(feeManager, feeManager_);
        feeManager = feeManager_;
    }

    /**
     * @notice Set the liquidity manager contract
     * @param liquidityManager_ New liquidity manager address
     */
    function setLiquidityManager(address liquidityManager_) external onlyOwner {
        if (liquidityManager_ == address(0)) revert LaunchpadErrors.ZeroAddress();
        emit LiquidityManagerUpdated(liquidityManager, liquidityManager_);
        liquidityManager = liquidityManager_;
    }

    /**
     * @notice Update token implementation (for upgrades)
     * @param newImpl New implementation address
     */
    function setTokenImplementation(address newImpl) external onlyOwner {
        if (newImpl == address(0)) revert LaunchpadErrors.ZeroAddress();
        emit ImplementationUpdated(tokenImplementation, newImpl);
        tokenImplementation = newImpl;
    }

    /**
     * @notice Update bonding curve implementation (for upgrades)
     * @param newImpl New implementation address
     */
    function setBondingCurveImplementation(address newImpl) external onlyOwner {
        if (newImpl == address(0)) revert LaunchpadErrors.ZeroAddress();
        emit BondingCurveImplUpdated(bondingCurveImplementation, newImpl);
        bondingCurveImplementation = newImpl;
    }

    /**
     * @notice Update graduation threshold
     * @param threshold New threshold in wei
     */
    function setGraduationThreshold(uint256 threshold) external onlyOwner {
        emit GraduationThresholdUpdated(graduationThreshold, threshold);
        graduationThreshold = threshold;
    }

    // ============ Token Creation ============

    /**
     * @notice Create a new token with bonding curve
     * @param params Launch parameters (name, symbol, metadata)
     * @return token Address of the new token
     * @return bondingCurve Address of the bonding curve
     */
    function createToken(LaunchParams calldata params)
        external
        payable
        nonReentrant
        whenNotPaused
        returns (address token, address bondingCurve)
    {
        return _createTokenInternal(params, msg.sender);
    }

    /**
     * @notice Create a new token on behalf of a creator (called by router)
     * @param params Token launch parameters
     * @param creator The actual creator address
     * @return token The deployed token address
     * @return bondingCurve The deployed bonding curve address
     */
    function createTokenFor(LaunchParams calldata params, address creator)
        external
        payable
        nonReentrant
        whenNotPaused
        returns (address token, address bondingCurve)
    {
        return _createTokenInternal(params, creator);
    }

    /**
     * @notice Internal token creation logic
     */
    function _createTokenInternal(LaunchParams calldata params, address creator)
        internal
        returns (address token, address bondingCurve)
    {
        // Validate inputs
        if (bytes(params.name).length == 0) revert LaunchpadErrors.InvalidTokenName();
        if (bytes(params.symbol).length == 0) revert LaunchpadErrors.InvalidTokenSymbol();
        if (bytes(params.name).length > 32) revert LaunchpadErrors.InvalidTokenName();
        if (bytes(params.symbol).length > 10) revert LaunchpadErrors.InvalidTokenSymbol();
        if (creator == address(0)) revert LaunchpadErrors.ZeroAddress();

        // Only router or direct caller can specify different creator
        if (msg.sender != router && msg.sender != creator) {
            revert LaunchpadErrors.Unauthorized();
        }

        // Collect creation fee
        if (feeManager != address(0)) {
            IFeeManager(feeManager).collectCreationFee{value: msg.value}(creator);
        }

        // Deploy bonding curve clone
        bondingCurve = bondingCurveImplementation.clone();

        // Deploy token clone
        token = tokenImplementation.clone();

        // Initialize token
        LaunchpadToken.TokenMetadata memory metadata = LaunchpadToken.TokenMetadata({
            name: params.name,
            symbol: params.symbol,
            description: params.description,
            imageURI: params.imageURI,
            twitter: params.twitter,
            telegram: params.telegram,
            website: params.website
        });

        LaunchpadToken(token).initialize(
            params.name,
            params.symbol,
            creator,
            bondingCurve,
            metadata
        );

        // Initialize bonding curve
        BondingCurve.CurveParams memory curveParams = BondingCurve.CurveParams({
            basePrice: 0,  // Use defaults
            slope: 0,
            maxSupply: 0,
            graduationThreshold: graduationThreshold
        });

        BondingCurve(payable(bondingCurve)).initialize(token, curveParams);

        // Set router and fee manager on bonding curve
        if (router != address(0)) {
            BondingCurve(payable(bondingCurve)).setRouter(router);
        }
        if (feeManager != address(0)) {
            BondingCurve(payable(bondingCurve)).setFeeManager(feeManager);
        }

        // Record launch info
        launchInfo[token] = LaunchInfo({
            token: token,
            bondingCurve: bondingCurve,
            creator: creator,
            createdAt: block.timestamp,
            isGraduated: false
        });

        allTokens.push(token);
        isLaunchpadToken[token] = true;

        emit TokenLaunched(token, bondingCurve, creator, params.name, params.symbol);

        return (token, bondingCurve);
    }

    // ============ Graduation ============

    /**
     * @notice Graduate a token to DEX
     * @param token Token to graduate
     * @return pair Address of the DEX pair created
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
        BondingCurve curve = BondingCurve(payable(bondingCurve));

        // Check graduation status
        BondingCurve.CurveState curveState = curve.state();
        if (curveState != BondingCurve.CurveState.Graduating) {
            revert LaunchpadErrors.GraduationThresholdNotMet();
        }

        // Get AVAX from bonding curve
        uint256 avaxForLiquidity = curve.executeGraduation();

        // Graduate the token (transfers liquidity reserve)
        LaunchpadToken(token).graduate();

        // Get token liquidity reserve
        uint256 tokenLiquidity = LaunchpadToken(token).LIQUIDITY_SUPPLY();
        IERC20(token).safeTransferFrom(token, address(this), tokenLiquidity);

        // Approve liquidity manager
        IERC20(token).approve(liquidityManager, tokenLiquidity);

        // Add liquidity and lock
        ILiquidityManager.LiquidityParams memory liquidityParams = ILiquidityManager.LiquidityParams({
            token: token,
            tokenAmount: tokenLiquidity,
            avaxAmount: avaxForLiquidity,
            minTokenAmount: (tokenLiquidity * 95) / 100, // 5% slippage
            minAvaxAmount: (avaxForLiquidity * 95) / 100,
            deadline: block.timestamp + 300 // 5 minutes
        });

        uint256 lockDuration = 365 days; // 1 year lock

        (pair,) = ILiquidityManager(liquidityManager).addLiquidityAndLock{value: avaxForLiquidity}(
            liquidityParams,
            lockDuration
        );

        // Update launch info
        info.isGraduated = true;

        emit TokenGraduated(token, pair, avaxForLiquidity);

        return pair;
    }

    // ============ View Functions ============

    /**
     * @notice Get total number of tokens launched
     */
    function getTokenCount() external view returns (uint256) {
        return allTokens.length;
    }

    /**
     * @notice Get token address by index
     * @param index Index in the allTokens array
     */
    function getTokenByIndex(uint256 index) external view returns (address) {
        if (index >= allTokens.length) revert LaunchpadErrors.TokenNotFound();
        return allTokens[index];
    }

    /**
     * @notice Get launch info for a token
     * @param token Token address
     */
    function getLaunchInfo(address token) external view returns (LaunchInfo memory) {
        if (!isLaunchpadToken[token]) revert LaunchpadErrors.NotLaunchpadToken();
        return launchInfo[token];
    }

    /**
     * @notice Get all tokens (paginated)
     * @param offset Starting index
     * @param limit Maximum number of tokens to return
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
     * @notice Get tokens by creator
     * @param creator Creator address
     */
    function getTokensByCreator(address creator)
        external
        view
        returns (address[] memory tokens)
    {
        uint256 count = 0;

        // Count tokens
        for (uint256 i = 0; i < allTokens.length; i++) {
            if (launchInfo[allTokens[i]].creator == creator) {
                count++;
            }
        }

        // Collect tokens
        tokens = new address[](count);
        uint256 index = 0;

        for (uint256 i = 0; i < allTokens.length; i++) {
            if (launchInfo[allTokens[i]].creator == creator) {
                tokens[index++] = allTokens[i];
            }
        }
    }

    // ============ Admin Functions ============

    /**
     * @notice Pause token creation
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Unpause token creation
     */
    function unpause() external onlyOwner {
        _unpause();
    }

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
        // Accept AVAX for graduation liquidity operations
    }
}
