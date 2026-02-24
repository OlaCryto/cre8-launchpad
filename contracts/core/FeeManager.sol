// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";

import {IFeeManager} from "../interfaces/IFeeManager.sol";
import {LaunchpadErrors} from "../libraries/LaunchpadErrors.sol";

/**
 * @title FeeManager
 * @notice Manages fee collection and distribution for the launchpad
 * @dev Handles creation fees, trading fees, and graduation fees
 *
 * Fee Structure:
 * - Creation Fee: 0.02 AVAX (~$1) per token launch
 * - Trading Fee: 1% total (0.8% platform, 0.2% creator)
 * - Graduation Fee: 1.5% of liquidity added to DEX
 */
contract FeeManager is
    Ownable,
    ReentrancyGuard
{
    // ============ Types ============

    struct FeeConfig {
        uint256 platformFeeBps;
        uint256 creatorFeeBps;
        uint256 graduationFeeBps;
        uint256 creationFee;
    }

    struct FeeDistribution {
        uint256 platformAmount;
        uint256 creatorAmount;
        uint256 totalFee;
    }

    // ============ Constants ============

    uint256 internal constant BPS_DENOMINATOR = 10000;
    uint256 internal constant MAX_PLATFORM_FEE = 500;
    uint256 internal constant MAX_CREATOR_FEE = 200;
    uint256 internal constant MAX_GRADUATION_FEE = 300;

    // ============ State Variables ============

    FeeConfig public feeConfig;

    address public treasury;
    address public factory;
    address public router;

    // Creator fee tracking
    mapping(address => uint256) public creatorPendingFees;
    mapping(address => address) public tokenCreators; // token => creator

    uint256 public totalPlatformFees;
    uint256 public totalCreatorFees;

    // ============ Events ============

    event FeesCollected(address indexed token, address indexed payer, uint256 platformFee, uint256 creatorFee);
    event FeesDistributed(address indexed creator, uint256 amount);
    event FeeConfigUpdated(uint256 platformFeeBps, uint256 creatorFeeBps, uint256 graduationFeeBps, uint256 creationFee);
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);
    event CreatorRegistered(address indexed token, address indexed creator);
    event CreatorFeesWithdrawn(address indexed creator, uint256 amount);
    event TreasuryWithdrawal(address indexed to, uint256 amount);

    // ============ Modifiers ============

    modifier onlyAuthorized() {
        if (msg.sender != factory && msg.sender != router && msg.sender != owner()) {
            revert LaunchpadErrors.Unauthorized();
        }
        _;
    }

    // ============ Constructor ============

    constructor(address treasury_) {
        if (treasury_ == address(0)) revert LaunchpadErrors.ZeroAddress();

        treasury = treasury_;

        // Default fee configuration
        feeConfig = FeeConfig({
            platformFeeBps: 80,           // 0.8%
            creatorFeeBps: 20,            // 0.2%
            graduationFeeBps: 150,        // 1.5%
            creationFee: 0.02 ether       // ~$1 at $50 AVAX
        });
    }

    // ============ Configuration ============

    /**
     * @notice Set the factory contract
     * @param factory_ Factory address
     */
    function setFactory(address factory_) external onlyOwner {
        if (factory_ == address(0)) revert LaunchpadErrors.ZeroAddress();
        factory = factory_;
    }

    /**
     * @notice Set the router contract
     * @param router_ Router address
     */
    function setRouter(address router_) external onlyOwner {
        if (router_ == address(0)) revert LaunchpadErrors.ZeroAddress();
        router = router_;
    }

    /**
     * @notice Update treasury address
     * @param treasury_ New treasury address
     */
    function setTreasury(address treasury_) external onlyOwner {
        if (treasury_ == address(0)) revert LaunchpadErrors.ZeroAddress();
        emit TreasuryUpdated(treasury, treasury_);
        treasury = treasury_;
    }

    /**
     * @notice Update fee configuration
     * @param platformFeeBps_ Platform fee in BPS
     * @param creatorFeeBps_ Creator fee in BPS
     * @param graduationFeeBps_ Graduation fee in BPS
     * @param creationFee_ Flat creation fee in wei
     */
    function setFeeConfig(
        uint256 platformFeeBps_,
        uint256 creatorFeeBps_,
        uint256 graduationFeeBps_,
        uint256 creationFee_
    ) external onlyOwner {
        if (platformFeeBps_ > MAX_PLATFORM_FEE) revert LaunchpadErrors.InvalidInput();
        if (creatorFeeBps_ > MAX_CREATOR_FEE) revert LaunchpadErrors.InvalidInput();
        if (graduationFeeBps_ > MAX_GRADUATION_FEE) revert LaunchpadErrors.InvalidInput();

        feeConfig = FeeConfig({
            platformFeeBps: platformFeeBps_,
            creatorFeeBps: creatorFeeBps_,
            graduationFeeBps: graduationFeeBps_,
            creationFee: creationFee_
        });

        emit FeeConfigUpdated(platformFeeBps_, creatorFeeBps_, graduationFeeBps_, creationFee_);
    }

    // ============ Fee Collection ============

    /**
     * @notice Register a token's creator for fee distribution
     * @param token Token address
     * @param creator Creator address
     */
    function registerTokenCreator(address token, address creator) external onlyAuthorized {
        if (token == address(0) || creator == address(0)) revert LaunchpadErrors.ZeroAddress();
        tokenCreators[token] = creator;
        emit CreatorRegistered(token, creator);
    }

    /**
     * @notice Collect creation fee
     * @param creator Address of the token creator
     */
    function collectCreationFee(address creator) external payable onlyAuthorized {
        if (msg.value < feeConfig.creationFee) {
            revert LaunchpadErrors.InsufficientCreationFee();
        }

        totalPlatformFees += msg.value;

        // Refund excess
        if (msg.value > feeConfig.creationFee) {
            uint256 refund = msg.value - feeConfig.creationFee;
            (bool success,) = creator.call{value: refund}("");
            if (!success) revert LaunchpadErrors.FeeTransferFailed();
        }
    }

    /**
     * @notice Collect trading fee
     * @param token Token being traded
     * @param payer Address paying the fee
     * @param amount Trade amount (before fee)
     * @param isBuy Whether this is a buy or sell
     * @return distribution Fee distribution details
     */
    function collectTradingFee(
        address token,
        address payer,
        uint256 amount,
        bool isBuy
    ) external payable onlyAuthorized returns (FeeDistribution memory distribution) {
        distribution = calculateTradingFee(amount);

        if (msg.value < distribution.totalFee) {
            revert LaunchpadErrors.InsufficientPayment();
        }

        // Track platform fees
        totalPlatformFees += distribution.platformAmount;

        // Track creator fees
        address creator = tokenCreators[token];
        if (creator != address(0)) {
            creatorPendingFees[creator] += distribution.creatorAmount;
            totalCreatorFees += distribution.creatorAmount;
        } else {
            // No creator registered, all goes to platform
            totalPlatformFees += distribution.creatorAmount;
        }

        emit FeesCollected(token, payer, distribution.platformAmount, distribution.creatorAmount);

        // Refund excess
        if (msg.value > distribution.totalFee) {
            uint256 refund = msg.value - distribution.totalFee;
            (bool success,) = payer.call{value: refund}("");
            if (!success) revert LaunchpadErrors.FeeTransferFailed();
        }

        return distribution;
    }

    /**
     * @notice Collect graduation fee
     * @param token Token graduating
     * @param liquidityAmount Total liquidity being added
     * @return fee Fee amount collected
     */
    function collectGraduationFee(address token, uint256 liquidityAmount)
        external
        onlyAuthorized
        returns (uint256 fee)
    {
        fee = calculateGraduationFee(liquidityAmount);
        totalPlatformFees += fee;
        return fee;
    }

    // ============ Fee Withdrawal ============

    /**
     * @notice Withdraw pending fees for a creator
     * @param creator Creator address
     * @return amount Amount withdrawn
     */
    function withdrawCreatorFees(address creator) external nonReentrant returns (uint256 amount) {
        amount = creatorPendingFees[creator];
        if (amount == 0) revert LaunchpadErrors.NoFeesToWithdraw();

        creatorPendingFees[creator] = 0;

        (bool success,) = creator.call{value: amount}("");
        if (!success) revert LaunchpadErrors.FeeTransferFailed();

        emit FeesDistributed(creator, amount);
        emit CreatorFeesWithdrawn(creator, amount);

        return amount;
    }

    /**
     * @notice Withdraw platform fees to treasury
     * @return amount Amount withdrawn
     */
    function withdrawToTreasury() external nonReentrant returns (uint256 amount) {
        amount = totalPlatformFees;
        if (amount == 0) revert LaunchpadErrors.NoFeesToWithdraw();

        totalPlatformFees = 0;

        (bool success,) = treasury.call{value: amount}("");
        if (!success) revert LaunchpadErrors.FeeTransferFailed();

        emit TreasuryWithdrawal(treasury, amount);

        return amount;
    }

    // ============ View Functions ============

    /**
     * @notice Calculate trading fee distribution
     * @param amount Trade amount
     * @return distribution Fee breakdown
     */
    function calculateTradingFee(uint256 amount)
        public
        view
        returns (FeeDistribution memory distribution)
    {
        uint256 totalFeeBps = feeConfig.platformFeeBps + feeConfig.creatorFeeBps;
        distribution.totalFee = (amount * totalFeeBps) / BPS_DENOMINATOR;
        distribution.platformAmount = (amount * feeConfig.platformFeeBps) / BPS_DENOMINATOR;
        distribution.creatorAmount = (amount * feeConfig.creatorFeeBps) / BPS_DENOMINATOR;

        return distribution;
    }

    /**
     * @notice Calculate graduation fee
     * @param liquidityAmount Liquidity amount
     * @return fee Fee amount
     */
    function calculateGraduationFee(uint256 liquidityAmount) public view returns (uint256 fee) {
        return (liquidityAmount * feeConfig.graduationFeeBps) / BPS_DENOMINATOR;
    }

    /**
     * @notice Get total trading fee in basis points
     */
    function getTotalTradingFeeBps() external view returns (uint256) {
        return feeConfig.platformFeeBps + feeConfig.creatorFeeBps;
    }

    /**
     * @notice Get creation fee required
     */
    function getCreationFee() external view returns (uint256) {
        return feeConfig.creationFee;
    }

    // ============ Receive Function ============

    receive() external payable {
        // Accept AVAX for fee collection
    }
}
