// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {LaunchpadFactory} from "../core/LaunchpadFactory.sol";
import {BondingCurve} from "../core/BondingCurve.sol";
import {CreatorRegistry} from "../core/CreatorRegistry.sol";
import {LaunchpadErrors} from "../libraries/LaunchpadErrors.sol";
import {Pausable} from "../security/Pausable.sol";
import {PresaleVault} from "./PresaleVault.sol";
import {VestingContract} from "./VestingContract.sol";

/**
 * @title LaunchManager
 * @notice Orchestrates the Forge Mode token launch flow
 * @dev Manages the lifecycle: Registration → Options → Launch → Trading → Graduation
 *
 * Forge Mode Flow:
 * 1. Creator registers profile (via CreatorRegistry — already exists)
 * 2. Creator calls createForgeLaunch() with token params + optional features
 * 3. If presale enabled: PresaleVault is deployed, accepts contributions
 * 4. After presale closes: executeLaunch() deploys token + bonding curve
 * 5. If presale: vault AVAX buys on curve, tokens allocated to contributors
 * 6. If whitelist: whitelist window enforced before public trading
 * 7. If vesting: team tokens locked in VestingContract
 * 8. Bonding curve graduation → DEX (same as Trenches)
 */
contract LaunchManager is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // ============ Enums ============

    enum LaunchPhase {
        Presale,        // Presale vault is open
        PresaleClosed,  // Presale closed, waiting to launch
        WhitelistOnly,  // Token live, whitelist window active
        Public,         // Fully public trading
        Graduated       // Token graduated to DEX
    }

    // ============ Structs ============

    struct ForgeConfig {
        // Token info
        string name;
        string symbol;
        string description;
        string imageURI;
        string twitter;
        string telegram;
        string website;

        // Optional features (toggles)
        bool presaleEnabled;
        bool whitelistEnabled;
        bool vestingEnabled;

        // Presale config (if enabled)
        uint256 presaleMaxPerWallet;    // Max AVAX per contributor
        uint256 presaleDuration;        // Presale duration in seconds

        // Whitelist config (if enabled)
        address[] whitelist;            // Whitelisted addresses
        uint256 whitelistDuration;      // Whitelist window in seconds

        // Vesting config (if enabled)
        uint256 vestingTeamBps;         // Team allocation in basis points (max 2000 = 20%)
        uint256 vestingCliff;           // Cliff duration in seconds
        uint256 vestingDuration;        // Vesting period in seconds
    }

    struct ForgeLaunch {
        address creator;
        address token;
        address bondingCurve;
        address presaleVault;       // address(0) if no presale
        address vestingContract;    // address(0) if no vesting
        LaunchPhase phase;
        ForgeConfig config;
        uint256 createdAt;
        uint256 launchedAt;         // When token went live on curve
        uint256 whitelistEndTime;   // When whitelist window expires
        uint256 creationFee;        // AVAX held for deferred token creation
    }

    // ============ Events ============

    event ForgeLaunchCreated(
        uint256 indexed launchId,
        address indexed creator,
        string name,
        string symbol,
        bool presaleEnabled,
        bool whitelistEnabled,
        bool vestingEnabled
    );
    event PresaleStarted(uint256 indexed launchId, address indexed vault, uint256 endTime);
    event LaunchExecuted(uint256 indexed launchId, address indexed token, address indexed bondingCurve);
    event WhitelistPhaseStarted(uint256 indexed launchId, uint256 endTime);
    event PublicPhaseStarted(uint256 indexed launchId);
    event VestingCreated(uint256 indexed launchId, address indexed vestingContract, uint256 amount);

    // ============ Constants ============

    uint256 public constant MAX_TEAM_BPS = 2000;        // Max 20% team allocation
    uint256 public constant MIN_PRESALE_DURATION = 1 hours;
    uint256 public constant MAX_PRESALE_DURATION = 7 days;
    uint256 public constant MIN_WHITELIST_DURATION = 5 minutes;
    uint256 public constant MAX_WHITELIST_DURATION = 24 hours;
    uint256 public constant BPS_DENOMINATOR = 10000;

    // ============ State Variables ============

    LaunchpadFactory public factory;
    CreatorRegistry public creatorRegistry;

    // Launch tracking
    mapping(uint256 => ForgeLaunch) public launches;
    uint256 public nextLaunchId;

    // Creator → launch IDs
    mapping(address => uint256[]) public creatorLaunches;

    // Token → launch ID (for lookups)
    mapping(address => uint256) public tokenToLaunchId;

    // Vault → launch ID
    mapping(address => uint256) public vaultToLaunchId;

    // ============ Constructor ============

    constructor(address factory_, address creatorRegistry_) {
        if (factory_ == address(0)) revert LaunchpadErrors.ZeroAddress();
        if (creatorRegistry_ == address(0)) revert LaunchpadErrors.ZeroAddress();

        factory = LaunchpadFactory(payable(factory_));
        creatorRegistry = CreatorRegistry(creatorRegistry_);
    }

    // ============ Configuration ============

    function setFactory(address factory_) external onlyOwner {
        if (factory_ == address(0)) revert LaunchpadErrors.ZeroAddress();
        factory = LaunchpadFactory(payable(factory_));
    }

    function setCreatorRegistry(address registry_) external onlyOwner {
        if (registry_ == address(0)) revert LaunchpadErrors.ZeroAddress();
        creatorRegistry = CreatorRegistry(registry_);
    }

    // ============ Create Forge Launch ============

    /**
     * @notice Create a new Forge Mode launch
     * @param config_ Full launch configuration
     * @return launchId The ID of the new launch
     */
    function createForgeLaunch(ForgeConfig calldata config_)
        external
        payable
        nonReentrant
        whenNotPaused
        returns (uint256 launchId)
    {
        // Creator must have a profile
        if (!creatorRegistry.hasProfile(msg.sender)) {
            revert LaunchpadErrors.Unauthorized();
        }

        // Validate token info
        if (bytes(config_.name).length == 0) revert LaunchpadErrors.InvalidTokenName();
        if (bytes(config_.symbol).length == 0) revert LaunchpadErrors.InvalidTokenSymbol();
        if (bytes(config_.name).length > 32) revert LaunchpadErrors.InvalidTokenName();
        if (bytes(config_.symbol).length > 10) revert LaunchpadErrors.InvalidTokenSymbol();

        // Validate optional features
        if (config_.presaleEnabled) {
            if (config_.presaleMaxPerWallet == 0) revert LaunchpadErrors.ZeroAmount();
            if (config_.presaleDuration < MIN_PRESALE_DURATION) revert LaunchpadErrors.InvalidInput();
            if (config_.presaleDuration > MAX_PRESALE_DURATION) revert LaunchpadErrors.InvalidInput();
        }

        if (config_.whitelistEnabled) {
            if (config_.whitelist.length == 0) revert LaunchpadErrors.InvalidInput();
            if (config_.whitelistDuration < MIN_WHITELIST_DURATION) revert LaunchpadErrors.InvalidInput();
            if (config_.whitelistDuration > MAX_WHITELIST_DURATION) revert LaunchpadErrors.InvalidInput();
        }

        if (config_.vestingEnabled) {
            if (config_.vestingTeamBps == 0 || config_.vestingTeamBps > MAX_TEAM_BPS) {
                revert LaunchpadErrors.InvalidInput();
            }
            if (config_.vestingDuration == 0) revert LaunchpadErrors.InvalidInput();
        }

        launchId = nextLaunchId++;

        // Create the launch record
        ForgeLaunch storage launch = launches[launchId];
        launch.creator = msg.sender;
        launch.config = config_;
        launch.createdAt = block.timestamp;

        creatorLaunches[msg.sender].push(launchId);

        // If presale enabled, deploy a vault and hold the creation fee
        if (config_.presaleEnabled) {
            PresaleVault vault = new PresaleVault(
                msg.sender,
                config_.presaleMaxPerWallet,
                config_.presaleDuration,
                address(this)
            );

            launch.presaleVault = address(vault);
            launch.phase = LaunchPhase.Presale;
            launch.creationFee = msg.value; // Hold fee for deferred launch

            vaultToLaunchId[address(vault)] = launchId;

            emit PresaleStarted(launchId, address(vault), block.timestamp + config_.presaleDuration);
        } else {
            // No presale — launch immediately
            _executeLaunch(launchId, msg.value);
        }

        emit ForgeLaunchCreated(
            launchId,
            msg.sender,
            config_.name,
            config_.symbol,
            config_.presaleEnabled,
            config_.whitelistEnabled,
            config_.vestingEnabled
        );

        return launchId;
    }

    // ============ Execute Launch ============

    /**
     * @notice Execute the token launch after presale closes
     * @param launchId Launch ID to execute
     */
    function executeLaunch(uint256 launchId) external nonReentrant {
        ForgeLaunch storage launch = launches[launchId];

        if (launch.creator == address(0)) revert LaunchpadErrors.InvalidInput();

        // If presale was enabled, it must be closed
        if (launch.config.presaleEnabled) {
            if (launch.phase != LaunchPhase.Presale) revert LaunchpadErrors.InvalidInput();

            PresaleVault vault = PresaleVault(payable(launch.presaleVault));

            // Close vault if time expired but not yet closed
            if (vault.state() == PresaleVault.VaultState.Open) {
                vault.close();
            }

            if (vault.state() != PresaleVault.VaultState.Closed) {
                revert LaunchpadErrors.InvalidInput();
            }

            launch.phase = LaunchPhase.PresaleClosed;
        }

        // Use stored creation fee for presale launches
        _executeLaunch(launchId, launch.creationFee);
        launch.creationFee = 0; // Clear stored fee
    }

    /**
     * @notice Internal launch execution
     * @param creationFee AVAX to send as creation fee
     */
    function _executeLaunch(uint256 launchId, uint256 creationFee) internal {
        ForgeLaunch storage launch = launches[launchId];

        // Build factory params
        LaunchpadFactory.LaunchParams memory params = LaunchpadFactory.LaunchParams({
            name: launch.config.name,
            symbol: launch.config.symbol,
            description: launch.config.description,
            imageURI: launch.config.imageURI,
            twitter: launch.config.twitter,
            telegram: launch.config.telegram,
            website: launch.config.website
        });

        // Deploy token + bonding curve via factory
        (address token, address bondingCurve) = factory.createTokenFor{value: creationFee}(
            params,
            launch.creator
        );

        launch.token = token;
        launch.bondingCurve = bondingCurve;
        launch.launchedAt = block.timestamp;

        tokenToLaunchId[token] = launchId;

        // Whitelist this contract on the curve so presale bulk buy bypasses anti-bot
        BondingCurve(payable(bondingCurve)).setWhitelisted(address(this), true);

        // Handle presale: buy on curve with presale AVAX
        if (launch.config.presaleEnabled && launch.presaleVault != address(0)) {
            _handlePresaleBuy(launchId);
        }

        // Handle vesting: lock team tokens
        if (launch.config.vestingEnabled) {
            _handleVesting(launchId);
        }

        // Handle whitelist: set up whitelist window
        if (launch.config.whitelistEnabled) {
            _handleWhitelist(launchId);
        } else {
            launch.phase = LaunchPhase.Public;
            emit PublicPhaseStarted(launchId);
        }

        emit LaunchExecuted(launchId, token, bondingCurve);
    }

    /**
     * @notice Buy tokens on the bonding curve using presale AVAX
     */
    function _handlePresaleBuy(uint256 launchId) internal {
        ForgeLaunch storage launch = launches[launchId];
        PresaleVault vault = PresaleVault(payable(launch.presaleVault));

        uint256 totalAvax = vault.totalRaised();
        if (totalAvax == 0) return;

        // Withdraw AVAX from vault to this contract
        vault.withdrawForLaunch();

        // Buy tokens on the bonding curve with the presale AVAX
        BondingCurve curve = BondingCurve(payable(launch.bondingCurve));
        uint256 tokensOut = curve.buy{value: totalAvax}(0); // no slippage check for presale buy

        // Send tokens to vault for contributor claims
        IERC20(launch.token).safeTransfer(launch.presaleVault, tokensOut);

        // Finalize vault with token allocations
        vault.finalize(launch.token, tokensOut);
    }

    /**
     * @notice Lock team tokens in vesting contract
     */
    function _handleVesting(uint256 launchId) internal {
        ForgeLaunch storage launch = launches[launchId];

        // Calculate team token amount from bonding curve supply
        uint256 totalCurveSupply = 800_000_000 * 1e18; // BONDING_CURVE_SUPPLY
        uint256 teamTokens = (totalCurveSupply * launch.config.vestingTeamBps) / BPS_DENOMINATOR;

        // Buy team tokens on the curve (costs AVAX — creator must have sent enough)
        // Actually, team tokens should be a separate allocation that doesn't require buying
        // For now, we'll mint from the curve's perspective by doing a buy
        // Alternative: the team allocation comes from a pre-mint
        // For MVP: team tokens bought at curve price (fair to all participants)

        // Deploy vesting contract
        VestingContract vesting = new VestingContract(
            launch.creator,
            launch.token,
            teamTokens,
            launch.config.vestingCliff,
            launch.config.vestingDuration,
            address(this)
        );

        launch.vestingContract = address(vesting);

        // Note: In the MVP, the vesting contract is created but tokens need to be
        // separately purchased/allocated. The creator's initial buy can be directed to vesting.
        // For a complete implementation, the factory would need to support team allocations.

        emit VestingCreated(launchId, address(vesting), teamTokens);
    }

    /**
     * @notice Set up whitelist window on the bonding curve
     */
    function _handleWhitelist(uint256 launchId) internal {
        ForgeLaunch storage launch = launches[launchId];
        BondingCurve curve = BondingCurve(payable(launch.bondingCurve));

        // Whitelist addresses on the bonding curve's anti-bot system
        for (uint256 i = 0; i < launch.config.whitelist.length; i++) {
            curve.setWhitelisted(launch.config.whitelist[i], true);
        }

        launch.whitelistEndTime = block.timestamp + launch.config.whitelistDuration;
        launch.phase = LaunchPhase.WhitelistOnly;

        emit WhitelistPhaseStarted(launchId, launch.whitelistEndTime);
    }

    // ============ Phase Transitions ============

    /**
     * @notice Transition from whitelist to public phase
     * @param launchId Launch to transition
     */
    function openPublicTrading(uint256 launchId) external {
        ForgeLaunch storage launch = launches[launchId];

        if (launch.phase != LaunchPhase.WhitelistOnly) revert LaunchpadErrors.InvalidInput();
        if (block.timestamp < launch.whitelistEndTime) {
            // Only creator or owner can open early
            if (msg.sender != launch.creator && msg.sender != owner()) {
                revert LaunchpadErrors.Unauthorized();
            }
        }

        launch.phase = LaunchPhase.Public;
        emit PublicPhaseStarted(launchId);
    }

    // ============ View Functions ============

    /**
     * @notice Get full launch info
     */
    function getLaunch(uint256 launchId) external view returns (
        address creator,
        address token,
        address bondingCurve,
        address presaleVault,
        address vestingContract,
        LaunchPhase phase,
        uint256 createdAt,
        uint256 launchedAt
    ) {
        ForgeLaunch storage launch = launches[launchId];
        return (
            launch.creator,
            launch.token,
            launch.bondingCurve,
            launch.presaleVault,
            launch.vestingContract,
            launch.phase,
            launch.createdAt,
            launch.launchedAt
        );
    }

    /**
     * @notice Get launch config
     */
    function getLaunchConfig(uint256 launchId) external view returns (
        string memory name,
        string memory symbol,
        bool presaleEnabled,
        bool whitelistEnabled,
        bool vestingEnabled
    ) {
        ForgeConfig storage config = launches[launchId].config;
        return (
            config.name,
            config.symbol,
            config.presaleEnabled,
            config.whitelistEnabled,
            config.vestingEnabled
        );
    }

    /**
     * @notice Get all launches by a creator
     */
    function getCreatorLaunches(address creator) external view returns (uint256[] memory) {
        return creatorLaunches[creator];
    }

    /**
     * @notice Get launch ID for a token
     */
    function getLaunchByToken(address token) external view returns (uint256) {
        return tokenToLaunchId[token];
    }

    /**
     * @notice Get total number of Forge launches
     */
    function getTotalLaunches() external view returns (uint256) {
        return nextLaunchId;
    }

    /**
     * @notice Check if a token was launched in Forge mode
     */
    function isForgeToken(address token) external view returns (bool) {
        uint256 launchId = tokenToLaunchId[token];
        return launches[launchId].token == token && token != address(0);
    }

    // ============ Admin ============

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // ============ Receive ============

    receive() external payable {
        // Accept AVAX for presale buy operations
    }
}
