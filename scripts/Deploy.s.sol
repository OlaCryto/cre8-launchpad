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
import {CreatorRegistry} from "../contracts/core/CreatorRegistry.sol";
import {LaunchManager} from "../contracts/forge/LaunchManager.sol";

/**
 * @title Deploy
 * @notice Full Cre8 deployment: Trenches mode + Forge mode
 *
 * Deployment Order:
 * 1. Deploy implementation contracts (Token, BondingCurve)
 * 2. Deploy LiquidityLocker
 * 3. Deploy LiquidityManager
 * 4. Deploy FeeManager
 * 5. Deploy Factory
 * 6. Deploy Router (Trenches mode entry point)
 * 7. Deploy CreatorRegistry
 * 8. Deploy LaunchManager (Forge mode entry point)
 * 9. Configure all contracts
 *
 * Usage:
 * - Fuji:    forge script scripts/Deploy.s.sol --rpc-url fuji --broadcast
 * - Mainnet: forge script scripts/Deploy.s.sol --rpc-url avalanche --broadcast --verify
 */
contract DeployScript is Script {
    // Core contracts
    LaunchpadToken public tokenImplementation;
    BondingCurve public bondingCurveImplementation;
    LiquidityLocker public liquidityLocker;
    LiquidityManager public liquidityManager;
    FeeManager public feeManager;
    LaunchpadFactory public factory;
    LaunchpadRouter public router;

    // Forge mode contracts
    CreatorRegistry public creatorRegistry;
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

        console.log("Deploying Cre8 with account:", deployer);
        console.log("Chain ID:", block.chainid);
        console.log("Treasury:", treasury);

        vm.startBroadcast(deployerPrivateKey);

        // === 1. Implementation contracts ===
        tokenImplementation = new LaunchpadToken();
        console.log("LaunchpadToken impl:", address(tokenImplementation));

        bondingCurveImplementation = new BondingCurve();
        console.log("BondingCurve impl:", address(bondingCurveImplementation));

        // === 2. Supporting contracts ===
        liquidityLocker = new LiquidityLocker(emergencyMultisig);
        console.log("LiquidityLocker:", address(liquidityLocker));

        liquidityManager = new LiquidityManager(dexRouter, address(liquidityLocker));
        console.log("LiquidityManager:", address(liquidityManager));

        feeManager = new FeeManager(treasury);
        console.log("FeeManager:", address(feeManager));

        // === 3. Factory ===
        factory = new LaunchpadFactory(
            address(tokenImplementation),
            address(bondingCurveImplementation)
        );
        console.log("LaunchpadFactory:", address(factory));

        // === 4. Trenches mode: Router ===
        router = new LaunchpadRouter(
            address(factory),
            address(feeManager),
            address(liquidityManager)
        );
        console.log("LaunchpadRouter (Trenches):", address(router));

        // === 5. Forge mode: CreatorRegistry + LaunchManager ===
        creatorRegistry = new CreatorRegistry();
        console.log("CreatorRegistry:", address(creatorRegistry));

        launchManager = new LaunchManager(address(factory), address(creatorRegistry));
        console.log("LaunchManager (Forge):", address(launchManager));

        // === 6. Configure ===

        // Factory: authorize both Router (Trenches) and LaunchManager (Forge)
        factory.setRouter(address(router));
        factory.setFeeManager(address(feeManager));
        factory.setLiquidityManager(address(liquidityManager));

        // FeeManager
        feeManager.setFactory(address(factory));
        feeManager.setRouter(address(router));

        // LiquidityManager
        liquidityManager.setFactory(address(factory));

        // LiquidityLocker
        liquidityLocker.setAuthorizedLocker(address(liquidityManager), true);
        liquidityLocker.setAuthorizedLocker(address(factory), true);

        // CreatorRegistry: authorize LaunchManager
        creatorRegistry.setFactory(address(launchManager));

        console.log("All contracts configured");

        vm.stopBroadcast();

        // === Summary ===
        console.log("\n=== Cre8 Deployment Summary ===");
        console.log("-- Shared --");
        console.log("  Token impl:", address(tokenImplementation));
        console.log("  Curve impl:", address(bondingCurveImplementation));
        console.log("  Factory:", address(factory));
        console.log("  FeeManager:", address(feeManager));
        console.log("  LiquidityManager:", address(liquidityManager));
        console.log("  LiquidityLocker:", address(liquidityLocker));
        console.log("-- Trenches Mode --");
        console.log("  Router:", address(router));
        console.log("-- Forge Mode --");
        console.log("  CreatorRegistry:", address(creatorRegistry));
        console.log("  LaunchManager:", address(launchManager));
    }
}

/**
 * @title DeployTestnet
 * @notice Quick deployment for testnet with default settings
 */
contract DeployTestnetScript is DeployScript {
    function setUp() public override {
        super.setUp();
    }
}
