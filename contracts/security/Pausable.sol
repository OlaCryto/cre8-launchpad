// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {LaunchpadErrors} from "../libraries/LaunchpadErrors.sol";

/**
 * @title Pausable
 * @notice Emergency pause functionality for the launchpad
 */
abstract contract Pausable {
    bool private _paused;

    event Paused(address indexed account);
    event Unpaused(address indexed account);

    modifier whenNotPaused() {
        if (_paused) revert LaunchpadErrors.ContractPaused();
        _;
    }

    modifier whenPaused() {
        if (!_paused) revert LaunchpadErrors.ContractPaused();
        _;
    }

    function paused() public view returns (bool) {
        return _paused;
    }

    function _pause() internal whenNotPaused {
        _paused = true;
        emit Paused(msg.sender);
    }

    function _unpause() internal whenPaused {
        _paused = false;
        emit Unpaused(msg.sender);
    }
}
