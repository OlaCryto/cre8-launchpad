// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {LaunchpadErrors} from "../libraries/LaunchpadErrors.sol";

/**
 * @title PresaleVault
 * @notice Accepts AVAX contributions during presale, then buys on bonding curve for contributors
 * @dev One vault per Forge Mode token. Created by LaunchManager.
 *
 * Flow:
 * 1. Creator sets presale params (max per wallet, duration)
 * 2. Vault opens — contributors send AVAX
 * 3. Timer expires — vault closes
 * 4. LaunchManager deploys token + bonding curve
 * 5. LaunchManager calls finalize() — vault buys on curve, allocates tokens proportionally
 * 6. Contributors claim their tokens
 */
contract PresaleVault is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ============ Enums ============

    enum VaultState {
        Pending,    // Created but not yet open
        Open,       // Accepting contributions
        Closed,     // Time expired, no more contributions
        Finalized,  // Tokens bought on curve, ready for claims
        Cancelled   // Presale cancelled, refunds available
    }

    // ============ Structs ============

    struct PresaleConfig {
        uint256 maxPerWallet;       // Max AVAX per contributor
        uint256 duration;           // Presale duration in seconds
        uint256 startTime;          // When presale opens
        uint256 endTime;            // When presale closes
        address creator;            // Creator who set up this presale
        uint256 hardCap;            // Maximum total AVAX to raise (required, > 0)
        uint256 softCap;            // Minimum for success (0 = no soft cap)
    }

    struct ContributorInfo {
        uint256 contributed;        // AVAX contributed
        uint256 tokenAllocation;    // Tokens allocated after finalize
        bool claimed;               // Whether tokens have been claimed
        bool refunded;              // Whether AVAX has been refunded (if cancelled)
    }

    // ============ Events ============

    event PresaleOpened(address indexed creator, uint256 maxPerWallet, uint256 duration, uint256 endTime);
    event Contributed(address indexed contributor, uint256 amount, uint256 totalRaised);
    event PresaleClosed(uint256 totalRaised, uint256 totalContributors);
    event PresaleFinalized(address indexed token, uint256 totalTokens, uint256 totalAvaxUsed);
    event TokensClaimed(address indexed contributor, uint256 tokenAmount);
    event Refunded(address indexed contributor, uint256 amount);
    event PresaleCancelled(address indexed creator);

    // ============ State Variables ============

    VaultState public state;
    PresaleConfig public config;

    // Contribution tracking
    mapping(address => ContributorInfo) public contributors;
    address[] public contributorList;
    uint256 public totalRaised;
    uint256 public totalContributors;

    // Token tracking (set after finalize)
    address public token;
    uint256 public totalTokensBought;

    // Authorization
    address public launchManager;

    // ============ Modifiers ============

    modifier onlyLaunchManager() {
        if (msg.sender != launchManager) revert LaunchpadErrors.Unauthorized();
        _;
    }

    modifier onlyCreator() {
        if (msg.sender != config.creator) revert LaunchpadErrors.Unauthorized();
        _;
    }

    modifier inState(VaultState expectedState) {
        if (state != expectedState) revert LaunchpadErrors.InvalidInput();
        _;
    }

    // ============ Constructor ============

    constructor(
        address creator_,
        uint256 maxPerWallet_,
        uint256 duration_,
        address launchManager_,
        uint256 hardCap_,
        uint256 softCap_
    ) {
        if (creator_ == address(0)) revert LaunchpadErrors.ZeroAddress();
        if (launchManager_ == address(0)) revert LaunchpadErrors.ZeroAddress();
        if (maxPerWallet_ == 0) revert LaunchpadErrors.ZeroAmount();
        if (duration_ == 0) revert LaunchpadErrors.InvalidInput();
        if (hardCap_ == 0) revert LaunchpadErrors.ZeroAmount();
        if (softCap_ > hardCap_) revert LaunchpadErrors.InvalidInput();

        config = PresaleConfig({
            maxPerWallet: maxPerWallet_,
            duration: duration_,
            startTime: block.timestamp,
            endTime: block.timestamp + duration_,
            creator: creator_,
            hardCap: hardCap_,
            softCap: softCap_
        });

        launchManager = launchManager_;
        state = VaultState.Open;

        emit PresaleOpened(creator_, maxPerWallet_, duration_, block.timestamp + duration_);
    }

    // ============ Contribution ============

    /**
     * @notice Contribute AVAX to the presale
     */
    function contribute() external payable nonReentrant inState(VaultState.Open) {
        if (block.timestamp >= config.endTime) {
            // Auto-close if time expired
            state = VaultState.Closed;
            emit PresaleClosed(totalRaised, totalContributors);
            revert LaunchpadErrors.InvalidInput();
        }

        if (msg.value == 0) revert LaunchpadErrors.ZeroAmount();

        ContributorInfo storage info = contributors[msg.sender];
        uint256 newTotal = info.contributed + msg.value;

        if (newTotal > config.maxPerWallet) revert LaunchpadErrors.MaxTransactionExceeded();

        // Hard cap enforcement
        if (totalRaised + msg.value > config.hardCap) revert LaunchpadErrors.MaxSupplyReached();

        // Track new contributor
        if (info.contributed == 0) {
            contributorList.push(msg.sender);
            totalContributors++;
        }

        info.contributed = newTotal;
        totalRaised += msg.value;

        // Auto-close if hard cap reached
        if (totalRaised >= config.hardCap) {
            state = VaultState.Closed;
            emit PresaleClosed(totalRaised, totalContributors);
        }

        emit Contributed(msg.sender, msg.value, totalRaised);
    }

    // ============ Close ============

    /**
     * @notice Close the presale (can be called by anyone after time expires, or by creator/manager early)
     */
    function close() external {
        if (state != VaultState.Open) revert LaunchpadErrors.InvalidInput();

        if (block.timestamp >= config.endTime) {
            // Anyone can close after time expires
        } else if (msg.sender == config.creator || msg.sender == launchManager) {
            // Creator or manager can close early
        } else {
            revert LaunchpadErrors.Unauthorized();
        }

        // If soft cap exists and not met, auto-cancel instead of closing
        if (config.softCap > 0 && totalRaised < config.softCap) {
            state = VaultState.Cancelled;
            emit PresaleCancelled(config.creator);
            return;
        }

        state = VaultState.Closed;
        emit PresaleClosed(totalRaised, totalContributors);
    }

    // ============ Withdraw & Finalize (called by LaunchManager) ============

    /**
     * @notice Withdraw all AVAX to LaunchManager for bonding curve purchase
     * @dev Only callable by LaunchManager after vault is closed
     */
    function withdrawForLaunch()
        external
        onlyLaunchManager
        inState(VaultState.Closed)
        returns (uint256 amount)
    {
        amount = address(this).balance;
        if (amount > 0) {
            (bool success,) = launchManager.call{value: amount}("");
            if (!success) revert LaunchpadErrors.FeeTransferFailed();
        }
        return amount;
    }

    /**
     * @notice Finalize the presale after tokens are bought on the bonding curve
     * @param token_ The token address
     * @param totalTokens_ Total tokens bought for all contributors
     * @dev LaunchManager buys tokens on the curve, sends them here, then calls finalize
     */
    function finalize(address token_, uint256 totalTokens_)
        external
        onlyLaunchManager
        inState(VaultState.Closed)
    {
        if (token_ == address(0)) revert LaunchpadErrors.ZeroAddress();
        if (totalTokens_ == 0) revert LaunchpadErrors.ZeroAmount();

        token = token_;
        totalTokensBought = totalTokens_;

        // Calculate each contributor's token allocation proportionally
        for (uint256 i = 0; i < contributorList.length; i++) {
            address contributor = contributorList[i];
            ContributorInfo storage info = contributors[contributor];

            // proportional allocation: (contributed / totalRaised) * totalTokens
            info.tokenAllocation = (info.contributed * totalTokens_) / totalRaised;
        }

        state = VaultState.Finalized;

        emit PresaleFinalized(token_, totalTokens_, totalRaised);
    }

    // ============ Claim ============

    /**
     * @notice Claim allocated tokens after finalization
     */
    function claim() external nonReentrant inState(VaultState.Finalized) {
        ContributorInfo storage info = contributors[msg.sender];

        if (info.contributed == 0) revert LaunchpadErrors.InvalidInput();
        if (info.claimed) revert LaunchpadErrors.AlreadyInitialized();
        if (info.tokenAllocation == 0) revert LaunchpadErrors.ZeroAmount();

        info.claimed = true;

        IERC20(token).safeTransfer(msg.sender, info.tokenAllocation);

        emit TokensClaimed(msg.sender, info.tokenAllocation);
    }

    // ============ Cancel & Refund ============

    /**
     * @notice Cancel the presale (only before finalization)
     */
    function cancel() external {
        if (state == VaultState.Finalized) revert LaunchpadErrors.InvalidInput();

        if (msg.sender != config.creator && msg.sender != launchManager) {
            revert LaunchpadErrors.Unauthorized();
        }

        state = VaultState.Cancelled;
        emit PresaleCancelled(config.creator);
    }

    /**
     * @notice Refund AVAX if presale was cancelled
     */
    function refund() external nonReentrant inState(VaultState.Cancelled) {
        ContributorInfo storage info = contributors[msg.sender];

        if (info.contributed == 0) revert LaunchpadErrors.InvalidInput();
        if (info.refunded) revert LaunchpadErrors.AlreadyInitialized();

        info.refunded = true;
        uint256 amount = info.contributed;

        (bool success,) = msg.sender.call{value: amount}("");
        if (!success) revert LaunchpadErrors.FeeTransferFailed();

        emit Refunded(msg.sender, amount);
    }

    // ============ View Functions ============

    /**
     * @notice Get time remaining in presale
     */
    function timeRemaining() external view returns (uint256) {
        if (state != VaultState.Open) return 0;
        if (block.timestamp >= config.endTime) return 0;
        return config.endTime - block.timestamp;
    }

    /**
     * @notice Get contributor info
     */
    function getContributor(address contributor) external view returns (ContributorInfo memory) {
        return contributors[contributor];
    }

    /**
     * @notice Get all contributors (paginated)
     */
    function getContributors(uint256 offset, uint256 limit)
        external
        view
        returns (address[] memory addresses, uint256[] memory amounts)
    {
        uint256 total = contributorList.length;
        if (offset >= total) return (new address[](0), new uint256[](0));

        uint256 end = offset + limit;
        if (end > total) end = total;
        uint256 count = end - offset;

        addresses = new address[](count);
        amounts = new uint256[](count);

        for (uint256 i = 0; i < count; i++) {
            address addr = contributorList[offset + i];
            addresses[i] = addr;
            amounts[i] = contributors[addr].contributed;
        }
    }

    /**
     * @notice Check remaining contribution room for a wallet
     */
    function remainingAllowance(address contributor) external view returns (uint256) {
        uint256 contributed = contributors[contributor].contributed;
        if (contributed >= config.maxPerWallet) return 0;
        return config.maxPerWallet - contributed;
    }

    /**
     * @notice Whether the presale time has expired
     */
    function isExpired() external view returns (bool) {
        return block.timestamp >= config.endTime;
    }

    /**
     * @notice Remaining AVAX until hard cap is reached
     */
    function remainingHardCap() external view returns (uint256) {
        if (totalRaised >= config.hardCap) return 0;
        return config.hardCap - totalRaised;
    }

    // ============ Receive ============

    receive() external payable {
        // Accept AVAX for finalization operations
    }
}
