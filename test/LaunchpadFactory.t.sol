// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";

import {LaunchpadToken} from "../contracts/core/LaunchpadToken.sol";
import {BondingCurve} from "../contracts/core/BondingCurve.sol";
import {LaunchpadFactory} from "../contracts/core/LaunchpadFactory.sol";
import {FeeManager} from "../contracts/core/FeeManager.sol";
import {LiquidityLocker} from "../contracts/core/LiquidityLocker.sol";
import {LiquidityManager} from "../contracts/core/LiquidityManager.sol";
import {LaunchpadRouter} from "../contracts/router/LaunchpadRouter.sol";
import {ILaunchpadFactory} from "../contracts/interfaces/ILaunchpadFactory.sol";
import {ILaunchpadRouter} from "../contracts/interfaces/ILaunchpadRouter.sol";
import {IBondingCurve} from "../contracts/interfaces/IBondingCurve.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title LaunchpadFactoryTest
 * @notice Integration tests for the full launchpad system
 */
contract LaunchpadFactoryTest is Test {
    LaunchpadToken public tokenImpl;
    BondingCurve public curveImpl;
    LaunchpadFactory public factory;
    FeeManager public feeManager;
    LaunchpadRouter public router;
    LiquidityLocker public locker;

    address public owner;
    address public treasury;
    address public creator;
    address public buyer1;
    address public buyer2;

    // Mock DEX router for testing
    address public mockDexRouter;

    function setUp() public {
        owner = address(this);
        treasury = makeAddr("treasury");
        creator = makeAddr("creator");
        buyer1 = makeAddr("buyer1");
        buyer2 = makeAddr("buyer2");
        mockDexRouter = makeAddr("dexRouter");

        // Fund accounts
        vm.deal(creator, 10 ether);
        vm.deal(buyer1, 100 ether);
        vm.deal(buyer2, 100 ether);

        // Deploy implementations
        tokenImpl = new LaunchpadToken();
        curveImpl = new BondingCurve();

        // Deploy locker (with owner as emergency multisig for testing)
        locker = new LiquidityLocker(owner);

        // Deploy fee manager
        feeManager = new FeeManager(treasury);

        // Deploy factory
        factory = new LaunchpadFactory(address(tokenImpl), address(curveImpl));

        // Deploy router
        router = new LaunchpadRouter(address(factory), address(feeManager), address(0));

        // Configure factory
        factory.setRouter(address(router));
        factory.setFeeManager(address(feeManager));

        // Configure fee manager
        feeManager.setFactory(address(factory));
        feeManager.setRouter(address(router));

        // Skip past launch protection period (300 seconds) to avoid stricter limits during testing
        vm.warp(block.timestamp + 301);
    }

    function test_CreateToken() public {
        LaunchpadFactory.LaunchParams memory params = LaunchpadFactory.LaunchParams({
            name: "Test Token",
            symbol: "TEST",
            description: "A test token for the launchpad",
            imageURI: "https://example.com/image.png",
            twitter: "@testtoken",
            telegram: "t.me/testtoken",
            website: "https://testtoken.com"
        });

        (,,, uint256 creationFee) = feeManager.feeConfig();

        vm.prank(creator);
        (address token, address bondingCurve) = router.createToken{value: creationFee}(params);

        // Verify token created
        assertTrue(factory.isLaunchpadToken(token));
        assertEq(factory.getTokenCount(), 1);

        // Verify token properties
        LaunchpadToken tokenContract = LaunchpadToken(token);
        assertEq(tokenContract.name(), "Test Token");
        assertEq(tokenContract.symbol(), "TEST");
        assertEq(tokenContract.creator(), creator);
        assertEq(tokenContract.bondingCurve(), bondingCurve);
        assertFalse(tokenContract.isGraduated());

        // Verify launch info
        LaunchpadFactory.LaunchInfo memory info = factory.getLaunchInfo(token);
        assertEq(info.token, token);
        assertEq(info.bondingCurve, bondingCurve);
        assertEq(info.creator, creator);
        assertFalse(info.isGraduated);
    }

    function test_CreateTokenAndBuy() public {
        LaunchpadFactory.LaunchParams memory params = LaunchpadFactory.LaunchParams({
            name: "Buy Token",
            symbol: "BUY",
            description: "Token with initial buy",
            imageURI: "",
            twitter: "",
            telegram: "",
            website: ""
        });

        (,,, uint256 creationFee) = feeManager.feeConfig();
        uint256 buyAmount = 0.1 ether;  // Small buy to avoid anti-bot limits during launch protection

        vm.prank(creator);
        (address token,, uint256 tokensReceived) = router.createTokenAndBuy{value: creationFee + buyAmount}(
            params,
            0
        );

        // Creator should have tokens
        assertGt(tokensReceived, 0);
        assertEq(IERC20(token).balanceOf(creator), tokensReceived);
    }

    function test_BuyAndSellTokens() public {
        // Create token
        LaunchpadFactory.LaunchParams memory params = LaunchpadFactory.LaunchParams({
            name: "Trade Token",
            symbol: "TRADE",
            description: "",
            imageURI: "",
            twitter: "",
            telegram: "",
            website: ""
        });

        (,,, uint256 creationFee) = feeManager.feeConfig();

        vm.prank(creator);
        (address token,) = router.createToken{value: creationFee}(params);

        // Skip past launch protection period for new token
        vm.warp(block.timestamp + 301);

        // Buyer1 buys
        vm.prank(buyer1);
        uint256 tokens1 = router.buy{value: 1 ether}(
            LaunchpadRouter.SwapParams({
                token: token,
                amountIn: 1 ether,
                minAmountOut: 0,
                recipient: buyer1,
                deadline: block.timestamp + 1 hours
            })
        );

        assertGt(tokens1, 0);
        assertEq(IERC20(token).balanceOf(buyer1), tokens1);

        // Skip cooldown
        vm.warp(block.timestamp + 31);

        // Buyer1 sells half
        uint256 sellAmount = tokens1 / 2;
        uint256 balanceBefore = buyer1.balance;

        vm.prank(buyer1);
        IERC20(token).approve(address(router), sellAmount);

        vm.prank(buyer1);
        uint256 avaxOut = router.sell(
            LaunchpadRouter.SwapParams({
                token: token,
                amountIn: sellAmount,
                minAmountOut: 0,
                recipient: buyer1,
                deadline: block.timestamp + 1 hours
            })
        );

        assertGt(avaxOut, 0);
        assertEq(IERC20(token).balanceOf(buyer1), tokens1 - sellAmount);
        assertEq(buyer1.balance, balanceBefore + avaxOut);
    }

    function test_GetQuotes() public {
        // Create token
        LaunchpadFactory.LaunchParams memory params = LaunchpadFactory.LaunchParams({
            name: "Quote Token",
            symbol: "QUOTE",
            description: "",
            imageURI: "",
            twitter: "",
            telegram: "",
            website: ""
        });

        (,,, uint256 creationFee) = feeManager.feeConfig();

        vm.prank(creator);
        (address token,) = router.createToken{value: creationFee}(params);

        // Get buy quote
        (uint256 tokensOut, uint256 fee, uint256 priceImpact) = router.getQuoteBuy(token, 1 ether);

        assertGt(tokensOut, 0);
        assertGt(fee, 0);
        console.log("Buy quote - Tokens:", tokensOut);
        console.log("Buy quote - Fee:", fee);
        console.log("Buy quote - Price Impact:", priceImpact);
    }

    function test_MultipleTokenCreation() public {
        (,,, uint256 creationFee) = feeManager.feeConfig();

        for (uint256 i = 0; i < 5; i++) {
            LaunchpadFactory.LaunchParams memory params = LaunchpadFactory.LaunchParams({
                name: string(abi.encodePacked("Token ", vm.toString(i))),
                symbol: string(abi.encodePacked("TKN", vm.toString(i))),
                description: "",
                imageURI: "",
                twitter: "",
                telegram: "",
                website: ""
            });

            vm.prank(creator);
            router.createToken{value: creationFee}(params);
        }

        assertEq(factory.getTokenCount(), 5);
    }

    function test_CreatorFees() public {
        // Create token
        LaunchpadFactory.LaunchParams memory params = LaunchpadFactory.LaunchParams({
            name: "Fee Token",
            symbol: "FEE",
            description: "",
            imageURI: "",
            twitter: "",
            telegram: "",
            website: ""
        });

        (,,, uint256 creationFee) = feeManager.feeConfig();

        vm.prank(creator);
        (address token,) = router.createToken{value: creationFee}(params);

        // Skip past launch protection period
        vm.warp(block.timestamp + 301);

        // Buy tokens (generates fees)
        vm.prank(buyer1);
        router.buy{value: 1 ether}(
            LaunchpadRouter.SwapParams({
                token: token,
                amountIn: 1 ether,
                minAmountOut: 0,
                recipient: buyer1,
                deadline: block.timestamp + 1 hours
            })
        );

        // Check creator has pending fees
        uint256 pendingFees = feeManager.creatorPendingFees(creator);
        assertGt(pendingFees, 0);

        // Creator withdraws fees
        uint256 creatorBalanceBefore = creator.balance;

        vm.prank(creator);
        feeManager.withdrawCreatorFees(creator);

        assertEq(creator.balance, creatorBalanceBefore + pendingFees);
    }

    function test_Pause() public {
        // Pause factory
        factory.pause();

        LaunchpadFactory.LaunchParams memory params = LaunchpadFactory.LaunchParams({
            name: "Paused Token",
            symbol: "PAUSE",
            description: "",
            imageURI: "",
            twitter: "",
            telegram: "",
            website: ""
        });

        (,,, uint256 creationFee) = feeManager.feeConfig();

        // Should fail when paused
        vm.expectRevert();
        vm.prank(creator);
        factory.createToken{value: creationFee}(params);

        // Unpause
        factory.unpause();

        // Should work now
        vm.prank(creator);
        factory.createToken{value: creationFee}(params);
    }

    function test_TokensByCreator() public {
        (,,, uint256 creationFee) = feeManager.feeConfig();

        // Create multiple tokens
        for (uint256 i = 0; i < 3; i++) {
            LaunchpadFactory.LaunchParams memory params = LaunchpadFactory.LaunchParams({
                name: string(abi.encodePacked("Creator Token ", vm.toString(i))),
                symbol: string(abi.encodePacked("CT", vm.toString(i))),
                description: "",
                imageURI: "",
                twitter: "",
                telegram: "",
                website: ""
            });

            vm.prank(creator);
            router.createToken{value: creationFee}(params);
        }

        // Get tokens by creator
        address[] memory creatorTokens = factory.getTokensByCreator(creator);
        assertEq(creatorTokens.length, 3);
    }

    function test_RevertWhen_InvalidTokenName() public {
        LaunchpadFactory.LaunchParams memory params = LaunchpadFactory.LaunchParams({
            name: "",  // Empty name
            symbol: "TEST",
            description: "",
            imageURI: "",
            twitter: "",
            telegram: "",
            website: ""
        });

        (,,, uint256 creationFee) = feeManager.feeConfig();

        vm.expectRevert();
        vm.prank(creator);
        router.createToken{value: creationFee}(params);
    }

    function test_RevertWhen_InsufficientCreationFee() public {
        LaunchpadFactory.LaunchParams memory params = LaunchpadFactory.LaunchParams({
            name: "Test",
            symbol: "TEST",
            description: "",
            imageURI: "",
            twitter: "",
            telegram: "",
            website: ""
        });

        vm.expectRevert();
        vm.prank(creator);
        router.createToken{value: 0}(params);  // No fee
    }
}
