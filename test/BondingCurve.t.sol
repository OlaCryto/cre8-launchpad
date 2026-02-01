// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";

import {LaunchpadToken} from "../contracts/core/LaunchpadToken.sol";
import {BondingCurve} from "../contracts/core/BondingCurve.sol";
import {IBondingCurve} from "../contracts/interfaces/IBondingCurve.sol";
import {ILaunchpadToken} from "../contracts/interfaces/ILaunchpadToken.sol";
import {BondingCurveMath} from "../contracts/libraries/BondingCurveMath.sol";

/**
 * @title BondingCurveTest
 * @notice Test suite for the BondingCurve contract
 */
contract BondingCurveTest is Test {
    LaunchpadToken public tokenImpl;
    BondingCurve public curveImpl;

    LaunchpadToken public token;
    BondingCurve public curve;

    address public factory;
    address public router;
    address public creator;
    address public buyer1;
    address public buyer2;

    uint256 constant PRECISION = 1e18;

    function setUp() public {
        factory = address(this);
        router = makeAddr("router");
        creator = makeAddr("creator");
        buyer1 = makeAddr("buyer1");
        buyer2 = makeAddr("buyer2");

        // Fund accounts
        vm.deal(buyer1, 100 ether);
        vm.deal(buyer2, 100 ether);

        // Deploy implementations
        tokenImpl = new LaunchpadToken();
        curveImpl = new BondingCurve();

        // Deploy and initialize token
        token = LaunchpadToken(Clones.clone(address(tokenImpl)));
        curve = BondingCurve(payable(Clones.clone(address(curveImpl))));

        ILaunchpadToken.TokenMetadata memory metadata = ILaunchpadToken.TokenMetadata({
            name: "Test Token",
            symbol: "TEST",
            description: "A test token",
            imageURI: "",
            twitter: "",
            telegram: "",
            website: ""
        });

        token.initialize("Test Token", "TEST", creator, address(curve), metadata);

        IBondingCurve.CurveParams memory params = IBondingCurve.CurveParams({
            basePrice: 0,
            slope: 0,
            maxSupply: 0,
            graduationThreshold: 69_000 ether
        });

        curve.initialize(address(token), params);
        curve.setRouter(router);
    }

    function test_InitialState() public view {
        assertEq(curve.token(), address(token));
        assertEq(curve.currentSupply(), 0);
        assertEq(curve.reserveBalance(), 0);
        assertEq(uint256(curve.state()), uint256(IBondingCurve.CurveState.Trading));
    }

    function test_GetCurrentPrice() public view {
        uint256 price = curve.getCurrentPrice();
        // Should be base price when no tokens sold
        assertGt(price, 0);
    }

    function test_Buy() public {
        uint256 buyAmount = 1 ether;

        vm.prank(buyer1);
        uint256 tokensOut = curve.buy{value: buyAmount}(0);

        assertGt(tokensOut, 0);
        assertEq(token.balanceOf(buyer1), tokensOut);
        assertEq(curve.currentSupply(), tokensOut);
        assertEq(curve.reserveBalance(), buyAmount);
    }

    function test_BuyMultiple() public {
        uint256 buyAmount = 1 ether;

        // First buy
        vm.prank(buyer1);
        uint256 tokens1 = curve.buy{value: buyAmount}(0);

        uint256 priceAfterFirst = curve.getCurrentPrice();

        // Skip cooldown
        vm.warp(block.timestamp + 31);

        // Second buy
        vm.prank(buyer2);
        uint256 tokens2 = curve.buy{value: buyAmount}(0);

        // Price should increase, so second buyer gets fewer tokens
        assertLt(tokens2, tokens1);
        assertGt(curve.getCurrentPrice(), priceAfterFirst);
    }

    function test_Sell() public {
        uint256 buyAmount = 1 ether;

        // Buy first
        vm.prank(buyer1);
        uint256 tokensOut = curve.buy{value: buyAmount}(0);

        uint256 balanceBefore = buyer1.balance;

        // Skip cooldown
        vm.warp(block.timestamp + 31);

        // Sell
        vm.prank(buyer1);
        uint256 avaxOut = curve.sell(tokensOut, 0);

        assertGt(avaxOut, 0);
        assertEq(token.balanceOf(buyer1), 0);
        assertEq(buyer1.balance, balanceBefore + avaxOut);
    }

    function test_SlippageProtection() public {
        uint256 buyAmount = 1 ether;

        // Get expected tokens
        (uint256 expectedTokens,) = curve.getBuyPrice(buyAmount);

        // Set minimum higher than expected
        vm.expectRevert();
        vm.prank(buyer1);
        curve.buy{value: buyAmount}(expectedTokens + 1);
    }

    function test_GraduationTrigger() public {
        // Buy enough to trigger graduation
        // This would require significant AVAX to reach $69K market cap
        // For testing, we'll check the graduation progress

        vm.prank(buyer1);
        curve.buy{value: 10 ether}(0);

        uint256 progress = curve.getGraduationProgress();
        assertGt(progress, 0);
    }

    function test_AntiBotCooldown() public {
        uint256 buyAmount = 0.1 ether;

        // First buy
        vm.prank(buyer1);
        curve.buy{value: buyAmount}(0);

        // Immediate second buy should fail
        vm.expectRevert();
        vm.prank(buyer1);
        curve.buy{value: buyAmount}(0);

        // After cooldown, should work
        vm.warp(block.timestamp + 31);
        vm.prank(buyer1);
        curve.buy{value: buyAmount}(0);
    }

    function testFuzz_BuyAndSell(uint256 buyAmount) public {
        buyAmount = bound(buyAmount, 0.01 ether, 10 ether);

        vm.prank(buyer1);
        uint256 tokensOut = curve.buy{value: buyAmount}(0);

        vm.warp(block.timestamp + 31);

        vm.prank(buyer1);
        uint256 avaxOut = curve.sell(tokensOut, 0);

        // Should get back slightly less due to curve mechanics
        assertLe(avaxOut, buyAmount);
    }
}

// Helper for cloning
library Clones {
    function clone(address implementation) internal returns (address instance) {
        assembly {
            let ptr := mload(0x40)
            mstore(ptr, 0x3d602d80600a3d3981f3363d3d373d3d3d363d73000000000000000000000000)
            mstore(add(ptr, 0x14), shl(0x60, implementation))
            mstore(add(ptr, 0x28), 0x5af43d82803e903d91602b57fd5bf30000000000000000000000000000000000)
            instance := create(0, ptr, 0x37)
        }
        require(instance != address(0), "Clone failed");
    }
}
