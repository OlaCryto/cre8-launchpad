// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";

import {LaunchpadTokenV2} from "../contracts/core/LaunchpadTokenV2.sol";
import {BondingCurveV2} from "../contracts/core/BondingCurveV2.sol";
import {LaunchpadFactoryV2} from "../contracts/core/LaunchpadFactoryV2.sol";
import {FeeManager} from "../contracts/core/FeeManager.sol";
import {LiquidityLocker} from "../contracts/core/LiquidityLocker.sol";
import {LiquidityManager} from "../contracts/core/LiquidityManager.sol";
import {CreatorRegistry} from "../contracts/core/CreatorRegistry.sol";
import {ActivityTracker} from "../contracts/core/ActivityTracker.sol";
import {LaunchpadRouterV2} from "../contracts/router/LaunchpadRouterV2.sol";
import {LaunchManager} from "../contracts/forge/LaunchManager.sol";

/**
 * @title DeployV2
 * @notice Deployment script for the Arena-style Avalanche Launchpad
 *
 * Deployment Order:
 * 1. Deploy implementation contracts (TokenV2, BondingCurveV2)
 * 2. Deploy CreatorRegistry
 * 3. Deploy ActivityTracker
 * 4. Deploy LiquidityLocker
 * 5. Deploy LiquidityManager
 * 6. Deploy FeeManager
 * 7. Deploy FactoryV2
 * 8. Deploy RouterV2
 * 9. Configure all contracts
 *
 * Usage:
 * - Fuji Testnet: forge script scripts/DeployV2.s.sol --rpc-url fuji --broadcast
 * - Mainnet: forge script scripts/DeployV2.s.sol --rpc-url avalanche --broadcast --verify
 */
contract DeployV2Script is Script {
    // Deployed contracts
    LaunchpadTokenV2 public tokenImplementation;
    BondingCurveV2 public bondingCurveImplementation;
    CreatorRegistry public creatorRegistry;
    ActivityTracker public activityTracker;
    LiquidityLocker public liquidityLocker;
    LiquidityManager public liquidityManager;
    FeeManager public feeManager;
    LaunchpadFactoryV2 public factory;
    LaunchpadRouterV2 public router;
    LaunchManager public launchManager;

    // Configuration
    address public treasury;
    address public emergencyMultisig;
    address public dexRouter;

    // TraderJoe Router addresses
    address constant TRADERJOE_ROUTER_MAINNET = 0x60aE616a2155Ee3d9A68541Ba4544862310933d4;
    address constant TRADERJOE_ROUTER_FUJI = 0xd7f655E3376cE2D7A2b08fF01Eb3B1023191A901;

    function setUp() public virtual {
        treasury = vm.envOr("TREASURY_ADDRESS", msg.sender);
        emergencyMultisig = vm.envOr("EMERGENCY_MULTISIG", msg.sender);

        if (block.chainid == 43114) {
            dexRouter = TRADERJOE_ROUTER_MAINNET;
        } else if (block.chainid == 43113) {
            dexRouter = TRADERJOE_ROUTER_FUJI;
        } else {
            revert("Unsupported chain");
        }
    }

    function run() public {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console.log("=== Avalanche Launchpad V2 Deployment ===");
        console.log("Deployer:", deployer);
        console.log("Chain ID:", block.chainid);
        console.log("Treasury:", treasury);
        console.log("DEX Router:", dexRouter);

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy implementation contracts
        console.log("\n--- Step 1: Implementation Contracts ---");

        tokenImplementation = new LaunchpadTokenV2();
        console.log("LaunchpadTokenV2 Implementation:", address(tokenImplementation));

        bondingCurveImplementation = new BondingCurveV2();
        console.log("BondingCurveV2 Implementation:", address(bondingCurveImplementation));

        // 2. Deploy CreatorRegistry
        console.log("\n--- Step 2: CreatorRegistry ---");

        creatorRegistry = new CreatorRegistry();
        console.log("CreatorRegistry:", address(creatorRegistry));

        // 3. Deploy ActivityTracker
        console.log("\n--- Step 3: ActivityTracker ---");

        activityTracker = new ActivityTracker();
        console.log("ActivityTracker:", address(activityTracker));

        // 4. Deploy LiquidityLocker
        console.log("\n--- Step 4: LiquidityLocker ---");

        liquidityLocker = new LiquidityLocker(emergencyMultisig);
        console.log("LiquidityLocker:", address(liquidityLocker));

        // 5. Deploy LiquidityManager
        console.log("\n--- Step 5: LiquidityManager ---");

        liquidityManager = new LiquidityManager(dexRouter, address(liquidityLocker));
        console.log("LiquidityManager:", address(liquidityManager));

        // 6. Deploy FeeManager
        console.log("\n--- Step 6: FeeManager ---");

        feeManager = new FeeManager(treasury);
        console.log("FeeManager:", address(feeManager));

        // 7. Deploy FactoryV2
        console.log("\n--- Step 7: LaunchpadFactoryV2 ---");

        factory = new LaunchpadFactoryV2(
            address(tokenImplementation),
            address(bondingCurveImplementation),
            address(creatorRegistry),
            address(activityTracker)
        );
        console.log("LaunchpadFactoryV2:", address(factory));

        // 8. Deploy RouterV2
        console.log("\n--- Step 8: LaunchpadRouterV2 ---");

        router = new LaunchpadRouterV2(
            address(factory),
            address(feeManager),
            address(creatorRegistry),
            address(activityTracker)
        );
        console.log("LaunchpadRouterV2:", address(router));

        // 9. Deploy LaunchManager (Forge Mode)
        console.log("\n--- Step 9: LaunchManager ---");

        launchManager = new LaunchManager(address(factory), address(creatorRegistry));
        console.log("LaunchManager:", address(launchManager));

        // 10. Configure all contracts
        console.log("\n--- Step 10: Configuration ---");

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

        // Configure CreatorRegistry
        creatorRegistry.setFactory(address(factory));
        console.log("CreatorRegistry configured");

        // Configure ActivityTracker
        activityTracker.setAuthorizedTracker(address(factory), true);
        activityTracker.setAuthorizedTracker(address(router), true);
        console.log("ActivityTracker configured");

        // Configure LaunchManager ↔ Factory
        factory.setLaunchManager(address(launchManager));
        console.log("LaunchManager configured");

        vm.stopBroadcast();

        // Print deployment summary
        _printSummary();
    }

    function _printSummary() internal view {
        console.log("\n");
        console.log("========================================");
        console.log("      DEPLOYMENT SUMMARY");
        console.log("========================================");
        console.log("");
        console.log("Implementation Contracts:");
        console.log("  TokenV2:        ", address(tokenImplementation));
        console.log("  BondingCurveV2: ", address(bondingCurveImplementation));
        console.log("");
        console.log("Core Contracts:");
        console.log("  Factory:        ", address(factory));
        console.log("  Router:         ", address(router));
        console.log("  FeeManager:     ", address(feeManager));
        console.log("  LiquidityMgr:   ", address(liquidityManager));
        console.log("  LiquidityLocker:", address(liquidityLocker));
        console.log("");
        console.log("Platform Contracts:");
        console.log("  CreatorRegistry:", address(creatorRegistry));
        console.log("  ActivityTracker:", address(activityTracker));
        console.log("  LaunchManager:  ", address(launchManager));
        console.log("");
        console.log("Configuration:");
        console.log("  Treasury:       ", treasury);
        console.log("  DEX Router:     ", dexRouter);
        console.log("  Emergency MS:   ", emergencyMultisig);
        console.log("");
        console.log("========================================");
        console.log("      DEPLOYMENT COMPLETE!");
        console.log("========================================");
    }
}

/**
 * @title DeployTestnetV2
 * @notice Quick testnet deployment with default settings
 */
contract DeployTestnetV2Script is DeployV2Script {
    function setUp() public override {
        super.setUp();
    }
}
