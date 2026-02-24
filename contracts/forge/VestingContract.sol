// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {LaunchpadErrors} from "../libraries/LaunchpadErrors.sol";

/**
 * @title VestingContract
 * @notice Locks team token allocations with cliff and linear vesting
 * @dev Created by LaunchManager for Forge Mode tokens with team vesting enabled.
 *
 * Flow:
 * 1. LaunchManager creates VestingContract with config (cliff, duration, beneficiary)
 * 2. LaunchManager sends team tokens to this contract
 * 3. After cliff period: tokens start vesting linearly
 * 4. Beneficiary can claim vested tokens at any time
 */
contract VestingContract is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ============ Structs ============

    struct VestingSchedule {
        address beneficiary;        // Who receives the tokens (creator)
        address token;              // Token being vested
        uint256 totalAmount;        // Total tokens locked
        uint256 released;           // Tokens already released
        uint256 startTime;          // When vesting starts (after cliff)
        uint256 cliffDuration;      // Cliff period in seconds
        uint256 vestingDuration;    // Total vesting period after cliff in seconds
        bool revoked;               // Whether the vesting was revoked
    }

    // ============ Events ============

    event VestingCreated(
        address indexed beneficiary,
        address indexed token,
        uint256 totalAmount,
        uint256 cliffDuration,
        uint256 vestingDuration
    );
    event TokensReleased(address indexed beneficiary, address indexed token, uint256 amount);
    event VestingRevoked(address indexed beneficiary, address indexed token, uint256 amountRevoked);

    // ============ State Variables ============

    VestingSchedule public schedule;
    address public launchManager;

    // ============ Modifiers ============

    modifier onlyBeneficiary() {
        if (msg.sender != schedule.beneficiary) revert LaunchpadErrors.Unauthorized();
        _;
    }

    modifier onlyLaunchManager() {
        if (msg.sender != launchManager) revert LaunchpadErrors.Unauthorized();
        _;
    }

    // ============ Constructor ============

    /**
     * @notice Create a new vesting contract
     * @param beneficiary_ Address that receives vested tokens
     * @param token_ Token to vest
     * @param totalAmount_ Total tokens to lock
     * @param cliffDuration_ Cliff period in seconds (no release during cliff)
     * @param vestingDuration_ Vesting period in seconds (linear release after cliff)
     * @param launchManager_ LaunchManager address (can revoke)
     */
    constructor(
        address beneficiary_,
        address token_,
        uint256 totalAmount_,
        uint256 cliffDuration_,
        uint256 vestingDuration_,
        address launchManager_
    ) {
        if (beneficiary_ == address(0)) revert LaunchpadErrors.ZeroAddress();
        if (token_ == address(0)) revert LaunchpadErrors.ZeroAddress();
        if (totalAmount_ == 0) revert LaunchpadErrors.ZeroAmount();
        if (vestingDuration_ == 0) revert LaunchpadErrors.InvalidInput();
        if (launchManager_ == address(0)) revert LaunchpadErrors.ZeroAddress();

        schedule = VestingSchedule({
            beneficiary: beneficiary_,
            token: token_,
            totalAmount: totalAmount_,
            released: 0,
            startTime: block.timestamp,
            cliffDuration: cliffDuration_,
            vestingDuration: vestingDuration_,
            revoked: false
        });

        launchManager = launchManager_;

        emit VestingCreated(beneficiary_, token_, totalAmount_, cliffDuration_, vestingDuration_);
    }

    // ============ Release ============

    /**
     * @notice Release vested tokens to beneficiary
     */
    function release() external nonReentrant onlyBeneficiary {
        if (schedule.revoked) revert LaunchpadErrors.InvalidInput();

        uint256 releasable = getReleasable();
        if (releasable == 0) revert LaunchpadErrors.ZeroAmount();

        schedule.released += releasable;

        IERC20(schedule.token).safeTransfer(schedule.beneficiary, releasable);

        emit TokensReleased(schedule.beneficiary, schedule.token, releasable);
    }

    // ============ Revoke ============

    /**
     * @notice Revoke vesting and return unvested tokens
     * @dev Only LaunchManager can revoke. Already vested tokens stay with beneficiary.
     */
    function revoke() external onlyLaunchManager {
        if (schedule.revoked) revert LaunchpadErrors.AlreadyInitialized();

        schedule.revoked = true;

        // Calculate what's been vested so far
        uint256 vested = getVestedAmount();
        uint256 unvested = schedule.totalAmount - vested;

        // Release any vested but unclaimed tokens to beneficiary
        uint256 unreleased = vested - schedule.released;
        if (unreleased > 0) {
            schedule.released += unreleased;
            IERC20(schedule.token).safeTransfer(schedule.beneficiary, unreleased);
        }

        // Return unvested tokens to LaunchManager
        if (unvested > 0) {
            IERC20(schedule.token).safeTransfer(launchManager, unvested);
        }

        emit VestingRevoked(schedule.beneficiary, schedule.token, unvested);
    }

    // ============ View Functions ============

    /**
     * @notice Get total vested amount (including already released)
     */
    function getVestedAmount() public view returns (uint256) {
        if (block.timestamp < schedule.startTime + schedule.cliffDuration) {
            // Still in cliff period
            return 0;
        }

        uint256 timeAfterCliff = block.timestamp - schedule.startTime - schedule.cliffDuration;

        if (timeAfterCliff >= schedule.vestingDuration) {
            // Fully vested
            return schedule.totalAmount;
        }

        // Linear vesting
        return (schedule.totalAmount * timeAfterCliff) / schedule.vestingDuration;
    }

    /**
     * @notice Get amount that can be released right now
     */
    function getReleasable() public view returns (uint256) {
        uint256 vested = getVestedAmount();
        if (vested <= schedule.released) return 0;
        return vested - schedule.released;
    }

    /**
     * @notice Get vesting info summary
     */
    function getVestingInfo() external view returns (
        address beneficiary,
        address token,
        uint256 totalAmount,
        uint256 released,
        uint256 releasable,
        uint256 vestedAmount,
        uint256 cliffEnd,
        uint256 vestingEnd,
        bool revoked
    ) {
        beneficiary = schedule.beneficiary;
        token = schedule.token;
        totalAmount = schedule.totalAmount;
        released = schedule.released;
        releasable = getReleasable();
        vestedAmount = getVestedAmount();
        cliffEnd = schedule.startTime + schedule.cliffDuration;
        vestingEnd = schedule.startTime + schedule.cliffDuration + schedule.vestingDuration;
        revoked = schedule.revoked;
    }

    /**
     * @notice Get vesting progress in basis points (0 = 0%, 10000 = 100%)
     */
    function getProgress() external view returns (uint256) {
        uint256 vested = getVestedAmount();
        if (schedule.totalAmount == 0) return 0;
        return (vested * 10000) / schedule.totalAmount;
    }

    /**
     * @notice Time until cliff ends
     */
    function timeUntilCliff() external view returns (uint256) {
        uint256 cliffEnd = schedule.startTime + schedule.cliffDuration;
        if (block.timestamp >= cliffEnd) return 0;
        return cliffEnd - block.timestamp;
    }

    /**
     * @notice Time until fully vested
     */
    function timeUntilFullyVested() external view returns (uint256) {
        uint256 vestEnd = schedule.startTime + schedule.cliffDuration + schedule.vestingDuration;
        if (block.timestamp >= vestEnd) return 0;
        return vestEnd - block.timestamp;
    }
}
