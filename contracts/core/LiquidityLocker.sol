// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {ILiquidityLocker} from "../interfaces/ILiquidityLocker.sol";
import {LaunchpadErrors} from "../libraries/LaunchpadErrors.sol";

/**
 * @title LiquidityLocker
 * @notice Locks LP tokens to prevent rug pulls
 * @dev Core security component - ensures DEX liquidity cannot be removed
 *
 * Features:
 * - Time-based liquidity locks (default 1 year)
 * - Lock extension capability
 * - Emergency unlock with multi-sig (for extreme cases)
 * - Per-token tracking
 */
contract LiquidityLocker is
    Ownable,
    ReentrancyGuard,
    ILiquidityLocker
{
    using SafeERC20 for IERC20;

    // ============ Constants ============

    uint256 public constant MIN_LOCK_DURATION = 30 days;
    uint256 public constant MAX_LOCK_DURATION = 10 * 365 days; // 10 years
    uint256 public constant DEFAULT_LOCK_DURATION = 365 days;  // 1 year

    // ============ State Variables ============

    uint256 public nextLockId;
    uint256 public totalValueLocked;

    mapping(uint256 => LockInfo) public locks;
    mapping(address => uint256) public tokenToLockId;

    // Authorized lockers (LiquidityManager, Factory)
    mapping(address => bool) public authorizedLockers;

    // Emergency unlock multi-sig
    address public emergencyMultisig;

    // ============ Events ============

    event LockerAuthorized(address indexed locker, bool status);
    event EmergencyMultisigUpdated(address indexed oldMultisig, address indexed newMultisig);

    // ============ Modifiers ============

    modifier onlyAuthorized() {
        if (!authorizedLockers[msg.sender] && msg.sender != owner()) {
            revert LaunchpadErrors.Unauthorized();
        }
        _;
    }

    // ============ Constructor ============

    constructor(address emergencyMultisig_) Ownable(msg.sender) {
        if (emergencyMultisig_ == address(0)) revert LaunchpadErrors.ZeroAddress();
        emergencyMultisig = emergencyMultisig_;
        nextLockId = 1; // Start from 1
    }

    // ============ Configuration ============

    /**
     * @notice Authorize an address to create locks
     * @param locker Address to authorize
     * @param status Authorization status
     */
    function setAuthorizedLocker(address locker, bool status) external onlyOwner {
        if (locker == address(0)) revert LaunchpadErrors.ZeroAddress();
        authorizedLockers[locker] = status;
        emit LockerAuthorized(locker, status);
    }

    /**
     * @notice Update emergency multi-sig address
     * @param multisig New multi-sig address
     */
    function setEmergencyMultisig(address multisig) external onlyOwner {
        if (multisig == address(0)) revert LaunchpadErrors.ZeroAddress();
        emit EmergencyMultisigUpdated(emergencyMultisig, multisig);
        emergencyMultisig = multisig;
    }

    // ============ Lock Functions ============

    /**
     * @notice Lock LP tokens for a token
     * @param token The launchpad token address
     * @param lpToken The LP token address
     * @param amount Amount of LP tokens to lock
     * @param duration Lock duration in seconds
     * @param lockOwner Who can unlock (usually factory/liquidity manager)
     * @return lockId The ID of the created lock
     */
    function lock(
        address token,
        address lpToken,
        uint256 amount,
        uint256 duration,
        address lockOwner
    ) external nonReentrant onlyAuthorized returns (uint256 lockId) {
        if (token == address(0)) revert LaunchpadErrors.ZeroAddress();
        if (lpToken == address(0)) revert LaunchpadErrors.ZeroAddress();
        if (amount == 0) revert LaunchpadErrors.ZeroAmount();
        if (lockOwner == address(0)) revert LaunchpadErrors.ZeroAddress();

        // Validate duration
        if (duration < MIN_LOCK_DURATION || duration > MAX_LOCK_DURATION) {
            revert LaunchpadErrors.InvalidLockDuration();
        }

        // Check if token already has a lock
        if (tokenToLockId[token] != 0) {
            revert LaunchpadErrors.LiquidityAlreadyLocked();
        }

        // Transfer LP tokens to this contract
        IERC20(lpToken).safeTransferFrom(msg.sender, address(this), amount);

        // Create lock
        lockId = nextLockId++;
        uint256 unlockTime = block.timestamp + duration;

        locks[lockId] = LockInfo({
            token: token,
            lpToken: lpToken,
            owner: lockOwner,
            amount: amount,
            lockedAt: block.timestamp,
            unlockTime: unlockTime,
            isUnlocked: false
        });

        tokenToLockId[token] = lockId;
        totalValueLocked += amount;

        emit LiquidityLocked(lockId, token, lpToken, amount, unlockTime);

        return lockId;
    }

    /**
     * @notice Unlock LP tokens after lock period
     * @param lockId Lock ID to unlock
     * @param recipient Address to receive LP tokens
     * @return amount Amount of LP tokens unlocked
     */
    function unlock(uint256 lockId, address recipient)
        external
        nonReentrant
        returns (uint256 amount)
    {
        LockInfo storage lockInfo = locks[lockId];

        if (lockInfo.token == address(0)) revert LaunchpadErrors.LockNotFound();
        if (lockInfo.isUnlocked) revert LaunchpadErrors.LiquidityNotLocked();
        if (block.timestamp < lockInfo.unlockTime) revert LaunchpadErrors.LiquidityStillLocked();

        // Only owner or lock owner can unlock
        if (msg.sender != lockInfo.owner && msg.sender != owner()) {
            revert LaunchpadErrors.NotLockOwner();
        }

        if (recipient == address(0)) revert LaunchpadErrors.ZeroAddress();

        amount = lockInfo.amount;
        lockInfo.isUnlocked = true;
        totalValueLocked -= amount;

        // Clear token mapping
        delete tokenToLockId[lockInfo.token];

        // Transfer LP tokens to recipient
        IERC20(lockInfo.lpToken).safeTransfer(recipient, amount);

        emit LiquidityUnlocked(lockId, lockInfo.token, recipient, amount);

        return amount;
    }

    /**
     * @notice Extend lock duration
     * @param lockId Lock ID to extend
     * @param additionalTime Additional time to add
     */
    function extendLock(uint256 lockId, uint256 additionalTime) external {
        LockInfo storage lockInfo = locks[lockId];

        if (lockInfo.token == address(0)) revert LaunchpadErrors.LockNotFound();
        if (lockInfo.isUnlocked) revert LaunchpadErrors.LiquidityNotLocked();

        // Only owner or lock owner can extend
        if (msg.sender != lockInfo.owner && msg.sender != owner()) {
            revert LaunchpadErrors.NotLockOwner();
        }

        uint256 newUnlockTime = lockInfo.unlockTime + additionalTime;

        // Check max duration from original lock
        if (newUnlockTime > lockInfo.lockedAt + MAX_LOCK_DURATION) {
            newUnlockTime = lockInfo.lockedAt + MAX_LOCK_DURATION;
        }

        emit LockExtended(lockId, lockInfo.unlockTime, newUnlockTime);

        lockInfo.unlockTime = newUnlockTime;
    }

    /**
     * @notice Emergency unlock (only multi-sig, for extreme cases)
     * @dev Should only be used in case of critical bugs or legal requirements
     * @param lockId Lock ID to unlock
     * @param recipient Address to receive LP tokens
     * @param reason Reason for emergency unlock
     */
    function emergencyUnlock(
        uint256 lockId,
        address recipient,
        string calldata reason
    ) external nonReentrant {
        if (msg.sender != emergencyMultisig) revert LaunchpadErrors.Unauthorized();

        LockInfo storage lockInfo = locks[lockId];

        if (lockInfo.token == address(0)) revert LaunchpadErrors.LockNotFound();
        if (lockInfo.isUnlocked) revert LaunchpadErrors.LiquidityNotLocked();
        if (recipient == address(0)) revert LaunchpadErrors.ZeroAddress();

        uint256 amount = lockInfo.amount;
        lockInfo.isUnlocked = true;
        totalValueLocked -= amount;

        // Clear token mapping
        delete tokenToLockId[lockInfo.token];

        // Transfer LP tokens
        IERC20(lockInfo.lpToken).safeTransfer(recipient, amount);

        emit EmergencyUnlock(lockId, msg.sender, reason);
        emit LiquidityUnlocked(lockId, lockInfo.token, recipient, amount);
    }

    // ============ View Functions ============

    /**
     * @notice Get lock info by ID
     * @param lockId Lock ID
     */
    function getLock(uint256 lockId) external view returns (LockInfo memory) {
        return locks[lockId];
    }

    /**
     * @notice Get lock info by token
     * @param token Token address
     */
    function getLockByToken(address token) external view returns (uint256 lockId, LockInfo memory) {
        lockId = tokenToLockId[token];
        if (lockId == 0) revert LaunchpadErrors.LockNotFound();
        return (lockId, locks[lockId]);
    }

    /**
     * @notice Check if a token's liquidity is locked
     * @param token Token address
     */
    function isLocked(address token) external view returns (bool) {
        uint256 lockId = tokenToLockId[token];
        if (lockId == 0) return false;
        return !locks[lockId].isUnlocked && block.timestamp < locks[lockId].unlockTime;
    }

    /**
     * @notice Get unlock time for a token
     * @param token Token address
     */
    function getUnlockTime(address token) external view returns (uint256) {
        uint256 lockId = tokenToLockId[token];
        if (lockId == 0) return 0;
        return locks[lockId].unlockTime;
    }

    /**
     * @notice Get total number of locks created
     */
    function totalLocks() external view returns (uint256) {
        return nextLockId - 1;
    }

    /**
     * @notice Get time remaining until unlock
     * @param lockId Lock ID
     */
    function getTimeRemaining(uint256 lockId) external view returns (uint256) {
        LockInfo storage lockInfo = locks[lockId];
        if (lockInfo.isUnlocked || block.timestamp >= lockInfo.unlockTime) {
            return 0;
        }
        return lockInfo.unlockTime - block.timestamp;
    }
}
