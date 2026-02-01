// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";

import {LaunchpadToken} from "../contracts/core/LaunchpadToken.sol";
import {BondingCurve} from "../contracts/core/BondingCurve.sol";
import {LaunchpadFactory} from "../contracts/core/LaunchpadFactory.sol";
import {FeeManager} from "../contracts/core/FeeManager.sol";
import {LiquidityLocker} from "../contracts/core/LiquidityLocker.sol";
import {LiquidityManager} from "../contracts/core/LiquidityManager.sol";
import {LaunchpadRouter} from "../contracts/router/LaunchpadRouter.sol";

/**
 * @title Deploy
 * @notice Deployment script for the Avalanche Launchpad
 *
 * Deployment Order:
 * 1. Deploy implementation contracts (Token, BondingCurve)
 * 2. Deploy LiquidityLocker
 * 3. Deploy LiquidityManager
 * 4. Deploy FeeManager
 * 5. Deploy Factory
 * 6. Deploy Router
 * 7. Configure all contracts
 *
 * Usage:
 * - Fuji Testnet: forge script scripts/Deploy.s.sol --rpc-url fuji --broadcast
 * - Mainnet: forge script scripts/Deploy.s.sol --rpc-url avalanche --broadcast --verify
 */
contract DeployScript is Script {
    // Deployed contracts
    LaunchpadToken public tokenImplementation;
    BondingCurve public bondingCurveImplementation;
    LiquidityLocker public liquidityLocker;
    LiquidityManager public liquidityManager;
    FeeManager public feeManager;
    LaunchpadFactory public factory;
    LaunchpadRouter public router;

    // Configuration
    address public treasury;
    address public emergencyMultisig;
    address public dexRouter;

    // TraderJoe Router addresses
    address constant TRADERJOE_ROUTER_MAINNET = 0x60aE616a2155Ee3d9A68541Ba4544862310933d4;
    address constant TRADERJOE_ROUTER_FUJI = 0xd7f655E3376cE2D7A2b08fF01Eb3B1023191A901;

    function setUp() public {
        // Load configuration from environment
        treasury = vm.envOr("TREASURY_ADDRESS", msg.sender);
        emergencyMultisig = vm.envOr("EMERGENCY_MULTISIG", msg.sender);

        // Determine DEX router based on chain
        if (block.chainid == 43114) {
            // Avalanche Mainnet
            dexRouter = TRADERJOE_ROUTER_MAINNET;
        } else if (block.chainid == 43113) {
            // Fuji Testnet
            dexRouter = TRADERJOE_ROUTER_FUJI;
        } else {
            revert("Unsupported chain");
        }
    }

    function run() public {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console.log("Deploying with account:", deployer);
        console.log("Chain ID:", block.chainid);
        console.log("Treasury:", treasury);
        console.log("DEX Router:", dexRouter);

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy implementation contracts
        console.log("\n=== Deploying Implementation Contracts ===");

        tokenImplementation = new LaunchpadToken();
        console.log("LaunchpadToken Implementation:", address(tokenImplementation));

        bondingCurveImplementation = new BondingCurve();
        console.log("BondingCurve Implementation:", address(bondingCurveImplementation));

        // 2. Deploy LiquidityLocker
        console.log("\n=== Deploying LiquidityLocker ===");

        liquidityLocker = new LiquidityLocker(emergencyMultisig);
        console.log("LiquidityLocker:", address(liquidityLocker));

        // 3. Deploy LiquidityManager
        console.log("\n=== Deploying LiquidityManager ===");

        liquidityManager = new LiquidityManager(dexRouter, address(liquidityLocker));
        console.log("LiquidityManager:", address(liquidityManager));

        // 4. Deploy FeeManager
        console.log("\n=== Deploying FeeManager ===");

        feeManager = new FeeManager(treasury);
        console.log("FeeManager:", address(feeManager));

        // 5. Deploy Factory
        console.log("\n=== Deploying Factory ===");

        factory = new LaunchpadFactory(
            address(tokenImplementation),
            address(bondingCurveImplementation)
        );
        console.log("LaunchpadFactory:", address(factory));

        // 6. Deploy Router
        console.log("\n=== Deploying Router ===");

        router = new LaunchpadRouter(
            address(factory),
            address(feeManager),
            address(liquidityManager)
        );
        console.log("LaunchpadRouter:", address(router));

        // 7. Configure all contracts
        console.log("\n=== Configuring Contracts ===");

        // Configure Factory
        factory.setRouter(address(router));
        factory.setFeeManager(address(feeManager));
        factory.setLiquidityManager(address(liquidityManager));
        console.log("Factory configured");

        // Configure FeeManager
        feeManager.setFactory(address(factory));
        feeManager.setRouter(address(router));
        console.log("FeeManager configured");

        // Configure LiquidityManager
        liquidityManager.setFactory(address(factory));
        console.log("LiquidityManager configured");

        // Configure LiquidityLocker
        liquidityLocker.setAuthorizedLocker(address(liquidityManager), true);
        liquidityLocker.setAuthorizedLocker(address(factory), true);
        console.log("LiquidityLocker configured");

        vm.stopBroadcast();

        // Print deployment summary
        console.log("\n=== Deployment Summary ===");
        console.log("Token Implementation:", address(tokenImplementation));
        console.log("BondingCurve Implementation:", address(bondingCurveImplementation));
        console.log("LiquidityLocker:", address(liquidityLocker));
        console.log("LiquidityManager:", address(liquidityManager));
        console.log("FeeManager:", address(feeManager));
        console.log("Factory:", address(factory));
        console.log("Router:", address(router));
        console.log("\nDeployment complete!");
    }
}

/**
 * @title DeployTestnet
 * @notice Quick deployment for testnet with default settings
 */
contract DeployTestnetScript is DeployScript {
    function setUp() public override {
        super.setUp();
        // Override with testnet-specific settings if needed
    }
}
