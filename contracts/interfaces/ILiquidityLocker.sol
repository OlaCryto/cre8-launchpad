// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title ILiquidityLocker
 * @notice Interface for locking LP tokens to prevent rug pulls
 */
interface ILiquidityLocker {
    struct LockInfo {
        address token;
        address lpToken;
        address owner;
        uint256 amount;
        uint256 lockedAt;
        uint256 unlockTime;
        bool isUnlocked;
    }

    event LiquidityLocked(
        uint256 indexed lockId,
        address indexed token,
        address indexed lpToken,
        uint256 amount,
        uint256 unlockTime
    );

    event LiquidityUnlocked(
        uint256 indexed lockId,
        address indexed token,
        address indexed recipient,
        uint256 amount
    );

    event LockExtended(uint256 indexed lockId, uint256 oldUnlockTime, uint256 newUnlockTime);
    event EmergencyUnlock(uint256 indexed lockId, address indexed by, string reason);

    function lock(address token, address lpToken, uint256 amount, uint256 duration, address owner) external returns (uint256 lockId);
    function unlock(uint256 lockId, address recipient) external returns (uint256 amount);
    function extendLock(uint256 lockId, uint256 additionalTime) external;

    function getLock(uint256 lockId) external view returns (LockInfo memory);
    function getLockByToken(address token) external view returns (uint256 lockId, LockInfo memory);
    function isLocked(address token) external view returns (bool);
    function getUnlockTime(address token) external view returns (uint256);

    function totalLocks() external view returns (uint256);
    function totalValueLocked() external view returns (uint256);
}
