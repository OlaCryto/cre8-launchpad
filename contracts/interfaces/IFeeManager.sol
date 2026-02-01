// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IFeeManager
 * @notice Interface for managing platform fees
 */
interface IFeeManager {
    struct FeeConfig {
        uint256 platformFeeBps;      // Platform fee in basis points (100 = 1%)
        uint256 creatorFeeBps;       // Creator fee in basis points (20 = 0.2%)
        uint256 graduationFeeBps;    // Fee on graduation liquidity (150 = 1.5%)
        uint256 creationFee;         // Flat fee for token creation (in wei)
    }

    struct FeeDistribution {
        uint256 platformAmount;
        uint256 creatorAmount;
        uint256 totalFee;
    }

    event FeesCollected(
        address indexed token,
        address indexed payer,
        uint256 platformFee,
        uint256 creatorFee
    );

    event FeesDistributed(
        address indexed creator,
        uint256 amount
    );

    event FeeConfigUpdated(
        uint256 platformFeeBps,
        uint256 creatorFeeBps,
        uint256 graduationFeeBps,
        uint256 creationFee
    );

    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);

    function collectTradingFee(
        address token,
        address payer,
        uint256 amount,
        bool isBuy
    ) external payable returns (FeeDistribution memory);

    function collectCreationFee(address creator) external payable;
    function collectGraduationFee(address token, uint256 liquidityAmount) external returns (uint256 fee);

    function withdrawCreatorFees(address creator) external returns (uint256);
    function withdrawToTreasury() external returns (uint256);

    function calculateTradingFee(uint256 amount) external view returns (FeeDistribution memory);
    function calculateGraduationFee(uint256 liquidityAmount) external view returns (uint256);

    function feeConfig() external view returns (FeeConfig memory);
    function treasury() external view returns (address);
    function creatorPendingFees(address creator) external view returns (uint256);
    function totalPlatformFees() external view returns (uint256);
}
