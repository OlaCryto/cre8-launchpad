// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {Cre8Manager} from "../contracts/v3/Cre8Manager.sol";

/**
 * @title DeployCre8Manager
 * @notice Deploy Cre8Manager behind a UUPS proxy (Arena-style single contract)
 *
 * Usage:
 *   Fuji:    forge script scripts/DeployCre8Manager.s.sol --rpc-url fuji --broadcast
 *   Mainnet: forge script scripts/DeployCre8Manager.s.sol --rpc-url avalanche --broadcast --verify
 *
 * Required env vars:
 *   PRIVATE_KEY         — deployer private key
 *   TREASURY_ADDRESS    — protocol fee destination
 */
contract DeployCre8ManagerScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address treasury = vm.envAddress("TREASURY_ADDRESS");
        address deployer = vm.addr(deployerPrivateKey);

        console.log("Deployer:", deployer);
        console.log("Treasury:", treasury);

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy implementation (constructor disables initializers)
        Cre8Manager implementation = new Cre8Manager();
        console.log("Cre8Manager implementation:", address(implementation));

        // 2. Deploy UUPS proxy with initialize calldata
        bytes memory initData = abi.encodeWithSelector(
            Cre8Manager.initialize.selector,
            treasury,   // protocolFeeDestination
            deployer     // owner
        );

        ERC1967Proxy proxy = new ERC1967Proxy(
            address(implementation),
            initData
        );
        console.log("Cre8Manager proxy:", address(proxy));

        // 3. Verify initialization
        Cre8Manager manager = Cre8Manager(payable(address(proxy)));
        console.log("Owner:", manager.owner());
        console.log("Fee destination:", manager.protocolFeeDestination());

        (uint256 basePrice, uint256 slope, uint256 maxSupply, uint256 gradThreshold) = manager.curveConfig();
        console.log("Base price:", basePrice);
        console.log("Graduation threshold:", gradThreshold);

        vm.stopBroadcast();

        console.log("");
        console.log("=== DEPLOYMENT COMPLETE ===");
        console.log("Implementation:", address(implementation));
        console.log("Proxy (use this):", address(proxy));
        console.log("");
        console.log("To upgrade later:");
        console.log("  manager.upgradeTo(newImplementationAddress)");
    }
}
