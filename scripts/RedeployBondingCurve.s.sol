// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {BondingCurveV2} from "../contracts/core/BondingCurveV2.sol";
import {LaunchpadFactoryV2} from "../contracts/core/LaunchpadFactoryV2.sol";

/**
 * @title RedeployBondingCurve
 * @notice Deploys a new BondingCurveV2 implementation with anti-bot disabled,
 *         then updates the Factory to use it for all future token launches.
 *
 * Existing tokens keep the old implementation (EIP-1167 clones are immutable),
 * but anti-bot was already broken for them (Router = msg.sender).
 * New tokens will use this fixed implementation.
 *
 * Usage:
 *   forge script scripts/RedeployBondingCurve.s.sol --rpc-url fuji --broadcast
 */
contract RedeployBondingCurveScript is Script {
    // Current deployed Factory on Fuji
    address payable constant FACTORY = payable(0x0926707Dc7a64d63f37390d7C616352b180E807a);

    function run() public {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console.log("=== BondingCurveV2 Redeployment ===");
        console.log("Deployer:", deployer);
        console.log("Factory:", FACTORY);

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy new BondingCurveV2 implementation (anti-bot disabled)
        BondingCurveV2 newCurveImpl = new BondingCurveV2();
        console.log("New BondingCurveV2 impl:", address(newCurveImpl));

        // 2. Update Factory to use new implementation for future tokens
        LaunchpadFactoryV2 factory = LaunchpadFactoryV2(FACTORY);
        factory.setBondingCurveImplementation(address(newCurveImpl));
        console.log("Factory updated to new BondingCurveV2 implementation");

        vm.stopBroadcast();

        console.log("");
        console.log("=== Done ===");
        console.log("New tokens will use anti-bot-free BondingCurveV2");
        console.log("Existing tokens still use old implementation (anti-bot broken anyway)");
    }
}
