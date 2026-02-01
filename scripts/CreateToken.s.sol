// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";

import {ILaunchpadFactory} from "../contracts/interfaces/ILaunchpadFactory.sol";
import {ILaunchpadRouter} from "../contracts/interfaces/ILaunchpadRouter.sol";
import {LaunchpadRouter} from "../contracts/router/LaunchpadRouter.sol";

/**
 * @title CreateToken
 * @notice Script to create a new token on the launchpad
 *
 * Usage:
 * forge script scripts/CreateToken.s.sol --rpc-url fuji --broadcast \
 *   --sig "run(string,string,string)" "MyToken" "MTK" "My awesome token"
 */
contract CreateTokenScript is Script {
    function run(
        string memory name,
        string memory symbol,
        string memory description
    ) public {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address routerAddress = vm.envAddress("ROUTER_ADDRESS");

        LaunchpadRouter router = LaunchpadRouter(payable(routerAddress));

        // Get creation fee
        uint256 creationFee = router.feeManager().feeConfig().creationFee;

        console.log("Creating token:", name, symbol);
        console.log("Creation fee:", creationFee);

        vm.startBroadcast(deployerPrivateKey);

        ILaunchpadFactory.LaunchParams memory params = ILaunchpadFactory.LaunchParams({
            name: name,
            symbol: symbol,
            description: description,
            imageURI: "",
            twitter: "",
            telegram: "",
            website: ""
        });

        (address token, address bondingCurve) = router.createToken{value: creationFee}(params);

        vm.stopBroadcast();

        console.log("Token created:", token);
        console.log("Bonding curve:", bondingCurve);
    }

    function runWithBuy(
        string memory name,
        string memory symbol,
        string memory description,
        uint256 buyAmount
    ) public {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address routerAddress = vm.envAddress("ROUTER_ADDRESS");

        LaunchpadRouter router = LaunchpadRouter(payable(routerAddress));

        // Get creation fee
        uint256 creationFee = router.feeManager().feeConfig().creationFee;
        uint256 totalValue = creationFee + buyAmount;

        console.log("Creating token and buying:", name, symbol);
        console.log("Creation fee:", creationFee);
        console.log("Buy amount:", buyAmount);

        vm.startBroadcast(deployerPrivateKey);

        ILaunchpadFactory.LaunchParams memory params = ILaunchpadFactory.LaunchParams({
            name: name,
            symbol: symbol,
            description: description,
            imageURI: "",
            twitter: "",
            telegram: "",
            website: ""
        });

        (address token, address bondingCurve, uint256 tokensReceived) = router.createTokenAndBuy{value: totalValue}(
            params,
            0 // minTokensOut - no minimum for this example
        );

        vm.stopBroadcast();

        console.log("Token created:", token);
        console.log("Bonding curve:", bondingCurve);
        console.log("Tokens received:", tokensReceived);
    }
}
