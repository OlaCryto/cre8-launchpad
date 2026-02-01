// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

import {ILaunchpadToken} from "../interfaces/ILaunchpadToken.sol";
import {LaunchpadErrors} from "../libraries/LaunchpadErrors.sol";

/**
 * @title LaunchpadTokenV2
 * @notice Enhanced ERC20 token with whitelist/blacklist and trading phases
 * @dev Supports both Easy Launch and Pro Launch modes (like Arena)
 *
 * Launch Modes:
 * - Easy Launch: Simple token creation, immediate public trading
 * - Pro Launch: Whitelist phase, blacklist, timed presale
 *
 * Trading Phases:
 * 1. Whitelist Phase: Only whitelisted addresses can trade
 * 2. Public Phase: Anyone can trade (except blacklisted)
 *
 * Token Economics:
 * - Total Supply: 1,000,000,000 (1 Billion)
 * - Bonding Curve Supply: 800,000,000 (80%)
 * - Liquidity Reserve: 200,000,000 (20%)
 */
contract LaunchpadTokenV2 is
    Initializable,
    ERC20Upgradeable,
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable,
    ILaunchpadToken
{
    // ============ Enums ============

    enum LaunchMode {
        Easy,   // Simple launch, immediate public trading
        Pro     // Advanced launch with whitelist/blacklist/phases
    }

    enum TradingPhase {
        NotStarted,     // Trading hasn't begun
        Whitelist,      // Only whitelisted addresses can trade
        Public          // Public trading (after whitelist period)
    }

    // ============ Structs ============

    struct ProLaunchConfig {
        bool whitelistEnabled;          // Is whitelist active
        bool blacklistEnabled;          // Is blacklist active
        uint256 whitelistDuration;      // How long whitelist phase lasts (seconds)
        uint256 tradingStartTime;       // When trading begins
        uint256 publicStartTime;        // When public trading begins
    }

    // ============ Constants ============

    uint256 public constant TOTAL_SUPPLY = 1_000_000_000 * 1e18;       // 1 Billion
    uint256 public constant BONDING_CURVE_SUPPLY = 800_000_000 * 1e18;  // 800 Million (80%)
    uint256 public constant LIQUIDITY_SUPPLY = 200_000_000 * 1e18;      // 200 Million (20%)

    uint256 public constant MAX_WHITELIST_DURATION = 7 days;
    uint256 public constant MIN_WHITELIST_DURATION = 1 hours;

    // ============ State Variables ============

    address public creator;
    address public bondingCurve;
    address public factory;

    bool public isGraduated;
    uint256 public createdAt;
    uint256 public graduatedAt;

    TokenMetadata private _metadata;

    // Launch configuration
    LaunchMode public launchMode;
    ProLaunchConfig public proConfig;

    // Whitelist/Blacklist mappings
    mapping(address => bool) public whitelist;
    mapping(address => bool) public blacklist;

    // Whitelist count for tracking
    uint256 public whitelistCount;

    // ============ Events ============

    event TradingPhaseChanged(TradingPhase indexed oldPhase, TradingPhase indexed newPhase);
    event AddedToWhitelist(address indexed account);
    event RemovedFromWhitelist(address indexed account);
    event AddedToBlacklist(address indexed account);
    event RemovedFromBlacklist(address indexed account);
    event WhitelistBatchAdded(address[] accounts);
    event ProConfigUpdated(uint256 whitelistDuration, uint256 tradingStartTime);

    // ============ Modifiers ============

    modifier onlyBondingCurve() {
        if (msg.sender != bondingCurve) revert LaunchpadErrors.OnlyBondingCurve();
        _;
    }

    modifier onlyFactory() {
        if (msg.sender != factory) revert LaunchpadErrors.OnlyFactory();
        _;
    }

    modifier onlyCreator() {
        if (msg.sender != creator) revert LaunchpadErrors.Unauthorized();
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
     * @notice Initialize the token (Easy Launch mode)
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
        _initializeBase(name_, symbol_, creator_, bondingCurve_, metadata_);

        // Easy launch mode - immediate public trading
        launchMode = LaunchMode.Easy;
        proConfig.tradingStartTime = block.timestamp;
        proConfig.publicStartTime = block.timestamp;
    }

    /**
     * @notice Initialize the token (Pro Launch mode)
     * @param name_ Token name
     * @param symbol_ Token symbol
     * @param creator_ Address of the token creator
     * @param bondingCurve_ Address of the bonding curve contract
     * @param metadata_ Token metadata
     * @param whitelistAddresses Initial whitelist addresses
     * @param whitelistDuration Duration of whitelist phase in seconds
     * @param tradingStartTime When trading should begin (0 = immediately)
     */
    function initializePro(
        string memory name_,
        string memory symbol_,
        address creator_,
        address bondingCurve_,
        TokenMetadata memory metadata_,
        address[] memory whitelistAddresses,
        uint256 whitelistDuration,
        uint256 tradingStartTime
    ) external initializer {
        _initializeBase(name_, symbol_, creator_, bondingCurve_, metadata_);

        // Validate whitelist duration
        if (whitelistDuration > 0) {
            if (whitelistDuration < MIN_WHITELIST_DURATION || whitelistDuration > MAX_WHITELIST_DURATION) {
                revert LaunchpadErrors.InvalidInput();
            }
        }

        // Pro launch mode
        launchMode = LaunchMode.Pro;

        // Set trading start time
        uint256 startTime = tradingStartTime > 0 ? tradingStartTime : block.timestamp;

        proConfig = ProLaunchConfig({
            whitelistEnabled: whitelistDuration > 0,
            blacklistEnabled: true,
            whitelistDuration: whitelistDuration,
            tradingStartTime: startTime,
            publicStartTime: whitelistDuration > 0 ? startTime + whitelistDuration : startTime
        });

        // Add initial whitelist addresses
        if (whitelistAddresses.length > 0) {
            for (uint256 i = 0; i < whitelistAddresses.length; i++) {
                if (whitelistAddresses[i] != address(0)) {
                    whitelist[whitelistAddresses[i]] = true;
                    whitelistCount++;
                }
            }
            emit WhitelistBatchAdded(whitelistAddresses);
        }

        // Creator is always whitelisted
        if (!whitelist[creator_]) {
            whitelist[creator_] = true;
            whitelistCount++;
        }
    }

    /**
     * @notice Internal base initialization
     */
    function _initializeBase(
        string memory name_,
        string memory symbol_,
        address creator_,
        address bondingCurve_,
        TokenMetadata memory metadata_
    ) internal {
        if (creator_ == address(0)) revert LaunchpadErrors.ZeroAddress();
        if (bondingCurve_ == address(0)) revert LaunchpadErrors.ZeroAddress();
        if (bytes(name_).length == 0) revert LaunchpadErrors.InvalidTokenName();
        if (bytes(symbol_).length == 0) revert LaunchpadErrors.InvalidTokenSymbol();

        __ERC20_init(name_, symbol_);
        __Ownable_init(msg.sender);
        __ReentrancyGuard_init();

        creator = creator_;
        bondingCurve = bondingCurve_;
        factory = msg.sender;
        createdAt = block.timestamp;

        _metadata = metadata_;

        // Mint liquidity reserve to this contract (for graduation)
        _mint(address(this), LIQUIDITY_SUPPLY);
    }

    // ============ Trading Phase Control ============

    /**
     * @notice Get current trading phase
     */
    function getCurrentPhase() public view returns (TradingPhase) {
        if (launchMode == LaunchMode.Easy) {
            return TradingPhase.Public;
        }

        if (block.timestamp < proConfig.tradingStartTime) {
            return TradingPhase.NotStarted;
        }

        if (proConfig.whitelistEnabled && block.timestamp < proConfig.publicStartTime) {
            return TradingPhase.Whitelist;
        }

        return TradingPhase.Public;
    }

    /**
     * @notice Check if an address can trade
     * @param account Address to check
     */
    function canTrade(address account) public view returns (bool) {
        // Bonding curve and factory can always interact
        if (account == bondingCurve || account == factory) {
            return true;
        }

        // Check blacklist first (Pro mode only)
        if (launchMode == LaunchMode.Pro && proConfig.blacklistEnabled) {
            if (blacklist[account]) {
                return false;
            }
        }

        TradingPhase phase = getCurrentPhase();

        if (phase == TradingPhase.NotStarted) {
            return false;
        }

        if (phase == TradingPhase.Whitelist) {
            return whitelist[account];
        }

        // Public phase
        return true;
    }

    // ============ Whitelist Management (Creator Only) ============

    /**
     * @notice Add address to whitelist
     * @param account Address to whitelist
     */
    function addToWhitelist(address account) external onlyCreator {
        if (launchMode != LaunchMode.Pro) revert LaunchpadErrors.InvalidInput();
        if (account == address(0)) revert LaunchpadErrors.ZeroAddress();
        if (whitelist[account]) return;

        whitelist[account] = true;
        whitelistCount++;

        emit AddedToWhitelist(account);
    }

    /**
     * @notice Add multiple addresses to whitelist
     * @param accounts Addresses to whitelist
     */
    function addToWhitelistBatch(address[] calldata accounts) external onlyCreator {
        if (launchMode != LaunchMode.Pro) revert LaunchpadErrors.InvalidInput();

        for (uint256 i = 0; i < accounts.length; i++) {
            if (accounts[i] != address(0) && !whitelist[accounts[i]]) {
                whitelist[accounts[i]] = true;
                whitelistCount++;
            }
        }

        emit WhitelistBatchAdded(accounts);
    }

    /**
     * @notice Remove address from whitelist
     * @param account Address to remove
     */
    function removeFromWhitelist(address account) external onlyCreator {
        if (launchMode != LaunchMode.Pro) revert LaunchpadErrors.InvalidInput();
        if (!whitelist[account]) return;
        if (account == creator) revert LaunchpadErrors.InvalidInput(); // Can't remove creator

        whitelist[account] = false;
        whitelistCount--;

        emit RemovedFromWhitelist(account);
    }

    // ============ Blacklist Management (Creator Only) ============

    /**
     * @notice Add address to blacklist
     * @param account Address to blacklist
     */
    function addToBlacklist(address account) external onlyCreator {
        if (launchMode != LaunchMode.Pro) revert LaunchpadErrors.InvalidInput();
        if (account == address(0)) revert LaunchpadErrors.ZeroAddress();
        if (account == creator) revert LaunchpadErrors.InvalidInput(); // Can't blacklist creator
        if (account == bondingCurve || account == factory) revert LaunchpadErrors.InvalidInput();

        blacklist[account] = true;

        emit AddedToBlacklist(account);
    }

    /**
     * @notice Add multiple addresses to blacklist
     * @param accounts Addresses to blacklist
     */
    function addToBlacklistBatch(address[] calldata accounts) external onlyCreator {
        if (launchMode != LaunchMode.Pro) revert LaunchpadErrors.InvalidInput();

        for (uint256 i = 0; i < accounts.length; i++) {
            address account = accounts[i];
            if (account != address(0) &&
                account != creator &&
                account != bondingCurve &&
                account != factory) {
                blacklist[account] = true;
                emit AddedToBlacklist(account);
            }
        }
    }

    /**
     * @notice Remove address from blacklist
     * @param account Address to remove
     */
    function removeFromBlacklist(address account) external onlyCreator {
        if (launchMode != LaunchMode.Pro) revert LaunchpadErrors.InvalidInput();

        blacklist[account] = false;

        emit RemovedFromBlacklist(account);
    }

    // ============ Transfer Override ============

    /**
     * @notice Override transfer to enforce trading rules
     */
    function _update(
        address from,
        address to,
        uint256 amount
    ) internal virtual override {
        // Allow minting and burning without restrictions
        if (from != address(0) && to != address(0)) {
            // Check if sender can trade
            if (!canTrade(from)) {
                revert LaunchpadErrors.TradingDisabled();
            }

            // Check if receiver can trade (unless it's the bonding curve)
            if (to != bondingCurve && !canTrade(to)) {
                revert LaunchpadErrors.TradingDisabled();
            }
        }

        super._update(from, to, amount);
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

        // Check trading is allowed for recipient
        if (!canTrade(to)) {
            revert LaunchpadErrors.TradingDisabled();
        }

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

        // Check trading is allowed for seller
        if (!canTrade(from)) {
            revert LaunchpadErrors.TradingDisabled();
        }

        _burn(from, amount);
    }

    // ============ Graduation ============

    /**
     * @notice Graduate the token to DEX
     * @dev Called by factory during graduation process
     */
    function graduate() external onlyFactory notGraduated {
        isGraduated = true;
        graduatedAt = block.timestamp;

        // After graduation, trading is fully public
        // (whitelist/blacklist still applies until creator disables)

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
    function updateMetadata(string calldata description_, string calldata imageURI_) external onlyCreator {
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

    /**
     * @notice Get time until public trading starts
     */
    function timeUntilPublic() external view returns (uint256) {
        if (launchMode == LaunchMode.Easy) return 0;
        if (block.timestamp >= proConfig.publicStartTime) return 0;
        return proConfig.publicStartTime - block.timestamp;
    }

    /**
     * @notice Get time until trading starts
     */
    function timeUntilTrading() external view returns (uint256) {
        if (launchMode == LaunchMode.Easy) return 0;
        if (block.timestamp >= proConfig.tradingStartTime) return 0;
        return proConfig.tradingStartTime - block.timestamp;
    }

    /**
     * @notice Check if address is whitelisted
     */
    function isWhitelisted(address account) external view returns (bool) {
        return whitelist[account];
    }

    /**
     * @notice Check if address is blacklisted
     */
    function isBlacklisted(address account) external view returns (bool) {
        return blacklist[account];
    }

    /**
     * @notice Get launch mode
     */
    function isProLaunch() external view returns (bool) {
        return launchMode == LaunchMode.Pro;
    }
}
