// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

import {ILaunchpadToken} from "../interfaces/ILaunchpadToken.sol";
import {LaunchpadErrors} from "../libraries/LaunchpadErrors.sol";

/**
 * @title LaunchpadToken
 * @notice ERC20 token implementation for launchpad tokens
 * @dev Uses upgradeable pattern for gas-efficient cloning
 *
 * Token Economics:
 * - Total Supply: 1,000,000,000 (1 Billion)
 * - Bonding Curve Supply: 800,000,000 (80%)
 * - Liquidity Reserve: 200,000,000 (20%)
 * - Team/Presale: 0 (True Fair Launch)
 */
contract LaunchpadToken is
    Initializable,
    ERC20Upgradeable,
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable
{
    // ============ Types ============

    struct TokenMetadata {
        string name;
        string symbol;
        string description;
        string imageURI;
        string twitter;
        string telegram;
        string website;
    }

    // ============ Events ============

    event TokenGraduated(address indexed token, address indexed pair, uint256 liquidity);
    event MetadataUpdated(string description, string imageURI);

    // ============ Constants ============

    uint256 public constant TOTAL_SUPPLY = 1_000_000_000 * 1e18;
    uint256 public constant BONDING_CURVE_SUPPLY = 800_000_000 * 1e18;
    uint256 public constant LIQUIDITY_SUPPLY = 200_000_000 * 1e18;

    // ============ State Variables ============

    address public creator;
    address public bondingCurve;
    address public factory;

    bool public isGraduated;
    uint256 public createdAt;
    uint256 public graduatedAt;

    TokenMetadata private _metadata;

    // ============ Modifiers ============

    modifier onlyBondingCurve() {
        if (msg.sender != bondingCurve) revert LaunchpadErrors.OnlyBondingCurve();
        _;
    }

    modifier onlyFactory() {
        if (msg.sender != factory) revert LaunchpadErrors.OnlyFactory();
        _;
    }

    modifier notGraduated() {
        if (isGraduated) revert LaunchpadErrors.TokenAlreadyGraduated();
        _;
    }

    // ============ Constructor ============

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    // ============ Initialization ============

    /**
     * @notice Initialize the token
     * @param name_ Token name
     * @param symbol_ Token symbol
     * @param creator_ Address of the token creator
     * @param bondingCurve_ Address of the bonding curve contract
     * @param metadata_ Token metadata
     */
    function initialize(
        string memory name_,
        string memory symbol_,
        address creator_,
        address bondingCurve_,
        TokenMetadata memory metadata_
    ) external initializer {
        if (creator_ == address(0)) revert LaunchpadErrors.ZeroAddress();
        if (bondingCurve_ == address(0)) revert LaunchpadErrors.ZeroAddress();
        if (bytes(name_).length == 0) revert LaunchpadErrors.InvalidTokenName();
        if (bytes(symbol_).length == 0) revert LaunchpadErrors.InvalidTokenSymbol();

        __ERC20_init(name_, symbol_);
        __Ownable_init();
        __ReentrancyGuard_init();

        creator = creator_;
        bondingCurve = bondingCurve_;
        factory = msg.sender;
        createdAt = block.timestamp;

        _metadata = metadata_;

        // Mint liquidity reserve to this contract (for graduation)
        _mint(address(this), LIQUIDITY_SUPPLY);
    }

    // ============ Minting/Burning (Bonding Curve Only) ============

    /**
     * @notice Mint tokens to a buyer
     * @dev Only callable by the bonding curve contract
     * @param to Recipient address
     * @param amount Amount to mint
     */
    function mint(address to, uint256 amount) external onlyBondingCurve notGraduated {
        if (to == address(0)) revert LaunchpadErrors.ZeroAddress();
        if (amount == 0) revert LaunchpadErrors.ZeroAmount();

        // Check we don't exceed bonding curve supply
        uint256 currentBondingSupply = totalSupply() - LIQUIDITY_SUPPLY;
        if (currentBondingSupply + amount > BONDING_CURVE_SUPPLY) {
            revert LaunchpadErrors.MaxSupplyReached();
        }

        _mint(to, amount);
    }

    /**
     * @notice Burn tokens when sold back to curve
     * @dev Only callable by the bonding curve contract
     * @param from Address to burn from
     * @param amount Amount to burn
     */
    function burn(address from, uint256 amount) external onlyBondingCurve notGraduated {
        if (from == address(0)) revert LaunchpadErrors.ZeroAddress();
        if (amount == 0) revert LaunchpadErrors.ZeroAmount();
        if (balanceOf(from) < amount) revert LaunchpadErrors.InsufficientBalance();

        _burn(from, amount);
    }

    // ============ Graduation ============

    /**
     * @notice Graduate the token to DEX
     * @dev Called by factory during graduation process
     *      Transfers liquidity reserve to the liquidity manager
     */
    function graduate() external onlyFactory notGraduated {
        isGraduated = true;
        graduatedAt = block.timestamp;

        // Transfer liquidity reserve to factory for DEX pairing
        _transfer(address(this), factory, LIQUIDITY_SUPPLY);

        emit TokenGraduated(address(this), address(0), LIQUIDITY_SUPPLY);
    }

    // ============ Metadata ============

    /**
     * @notice Get token metadata
     */
    function metadata() external view returns (TokenMetadata memory) {
        return _metadata;
    }

    /**
     * @notice Update token metadata (creator only)
     * @param description_ New description
     * @param imageURI_ New image URI
     */
    function updateMetadata(string calldata description_, string calldata imageURI_) external {
        if (msg.sender != creator) revert LaunchpadErrors.Unauthorized();

        _metadata.description = description_;
        _metadata.imageURI = imageURI_;

        emit MetadataUpdated(description_, imageURI_);
    }

    // ============ View Functions ============

    /**
     * @notice Get current supply sold through bonding curve
     */
    function bondingCurveSupplySold() external view returns (uint256) {
        uint256 total = totalSupply();
        if (total <= LIQUIDITY_SUPPLY) return 0;
        return total - LIQUIDITY_SUPPLY;
    }

    /**
     * @notice Get remaining supply available on bonding curve
     */
    function bondingCurveSupplyRemaining() external view returns (uint256) {
        uint256 sold = totalSupply() - LIQUIDITY_SUPPLY;
        if (sold >= BONDING_CURVE_SUPPLY) return 0;
        return BONDING_CURVE_SUPPLY - sold;
    }

    /**
     * @notice Check if bonding curve is fully sold
     */
    function isBondingCurveFull() external view returns (bool) {
        return (totalSupply() - LIQUIDITY_SUPPLY) >= BONDING_CURVE_SUPPLY;
    }
}
