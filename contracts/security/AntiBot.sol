// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {LaunchpadErrors} from "../libraries/LaunchpadErrors.sol";

/**
 * @title AntiBot
 * @notice Protection against bot trading and manipulation
 * @dev Implements cooldowns, transaction limits, and wallet limits
 */
abstract contract AntiBot {
    // ============ Structs ============

    struct AntiBotConfig {
        bool enabled;
        uint256 cooldownPeriod;      // Seconds between trades
        uint256 maxTxAmountBps;      // Max transaction as % of supply (BPS)
        uint256 maxWalletAmountBps;  // Max wallet holding as % of supply (BPS)
        uint256 launchProtectionTime; // Stricter limits for this period after launch
    }

    struct UserTradeInfo {
        uint256 lastTradeTime;
        uint256 totalBought;
        uint256 totalSold;
        bool isWhitelisted;
    }

    // ============ State ============

    AntiBotConfig public antiBotConfig;
    mapping(address => UserTradeInfo) public userTradeInfo;
    mapping(address => bool) public blacklisted;

    uint256 public launchTime;

    uint256 internal constant BPS_DENOMINATOR = 10000;

    // ============ Events ============

    event AntiBotConfigUpdated(
        bool enabled,
        uint256 cooldownPeriod,
        uint256 maxTxAmountBps,
        uint256 maxWalletAmountBps
    );

    event UserWhitelisted(address indexed user, bool status);
    event UserBlacklisted(address indexed user, bool status);

    // ============ Modifiers ============

    modifier antiBot(address user, uint256 amount, uint256 totalSupply, bool isBuy) {
        _checkAntiBot(user, amount, totalSupply, isBuy);
        _;
        _updateTradeInfo(user, amount, isBuy);
    }

    // ============ Internal Functions ============

    function _initAntiBot(AntiBotConfig memory config) internal {
        antiBotConfig = config;
        launchTime = block.timestamp;
    }

    function _checkAntiBot(
        address user,
        uint256 amount,
        uint256 totalSupply,
        bool isBuy
    ) internal view {
        if (!antiBotConfig.enabled) return;
        if (userTradeInfo[user].isWhitelisted) return;

        // Check blacklist
        if (blacklisted[user]) {
            revert LaunchpadErrors.BotDetected();
        }

        // Check cooldown
        if (antiBotConfig.cooldownPeriod > 0) {
            uint256 lastTrade = userTradeInfo[user].lastTradeTime;
            if (lastTrade > 0 && block.timestamp < lastTrade + antiBotConfig.cooldownPeriod) {
                revert LaunchpadErrors.CooldownActive();
            }
        }

        // Check max transaction amount
        if (antiBotConfig.maxTxAmountBps > 0) {
            uint256 maxTxAmount = (totalSupply * antiBotConfig.maxTxAmountBps) / BPS_DENOMINATOR;

            // Stricter limits during launch protection
            if (_isLaunchProtectionActive()) {
                maxTxAmount = maxTxAmount / 2; // 50% of normal limit
            }

            if (amount > maxTxAmount) {
                revert LaunchpadErrors.MaxTransactionExceeded();
            }
        }
    }

    function _checkMaxWallet(
        address user,
        uint256 currentBalance,
        uint256 incomingAmount,
        uint256 totalSupply
    ) internal view {
        if (!antiBotConfig.enabled) return;
        if (userTradeInfo[user].isWhitelisted) return;
        if (antiBotConfig.maxWalletAmountBps == 0) return;

        uint256 maxWalletAmount = (totalSupply * antiBotConfig.maxWalletAmountBps) / BPS_DENOMINATOR;

        if (currentBalance + incomingAmount > maxWalletAmount) {
            revert LaunchpadErrors.MaxWalletExceeded();
        }
    }

    function _updateTradeInfo(address user, uint256 amount, bool isBuy) internal {
        userTradeInfo[user].lastTradeTime = block.timestamp;

        if (isBuy) {
            userTradeInfo[user].totalBought += amount;
        } else {
            userTradeInfo[user].totalSold += amount;
        }
    }

    function _isLaunchProtectionActive() internal view returns (bool) {
        return block.timestamp < launchTime + antiBotConfig.launchProtectionTime;
    }

    function _setWhitelisted(address user, bool status) internal {
        userTradeInfo[user].isWhitelisted = status;
        emit UserWhitelisted(user, status);
    }

    function _setBlacklisted(address user, bool status) internal {
        blacklisted[user] = status;
        emit UserBlacklisted(user, status);
    }

    function _updateAntiBotConfig(AntiBotConfig memory config) internal {
        antiBotConfig = config;
        emit AntiBotConfigUpdated(
            config.enabled,
            config.cooldownPeriod,
            config.maxTxAmountBps,
            config.maxWalletAmountBps
        );
    }

    // ============ View Functions ============

    function getCooldownRemaining(address user) public view returns (uint256) {
        if (!antiBotConfig.enabled || antiBotConfig.cooldownPeriod == 0) return 0;

        uint256 lastTrade = userTradeInfo[user].lastTradeTime;
        if (lastTrade == 0) return 0;

        uint256 cooldownEnd = lastTrade + antiBotConfig.cooldownPeriod;
        if (block.timestamp >= cooldownEnd) return 0;

        return cooldownEnd - block.timestamp;
    }

    function isLaunchProtectionActive() external view returns (bool) {
        return _isLaunchProtectionActive();
    }

    function getMaxTransactionAmount(uint256 totalSupply) external view returns (uint256) {
        if (antiBotConfig.maxTxAmountBps == 0) return type(uint256).max;

        uint256 maxAmount = (totalSupply * antiBotConfig.maxTxAmountBps) / BPS_DENOMINATOR;

        if (_isLaunchProtectionActive()) {
            maxAmount = maxAmount / 2;
        }

        return maxAmount;
    }

    function getMaxWalletAmount(uint256 totalSupply) external view returns (uint256) {
        if (antiBotConfig.maxWalletAmountBps == 0) return type(uint256).max;
        return (totalSupply * antiBotConfig.maxWalletAmountBps) / BPS_DENOMINATOR;
    }
}
