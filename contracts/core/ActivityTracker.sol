// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

import {LaunchpadErrors} from "../libraries/LaunchpadErrors.sol";

/**
 * @title ActivityTracker
 * @notice Tracks all platform activity for the live feed display
 * @dev Emits events for frontend to display real-time activity
 *
 * Tracked Activities:
 * - Token launches
 * - Buy/Sell trades
 * - Token graduations
 * - Large trades (whale alerts)
 * - New creator registrations
 */
contract ActivityTracker is Ownable {
    // ============ Enums ============

    enum ActivityType {
        TokenLaunched,
        TokenBought,
        TokenSold,
        TokenGraduated,
        WhaleBuy,
        WhaleSell,
        CreatorRegistered
    }

    // ============ Structs ============

    struct Activity {
        ActivityType activityType;
        address token;
        address user;
        uint256 avaxAmount;
        uint256 tokenAmount;
        uint256 timestamp;
        string tokenSymbol;
        string tokenName;
        string userHandle;   // Creator handle if available
    }

    // ============ State Variables ============

    // Authorized trackers (Factory, Router, CreatorRegistry)
    mapping(address => bool) public authorizedTrackers;

    // Recent activities (circular buffer)
    Activity[] public activities;
    uint256 public constant MAX_ACTIVITIES = 1000;
    uint256 public activityIndex;

    // Whale threshold (trades above this are marked as whale trades)
    uint256 public whaleThresholdAvax = 10 ether;
    uint256 public whaleThresholdBps = 100; // 1% of supply

    // Stats
    uint256 public totalTokensLaunched;
    uint256 public totalTokensGraduated;
    uint256 public totalTrades;
    uint256 public totalVolumeAvax;

    // Token-specific stats
    mapping(address => uint256) public tokenTradeCount;
    mapping(address => uint256) public tokenVolumeAvax;

    // ============ Events ============

    // Main activity event for frontend subscription
    event ActivityRecorded(
        ActivityType indexed activityType,
        address indexed token,
        address indexed user,
        uint256 avaxAmount,
        uint256 tokenAmount,
        uint256 timestamp,
        string tokenSymbol,
        string userHandle
    );

    // Specific events for filtering
    event TokenLaunchedActivity(
        address indexed token,
        address indexed creator,
        string name,
        string symbol,
        string creatorHandle
    );

    event TradeActivity(
        address indexed token,
        address indexed trader,
        bool isBuy,
        uint256 avaxAmount,
        uint256 tokenAmount,
        uint256 newPrice
    );

    event GraduationActivity(
        address indexed token,
        address indexed pair,
        uint256 liquidityAvax,
        uint256 liquidityTokens
    );

    event WhaleActivity(
        address indexed token,
        address indexed trader,
        bool isBuy,
        uint256 avaxAmount,
        uint256 tokenAmount,
        uint256 percentageOfSupply
    );

    // ============ Modifiers ============

    modifier onlyAuthorized() {
        if (!authorizedTrackers[msg.sender] && msg.sender != owner()) {
            revert LaunchpadErrors.Unauthorized();
        }
        _;
    }

    // ============ Constructor ============

    constructor() Ownable(msg.sender) {}

    // ============ Configuration ============

    /**
     * @notice Authorize a tracker (Factory, Router, etc.)
     * @param tracker Address to authorize
     * @param status Authorization status
     */
    function setAuthorizedTracker(address tracker, bool status) external onlyOwner {
        if (tracker == address(0)) revert LaunchpadErrors.ZeroAddress();
        authorizedTrackers[tracker] = status;
    }

    /**
     * @notice Update whale thresholds
     * @param avaxThreshold AVAX amount threshold
     * @param bpsThreshold Percentage of supply threshold
     */
    function setWhaleThresholds(uint256 avaxThreshold, uint256 bpsThreshold) external onlyOwner {
        whaleThresholdAvax = avaxThreshold;
        whaleThresholdBps = bpsThreshold;
    }

    // ============ Activity Recording ============

    /**
     * @notice Record a token launch
     */
    function recordTokenLaunch(
        address token,
        address creator,
        string calldata name,
        string calldata symbol,
        string calldata creatorHandle
    ) external onlyAuthorized {
        totalTokensLaunched++;

        _recordActivity(Activity({
            activityType: ActivityType.TokenLaunched,
            token: token,
            user: creator,
            avaxAmount: 0,
            tokenAmount: 0,
            timestamp: block.timestamp,
            tokenSymbol: symbol,
            tokenName: name,
            userHandle: creatorHandle
        }));

        emit TokenLaunchedActivity(token, creator, name, symbol, creatorHandle);
    }

    /**
     * @notice Record a trade (buy or sell)
     */
    function recordTrade(
        address token,
        address trader,
        bool isBuy,
        uint256 avaxAmount,
        uint256 tokenAmount,
        uint256 newPrice,
        uint256 totalSupply,
        string calldata tokenSymbol,
        string calldata traderHandle
    ) external onlyAuthorized {
        totalTrades++;
        totalVolumeAvax += avaxAmount;
        tokenTradeCount[token]++;
        tokenVolumeAvax[token] += avaxAmount;

        ActivityType activityType = isBuy ? ActivityType.TokenBought : ActivityType.TokenSold;

        // Check if this is a whale trade
        bool isWhale = _isWhaleTrade(avaxAmount, tokenAmount, totalSupply);
        if (isWhale) {
            activityType = isBuy ? ActivityType.WhaleBuy : ActivityType.WhaleSell;

            uint256 percentageOfSupply = (tokenAmount * 10000) / totalSupply;
            emit WhaleActivity(token, trader, isBuy, avaxAmount, tokenAmount, percentageOfSupply);
        }

        _recordActivity(Activity({
            activityType: activityType,
            token: token,
            user: trader,
            avaxAmount: avaxAmount,
            tokenAmount: tokenAmount,
            timestamp: block.timestamp,
            tokenSymbol: tokenSymbol,
            tokenName: "",
            userHandle: traderHandle
        }));

        emit TradeActivity(token, trader, isBuy, avaxAmount, tokenAmount, newPrice);
    }

    /**
     * @notice Record a token graduation
     */
    function recordGraduation(
        address token,
        address pair,
        uint256 liquidityAvax,
        uint256 liquidityTokens,
        string calldata tokenSymbol
    ) external onlyAuthorized {
        totalTokensGraduated++;

        _recordActivity(Activity({
            activityType: ActivityType.TokenGraduated,
            token: token,
            user: pair,
            avaxAmount: liquidityAvax,
            tokenAmount: liquidityTokens,
            timestamp: block.timestamp,
            tokenSymbol: tokenSymbol,
            tokenName: "",
            userHandle: ""
        }));

        emit GraduationActivity(token, pair, liquidityAvax, liquidityTokens);
    }

    /**
     * @notice Record a new creator registration
     */
    function recordCreatorRegistration(
        address creator,
        string calldata handle
    ) external onlyAuthorized {
        _recordActivity(Activity({
            activityType: ActivityType.CreatorRegistered,
            token: address(0),
            user: creator,
            avaxAmount: 0,
            tokenAmount: 0,
            timestamp: block.timestamp,
            tokenSymbol: "",
            tokenName: "",
            userHandle: handle
        }));
    }

    /**
     * @notice Internal function to record activity
     */
    function _recordActivity(Activity memory activity) internal {
        if (activities.length < MAX_ACTIVITIES) {
            activities.push(activity);
        } else {
            activities[activityIndex] = activity;
        }

        activityIndex = (activityIndex + 1) % MAX_ACTIVITIES;

        emit ActivityRecorded(
            activity.activityType,
            activity.token,
            activity.user,
            activity.avaxAmount,
            activity.tokenAmount,
            activity.timestamp,
            activity.tokenSymbol,
            activity.userHandle
        );
    }

    /**
     * @notice Check if trade qualifies as whale trade
     */
    function _isWhaleTrade(
        uint256 avaxAmount,
        uint256 tokenAmount,
        uint256 totalSupply
    ) internal view returns (bool) {
        // Check AVAX threshold
        if (avaxAmount >= whaleThresholdAvax) {
            return true;
        }

        // Check percentage of supply threshold
        if (totalSupply > 0) {
            uint256 percentageBps = (tokenAmount * 10000) / totalSupply;
            if (percentageBps >= whaleThresholdBps) {
                return true;
            }
        }

        return false;
    }

    // ============ View Functions ============

    /**
     * @notice Get recent activities
     * @param count Number of activities to return
     */
    function getRecentActivities(uint256 count) external view returns (Activity[] memory) {
        uint256 totalActivities = activities.length;
        if (count > totalActivities) {
            count = totalActivities;
        }

        Activity[] memory recent = new Activity[](count);

        for (uint256 i = 0; i < count; i++) {
            uint256 index;
            if (totalActivities < MAX_ACTIVITIES) {
                // Buffer not full yet, read from end
                index = totalActivities - 1 - i;
            } else {
                // Circular buffer, read backwards from current index
                index = (activityIndex + MAX_ACTIVITIES - 1 - i) % MAX_ACTIVITIES;
            }
            recent[i] = activities[index];
        }

        return recent;
    }

    /**
     * @notice Get activities for a specific token
     * @param token Token address
     * @param count Max activities to return
     */
    function getTokenActivities(address token, uint256 count) external view returns (Activity[] memory) {
        // First pass: count matching activities
        uint256 matchCount = 0;
        for (uint256 i = 0; i < activities.length && matchCount < count; i++) {
            if (activities[i].token == token) {
                matchCount++;
            }
        }

        // Second pass: collect matching activities
        Activity[] memory tokenActivities = new Activity[](matchCount);
        uint256 index = 0;

        for (uint256 i = activities.length; i > 0 && index < matchCount; i--) {
            if (activities[i - 1].token == token) {
                tokenActivities[index++] = activities[i - 1];
            }
        }

        return tokenActivities;
    }

    /**
     * @notice Get platform statistics
     */
    function getStats() external view returns (
        uint256 tokensLaunched,
        uint256 tokensGraduated,
        uint256 trades,
        uint256 volumeAvax
    ) {
        return (
            totalTokensLaunched,
            totalTokensGraduated,
            totalTrades,
            totalVolumeAvax
        );
    }

    /**
     * @notice Get token statistics
     */
    function getTokenStats(address token) external view returns (
        uint256 tradeCount,
        uint256 volumeAvax
    ) {
        return (
            tokenTradeCount[token],
            tokenVolumeAvax[token]
        );
    }

    /**
     * @notice Get total activity count
     */
    function getActivityCount() external view returns (uint256) {
        return activities.length;
    }
}
