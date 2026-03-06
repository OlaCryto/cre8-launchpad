// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {LaunchManager} from "../contracts/forge/LaunchManager.sol";
import {LaunchpadFactoryV2} from "../contracts/core/LaunchpadFactoryV2.sol";

/**
 * @title RedeployLaunchManager
 * @notice Redeploys only the LaunchManager with updated ForgeConfig (hardCap/softCap)
 *
 * Usage:
 *   forge script scripts/RedeployLaunchManager.s.sol --rpc-url fuji --broadcast
 */
contract RedeployLaunchManagerScript is Script {
    // Existing deployed addresses on Fuji
    address payable constant FACTORY = payable(0xd6381f7F9D3C23352291eaFB6dF5B732677358e5);
    address constant CREATOR_REGISTRY = 0xEdA2F2aB67AC0Dc5E60Bed37b26812D33BE5bF9D;

    function run() public {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console.log("=== LaunchManager Redeployment ===");
        console.log("Deployer:", deployer);
        console.log("Factory:", FACTORY);
        console.log("CreatorRegistry:", CREATOR_REGISTRY);

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy new LaunchManager
        LaunchManager newLaunchManager = new LaunchManager(FACTORY, CREATOR_REGISTRY);
        console.log("New LaunchManager:", address(newLaunchManager));

        // 2. Update Factory to point to new LaunchManager
        LaunchpadFactoryV2(FACTORY).setLaunchManager(address(newLaunchManager));
        console.log("Factory updated with new LaunchManager");

        vm.stopBroadcast();

        console.log("");
        console.log("========================================");
        console.log("  Update frontend/app/src/config/wagmi.ts:");
        console.log("  LaunchManager:", address(newLaunchManager));
        console.log("========================================");
    }
}
