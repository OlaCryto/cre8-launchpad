// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title Cre8Token
 * @notice Minimal ERC20 token deployed per launch. Owner = Cre8Manager.
 * @dev Arena-style: mint/burn controlled by manager.
 *      Blacklist checked on transfers (permanent ban for bad actors).
 *      Whitelist logic lives in Cre8Manager (AVAX-denominated limits).
 *
 * Token Economics (fixed):
 *   Total Supply = 1,000,000,000 (1B) — minted on demand, never all at once
 *   80% sold via bonding curve (minted as people buy)
 *   20% reserved for DEX liquidity (minted at graduation)
 */
contract Cre8Token is ERC20, Ownable {
    uint256 public constant MAX_SUPPLY = 1_000_000_000 * 1e18;
    uint256 public constant BONDING_SUPPLY = 800_000_000 * 1e18;
    uint256 public constant LIQUIDITY_SUPPLY = 200_000_000 * 1e18;

    address public creator;
    bool public graduated;

    mapping(address => bool) public blacklisted;

    event TokenGraduated();
    event BlacklistUpdated(address indexed account, bool status);

    error Blacklisted();
    error MaxSupplyExceeded();

    constructor(
        string memory name_,
        string memory symbol_,
        address creator_,
        address manager_
    ) ERC20(name_, symbol_) {
        creator = creator_;
        _transferOwnership(manager_);
    }

    // ============ Owner (Cre8Manager) Functions ============

    function mint(address to, uint256 amount) external onlyOwner {
        if (totalSupply() + amount > MAX_SUPPLY) revert MaxSupplyExceeded();
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external onlyOwner {
        _burn(from, amount);
    }

    function setBlacklist(address account, bool status) external onlyOwner {
        blacklisted[account] = status;
        emit BlacklistUpdated(account, status);
    }

    function setBlacklistBatch(address[] calldata accounts, bool status) external onlyOwner {
        for (uint256 i = 0; i < accounts.length; i++) {
            blacklisted[accounts[i]] = status;
            emit BlacklistUpdated(accounts[i], status);
        }
    }

    function setGraduated() external onlyOwner {
        graduated = true;
        emit TokenGraduated();
    }

    // ============ Transfer Override ============

    function _beforeTokenTransfer(address from, address to, uint256 /*amount*/) internal view override {
        // Check blacklist on all transfers including mints (to) and burns (from)
        if (to != address(0) && blacklisted[to]) revert Blacklisted();
        if (from != address(0) && blacklisted[from]) revert Blacklisted();
    }
}
