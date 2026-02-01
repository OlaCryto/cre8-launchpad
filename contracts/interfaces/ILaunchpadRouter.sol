// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ILaunchpadFactory} from "./ILaunchpadFactory.sol";

/**
 * @title ILaunchpadRouter
 * @notice Interface for the router that handles all user interactions
 * @dev Single entry point for creating tokens, buying, selling, and graduating
 */
interface ILaunchpadRouter {
    struct SwapParams {
        address token;
        uint256 amountIn;
        uint256 minAmountOut;
        address recipient;
        uint256 deadline;
    }

    event TokenCreated(
        address indexed token,
        address indexed creator,
        string name,
        string symbol
    );

    event SwapExecuted(
        address indexed user,
        address indexed token,
        bool isBuy,
        uint256 amountIn,
        uint256 amountOut
    );

    event GraduationExecuted(
        address indexed token,
        address indexed pair,
        uint256 avaxLiquidity,
        uint256 tokenLiquidity
    );

    // Token creation
    function createToken(ILaunchpadFactory.LaunchParams calldata params)
        external
        payable
        returns (address token, address bondingCurve);

    function createTokenAndBuy(
        ILaunchpadFactory.LaunchParams calldata params,
        uint256 minTokensOut
    ) external payable returns (address token, address bondingCurve, uint256 tokensReceived);

    // Trading
    function buy(SwapParams calldata params) external payable returns (uint256 tokensOut);
    function sell(SwapParams calldata params) external returns (uint256 avaxOut);

    // Multi-token operations
    function buyMultiple(SwapParams[] calldata params) external payable returns (uint256[] memory tokensOut);

    // Graduation
    function graduate(address token) external returns (address pair);

    // View functions
    function factory() external view returns (address);
    function feeManager() external view returns (address);
    function liquidityManager() external view returns (address);

    function getQuoteBuy(address token, uint256 avaxAmount)
        external
        view
        returns (uint256 tokensOut, uint256 fee, uint256 priceImpact);

    function getQuoteSell(address token, uint256 tokenAmount)
        external
        view
        returns (uint256 avaxOut, uint256 fee, uint256 priceImpact);
}
