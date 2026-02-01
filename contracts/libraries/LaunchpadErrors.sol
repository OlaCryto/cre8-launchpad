// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title LaunchpadErrors
 * @notice Custom errors for the launchpad platform
 */
library LaunchpadErrors {
    // General errors
    error Unauthorized();
    error ZeroAddress();
    error ZeroAmount();
    error InvalidInput();
    error AlreadyInitialized();
    error NotInitialized();
    error ContractPaused();

    // Token errors
    error TokenAlreadyGraduated();
    error TokenNotGraduated();
    error InvalidTokenName();
    error InvalidTokenSymbol();
    error TokenNotFound();
    error NotLaunchpadToken();

    // Trading errors
    error InsufficientPayment();
    error InsufficientOutput();
    error SlippageExceeded();
    error DeadlineExpired();
    error TradingDisabled();
    error MaxSupplyReached();
    error InsufficientReserve();
    error InsufficientBalance();

    // Fee errors
    error InsufficientCreationFee();
    error NoFeesToWithdraw();
    error FeeTransferFailed();

    // Liquidity errors
    error LiquidityAlreadyLocked();
    error LiquidityNotLocked();
    error LiquidityStillLocked();
    error InvalidLockDuration();
    error LockNotFound();
    error NotLockOwner();
    error LiquidityAdditionFailed();

    // Graduation errors
    error GraduationThresholdNotMet();
    error GraduationFailed();
    error AlreadyGraduating();

    // Anti-bot errors
    error CooldownActive();
    error MaxTransactionExceeded();
    error MaxWalletExceeded();
    error BotDetected();
    error TradingNotStarted();

    // Access control errors
    error OnlyFactory();
    error OnlyRouter();
    error OnlyBondingCurve();
    error OnlyOwner();
    error OnlyAdmin();
}
