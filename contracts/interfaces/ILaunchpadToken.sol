// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title ILaunchpadToken
 * @notice Interface for tokens created through the launchpad
 */
interface ILaunchpadToken is IERC20 {
    struct TokenMetadata {
        string name;
        string symbol;
        string description;
        string imageURI;
        string twitter;
        string telegram;
        string website;
    }

    event TokenGraduated(address indexed token, address indexed pair, uint256 liquidity);
    event MetadataUpdated(string description, string imageURI);

    function initialize(
        string memory name_,
        string memory symbol_,
        address creator_,
        address bondingCurve_,
        TokenMetadata memory metadata_
    ) external;

    function mint(address to, uint256 amount) external;
    function burn(address from, uint256 amount) external;
    function graduate() external;

    function creator() external view returns (address);
    function bondingCurve() external view returns (address);
    function isGraduated() external view returns (bool);
    function createdAt() external view returns (uint256);
    function graduatedAt() external view returns (uint256);
    function metadata() external view returns (TokenMetadata memory);

    function TOTAL_SUPPLY() external view returns (uint256);
    function BONDING_CURVE_SUPPLY() external view returns (uint256);
    function LIQUIDITY_SUPPLY() external view returns (uint256);
}
