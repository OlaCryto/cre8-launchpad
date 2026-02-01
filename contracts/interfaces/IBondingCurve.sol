// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IBondingCurve
 * @notice Interface for the bonding curve contract that manages token pricing
 */
interface IBondingCurve {
    enum CurveState {
        Trading,      // Active trading on bonding curve
        Graduating,   // In process of migrating to DEX
        Graduated     // Fully migrated to DEX
    }

    struct CurveParams {
        uint256 basePrice;           // Starting price (in wei per token)
        uint256 slope;               // Price increase rate
        uint256 maxSupply;           // Maximum tokens available on curve
        uint256 graduationThreshold; // Market cap threshold for graduation
    }

    struct CurveState_ {
        uint256 currentSupply;   // Current tokens in circulation
        uint256 reserveBalance;  // AVAX held in reserve
        CurveState state;        // Current curve state
    }

    // Events
    event TokensPurchased(
        address indexed buyer,
        address indexed token,
        uint256 avaxIn,
        uint256 tokensOut,
        uint256 newPrice
    );

    event TokensSold(
        address indexed seller,
        address indexed token,
        uint256 tokensIn,
        uint256 avaxOut,
        uint256 newPrice
    );

    event GraduationTriggered(
        address indexed token,
        uint256 marketCap,
        uint256 reserveBalance
    );

    // Core trading functions
    function buy(uint256 minTokensOut) external payable returns (uint256 tokensOut);
    function sell(uint256 tokenAmount, uint256 minAvaxOut) external returns (uint256 avaxOut);

    // Initialization
    function initialize(address token_, CurveParams memory params_) external;
    function setRouter(address router_) external;
    function setFeeManager(address feeManager_) external;

    // Graduation
    function executeGraduation() external returns (uint256 avaxForLiquidity);
    function triggerGraduationCheck() external;

    // View functions
    function token() external view returns (address);
    function factory() external view returns (address);
    function router() external view returns (address);
    function feeManager() external view returns (address);

    function curveParams() external view returns (CurveParams memory);
    function curveState() external view returns (CurveState_ memory);

    function getCurrentPrice() external view returns (uint256);
    function getBuyPrice(uint256 avaxAmount) external view returns (uint256 tokensOut, uint256 priceImpact);
    function getSellPrice(uint256 tokenAmount) external view returns (uint256 avaxOut, uint256 priceImpact);
    function getMarketCap() external view returns (uint256);
    function getGraduationProgress() external view returns (uint256 progressBps);
    function getRemainingSupply() external view returns (uint256);
    function isGraduated() external view returns (bool);

    function currentSupply() external view returns (uint256);
    function reserveBalance() external view returns (uint256);
    function state() external view returns (CurveState);
}
