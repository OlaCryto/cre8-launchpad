// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ILaunchpadToken} from "./ILaunchpadToken.sol";

/**
 * @title ILaunchpadFactory
 * @notice Interface for the factory that creates new token launches
 */
interface ILaunchpadFactory {
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

    event TokenLaunched(
        address indexed token,
        address indexed bondingCurve,
        address indexed creator,
        string name,
        string symbol
    );

    event TokenGraduated(
        address indexed token,
        address indexed pair,
        uint256 liquidityAdded
    );

    event ImplementationUpdated(address indexed oldImpl, address indexed newImpl);
    event BondingCurveImplUpdated(address indexed oldImpl, address indexed newImpl);

    function createToken(LaunchParams calldata params) external payable returns (address token, address bondingCurve);

    function getTokenCount() external view returns (uint256);
    function getTokenByIndex(uint256 index) external view returns (address);
    function getLaunchInfo(address token) external view returns (LaunchInfo memory);
    function isLaunchpadToken(address token) external view returns (bool);

    function tokenImplementation() external view returns (address);
    function bondingCurveImplementation() external view returns (address);
    function router() external view returns (address);
    function feeManager() external view returns (address);
    function liquidityManager() external view returns (address);
}
