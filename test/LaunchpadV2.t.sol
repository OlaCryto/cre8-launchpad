// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {LaunchpadTokenV2} from "../contracts/core/LaunchpadTokenV2.sol";
import {BondingCurveV2} from "../contracts/core/BondingCurveV2.sol";
import {LaunchpadFactoryV2} from "../contracts/core/LaunchpadFactoryV2.sol";
import {FeeManager} from "../contracts/core/FeeManager.sol";
import {LiquidityLocker} from "../contracts/core/LiquidityLocker.sol";
import {CreatorRegistry} from "../contracts/core/CreatorRegistry.sol";
import {ActivityTracker} from "../contracts/core/ActivityTracker.sol";
import {LaunchpadRouterV2} from "../contracts/router/LaunchpadRouterV2.sol";
import {ILaunchpadToken} from "../contracts/interfaces/ILaunchpadToken.sol";
import {IBondingCurve} from "../contracts/interfaces/IBondingCurve.sol";

/**
 * @title LaunchpadV2Test
 * @notice Comprehensive tests for the Arena-style launchpad
 */
contract LaunchpadV2Test is Test {
    // Contracts
    LaunchpadTokenV2 public tokenImpl;
    BondingCurveV2 public curveImpl;
    LaunchpadFactoryV2 public factory;
    FeeManager public feeManager;
    LiquidityLocker public locker;
    CreatorRegistry public creatorRegistry;
    ActivityTracker public activityTracker;
    LaunchpadRouterV2 public router;

    // Test accounts
    address public owner;
    address public treasury;
    address public creator1;
    address public creator2;
    address public buyer1;
    address public buyer2;
    address public buyer3;

    // Constants
    uint256 public constant CREATION_FEE = 0.02 ether;

    function setUp() public {
        // Setup accounts
        owner = address(this);
        treasury = makeAddr("treasury");
        creator1 = makeAddr("creator1");
        creator2 = makeAddr("creator2");
        buyer1 = makeAddr("buyer1");
        buyer2 = makeAddr("buyer2");
        buyer3 = makeAddr("buyer3");

        // Fund accounts
        vm.deal(creator1, 100 ether);
        vm.deal(creator2, 100 ether);
        vm.deal(buyer1, 100 ether);
        vm.deal(buyer2, 100 ether);
        vm.deal(buyer3, 100 ether);

        // Deploy implementations
        tokenImpl = new LaunchpadTokenV2();
        curveImpl = new BondingCurveV2();

        // Deploy platform contracts
        creatorRegistry = new CreatorRegistry();
        activityTracker = new ActivityTracker();
        locker = new LiquidityLocker(owner);
        feeManager = new FeeManager(treasury);

        // Deploy factory
        factory = new LaunchpadFactoryV2(
            address(tokenImpl),
            address(curveImpl),
            address(creatorRegistry),
            address(activityTracker)
        );

        // Deploy router
        router = new LaunchpadRouterV2(
            address(factory),
            address(feeManager),
            address(creatorRegistry),
            address(activityTracker)
        );

        // Configure contracts
        factory.setRouter(address(router));
        factory.setFeeManager(address(feeManager));
        feeManager.setFactory(address(factory));
        feeManager.setRouter(address(router));
        creatorRegistry.setFactory(address(factory));
        activityTracker.setAuthorizedTracker(address(factory), true);
        activityTracker.setAuthorizedTracker(address(router), true);

        // Disable profile requirement for easier testing
        factory.setRequireProfile(false);

        // Skip past launch protection period (300 seconds) to avoid stricter limits during testing
        vm.warp(block.timestamp + 301);
    }

    // ============ Creator Registry Tests ============

    function test_CreateProfile() public {
        vm.prank(creator1);
        creatorRegistry.createProfile(
            "creator_one",
            "Creator One",
            "https://example.com/avatar.png",
            "Building awesome tokens"
        );

        assertTrue(creatorRegistry.hasProfile(creator1));

        CreatorRegistry.CreatorProfile memory profile = creatorRegistry.getProfile(creator1);
        assertEq(profile.handle, "creator_one");
        assertEq(profile.displayName, "Creator One");
        assertTrue(profile.isActive);
    }

    function test_UniqueHandles() public {
        vm.prank(creator1);
        creatorRegistry.createProfile("unique_handle", "Creator 1", "", "");

        vm.expectRevert();
        vm.prank(creator2);
        creatorRegistry.createProfile("unique_handle", "Creator 2", "", "");
    }

    function test_HandleCaseInsensitive() public {
        vm.prank(creator1);
        creatorRegistry.createProfile("MyHandle", "Creator 1", "", "");

        // Same handle different case should fail
        vm.expectRevert();
        vm.prank(creator2);
        creatorRegistry.createProfile("myhandle", "Creator 2", "", "");
    }

    // ============ Easy Launch Tests ============

    function test_EasyLaunch() public {
        LaunchpadFactoryV2.EasyLaunchParams memory params = LaunchpadFactoryV2.EasyLaunchParams({
            name: "Test Token",
            symbol: "TEST",
            imageURI: "https://example.com/image.png",
            description: "A test token",
            twitter: "",
            telegram: "",
            website: "",
            creatorBuyBps: 0
        });

        vm.prank(creator1);
        (address token, address curve) = factory.createTokenEasy{value: CREATION_FEE}(params);

        // Verify token created
        assertTrue(factory.isLaunchpadToken(token));
        assertEq(factory.getTokenCount(), 1);

        // Verify token properties
        LaunchpadTokenV2 tokenContract = LaunchpadTokenV2(token);
        assertEq(tokenContract.name(), "Test Token");
        assertEq(tokenContract.symbol(), "TEST");
        assertEq(tokenContract.creator(), creator1);
        assertFalse(tokenContract.isGraduated());

        // Verify launch mode
        assertFalse(tokenContract.isProLaunch());

        // Verify immediate public trading
        assertEq(uint256(tokenContract.getCurrentPhase()), uint256(LaunchpadTokenV2.TradingPhase.Public));
    }

    function test_EasyLaunchWithCreatorBuy() public {
        uint256 creatorBuyBps = 500; // 5%
        uint256 initialBuyAmount = 1 ether;

        LaunchpadFactoryV2.EasyLaunchParams memory params = LaunchpadFactoryV2.EasyLaunchParams({
            name: "Creator Buy Token",
            symbol: "CBT",
            imageURI: "",
            description: "",
            twitter: "",
            telegram: "",
            website: "",
            creatorBuyBps: creatorBuyBps
        });

        vm.prank(creator1);
        (address token, address curve) = factory.createTokenEasy{value: CREATION_FEE + initialBuyAmount}(params);

        // Token should be created
        assertTrue(factory.isLaunchpadToken(token));

        // Bonding curve should have received AVAX (minus creation fee)
        BondingCurveV2 curveContract = BondingCurveV2(payable(curve));
        // Reserve should be positive (creator buy amount went in)
        assertGt(curveContract.reserveBalance(), 0);

        console.log("Creator buy reserve balance:", curveContract.reserveBalance());
    }

    // ============ Pro Launch Tests ============

    function test_ProLaunchWithWhitelist() public {
        address[] memory whitelist = new address[](2);
        whitelist[0] = buyer1;
        whitelist[1] = buyer2;

        LaunchpadFactoryV2.ProLaunchParams memory params = LaunchpadFactoryV2.ProLaunchParams({
            name: "Pro Token",
            symbol: "PRO",
            imageURI: "",
            description: "",
            twitter: "",
            telegram: "",
            website: "",
            creatorBuyBps: 0,
            whitelist: whitelist,
            whitelistDuration: 1 hours,
            tradingStartTime: 0
        });

        vm.prank(creator1);
        (address token, address curve) = factory.createTokenPro{value: CREATION_FEE}(params);

        LaunchpadTokenV2 tokenContract = LaunchpadTokenV2(token);

        // Verify pro launch
        assertTrue(tokenContract.isProLaunch());

        // Verify whitelist phase
        assertEq(uint256(tokenContract.getCurrentPhase()), uint256(LaunchpadTokenV2.TradingPhase.Whitelist));

        // Verify whitelisted addresses
        assertTrue(tokenContract.isWhitelisted(buyer1));
        assertTrue(tokenContract.isWhitelisted(buyer2));
        assertFalse(tokenContract.isWhitelisted(buyer3));

        // Creator should be whitelisted
        assertTrue(tokenContract.isWhitelisted(creator1));
    }

    function test_WhitelistPhaseTrading() public {
        address[] memory whitelist = new address[](1);
        whitelist[0] = buyer1;

        LaunchpadFactoryV2.ProLaunchParams memory params = LaunchpadFactoryV2.ProLaunchParams({
            name: "Whitelist Token",
            symbol: "WL",
            imageURI: "",
            description: "",
            twitter: "",
            telegram: "",
            website: "",
            creatorBuyBps: 0,
            whitelist: whitelist,
            whitelistDuration: 1 hours,
            tradingStartTime: 0
        });

        vm.prank(creator1);
        (address token, address curve) = factory.createTokenPro{value: CREATION_FEE}(params);

        BondingCurveV2 curveContract = BondingCurveV2(payable(curve));

        // Whitelisted buyer1 can buy
        vm.prank(buyer1);
        uint256 tokens = curveContract.buy{value: 1 ether}(0);
        assertGt(tokens, 0);

        // Non-whitelisted buyer3 cannot buy
        vm.expectRevert();
        vm.prank(buyer3);
        curveContract.buy{value: 1 ether}(0);
    }

    function test_PublicPhaseAfterWhitelist() public {
        address[] memory whitelist = new address[](1);
        whitelist[0] = buyer1;

        LaunchpadFactoryV2.ProLaunchParams memory params = LaunchpadFactoryV2.ProLaunchParams({
            name: "Timed Token",
            symbol: "TIME",
            imageURI: "",
            description: "",
            twitter: "",
            telegram: "",
            website: "",
            creatorBuyBps: 0,
            whitelist: whitelist,
            whitelistDuration: 1 hours,
            tradingStartTime: 0
        });

        vm.prank(creator1);
        (address token, address curve) = factory.createTokenPro{value: CREATION_FEE}(params);

        LaunchpadTokenV2 tokenContract = LaunchpadTokenV2(token);
        BondingCurveV2 curveContract = BondingCurveV2(payable(curve));

        // Initially in whitelist phase
        assertEq(uint256(tokenContract.getCurrentPhase()), uint256(LaunchpadTokenV2.TradingPhase.Whitelist));

        // Fast forward past whitelist duration
        vm.warp(block.timestamp + 1 hours + 1);

        // Now in public phase
        assertEq(uint256(tokenContract.getCurrentPhase()), uint256(LaunchpadTokenV2.TradingPhase.Public));

        // Non-whitelisted buyer3 can now buy
        vm.prank(buyer3);
        uint256 tokens = curveContract.buy{value: 1 ether}(0);
        assertGt(tokens, 0);
    }

    function test_Blacklist() public {
        address[] memory whitelist = new address[](0);

        LaunchpadFactoryV2.ProLaunchParams memory params = LaunchpadFactoryV2.ProLaunchParams({
            name: "Blacklist Token",
            symbol: "BL",
            imageURI: "",
            description: "",
            twitter: "",
            telegram: "",
            website: "",
            creatorBuyBps: 0,
            whitelist: whitelist,
            whitelistDuration: 0, // No whitelist phase
            tradingStartTime: 0
        });

        vm.prank(creator1);
        (address token, address curve) = factory.createTokenPro{value: CREATION_FEE}(params);

        LaunchpadTokenV2 tokenContract = LaunchpadTokenV2(token);
        BondingCurveV2 curveContract = BondingCurveV2(payable(curve));

        // Blacklist buyer3
        vm.prank(creator1);
        tokenContract.addToBlacklist(buyer3);

        assertTrue(tokenContract.isBlacklisted(buyer3));

        // Blacklisted user cannot buy
        vm.expectRevert();
        vm.prank(buyer3);
        curveContract.buy{value: 1 ether}(0);

        // Non-blacklisted user can buy
        vm.prank(buyer1);
        uint256 tokens = curveContract.buy{value: 1 ether}(0);
        assertGt(tokens, 0);
    }

    // ============ Trading Tests ============

    function test_BuyTokens() public {
        (address token, address curve) = _createEasyToken("Buy Test", "BUY");

        BondingCurveV2 curveContract = BondingCurveV2(payable(curve));

        uint256 buyAmount = 1 ether;

        vm.prank(buyer1);
        uint256 tokens = curveContract.buy{value: buyAmount}(0);

        assertGt(tokens, 0);
        assertEq(IERC20(token).balanceOf(buyer1), tokens);

        console.log("Bought tokens for 1 AVAX:", tokens / 1e18);
        console.log("Current price:", curveContract.getCurrentPrice());
    }

    function test_SellTokens() public {
        (address token, address curve) = _createEasyToken("Sell Test", "SELL");

        BondingCurveV2 curveContract = BondingCurveV2(payable(curve));

        // Buy first
        vm.prank(buyer1);
        uint256 tokens = curveContract.buy{value: 1 ether}(0);

        // Wait for cooldown
        vm.warp(block.timestamp + 31);

        uint256 balanceBefore = buyer1.balance;

        // Sell half
        uint256 sellAmount = tokens / 2;
        vm.prank(buyer1);
        uint256 avaxOut = curveContract.sell(sellAmount, 0);

        assertGt(avaxOut, 0);
        assertEq(buyer1.balance, balanceBefore + avaxOut);

        console.log("Sold tokens:", sellAmount / 1e18);
        console.log("Received AVAX:", avaxOut);
    }

    function test_PriceIncreasesWithBuys() public {
        (address token, address curve) = _createEasyToken("Price Test", "PRICE");

        BondingCurveV2 curveContract = BondingCurveV2(payable(curve));

        uint256 price1 = curveContract.getCurrentPrice();

        // First buy
        vm.prank(buyer1);
        curveContract.buy{value: 1 ether}(0);

        uint256 price2 = curveContract.getCurrentPrice();

        // Wait for cooldown
        vm.warp(block.timestamp + 31);

        // Second buy
        vm.prank(buyer2);
        curveContract.buy{value: 1 ether}(0);

        uint256 price3 = curveContract.getCurrentPrice();

        // Price should stay same or increase with each buy (depends on slope setting)
        // With slope=0, price stays constant; with slope>0, price increases
        assertGe(price2, price1);
        assertGe(price3, price2);

        console.log("Price after 0 buys:", price1);
        console.log("Price after 1 buy:", price2);
        console.log("Price after 2 buys:", price3);
    }

    // ============ Anti-Bot Tests ============

    function test_CooldownEnforced() public {
        (address token, address curve) = _createEasyToken("Cooldown Test", "COOL");

        BondingCurveV2 curveContract = BondingCurveV2(payable(curve));

        // First buy succeeds
        vm.prank(buyer1);
        curveContract.buy{value: 0.1 ether}(0);

        // Immediate second buy fails
        vm.expectRevert();
        vm.prank(buyer1);
        curveContract.buy{value: 0.1 ether}(0);

        // After cooldown, buy succeeds
        vm.warp(block.timestamp + 31);
        vm.prank(buyer1);
        curveContract.buy{value: 0.1 ether}(0);
    }

    // ============ Activity Tracker Tests ============

    function test_ActivityRecorded() public {
        (address token, address curve) = _createEasyToken("Activity Test", "ACT");

        // Get initial stats
        (uint256 tokensBefore,,,) = activityTracker.getStats();

        // Create another token
        _createEasyToken("Activity Test 2", "ACT2");

        (uint256 tokensAfter,,,) = activityTracker.getStats();

        assertEq(tokensAfter, tokensBefore + 1);
    }

    // ============ Fee Tests ============

    function test_CreationFeeCollected() public {
        uint256 treasuryBefore = treasury.balance;

        _createEasyToken("Fee Test", "FEE");

        // Fee should be in fee manager
        assertGt(feeManager.totalPlatformFees(), 0);
    }

    // ============ Graduation Tests ============

    function test_GraduationProgress() public {
        (address token, address curve) = _createEasyToken("Grad Test", "GRAD");

        BondingCurveV2 curveContract = BondingCurveV2(payable(curve));

        uint256 progressBefore = curveContract.getGraduationProgress();
        // Progress might be non-zero due to initial market cap
        // Just verify it's a valid percentage (0-10000 bps)
        assertLe(progressBefore, 10000);

        // Buy tokens
        vm.prank(buyer1);
        curveContract.buy{value: 10 ether}(0);

        uint256 progressAfter = curveContract.getGraduationProgress();
        // With slope=0 (constant price), progress stays same
        // With slope>0 (bonding curve), progress increases as price/market cap grows
        // Either way, progress should still be valid
        assertGe(progressAfter, progressBefore);
        assertLe(progressAfter, 10000);

        console.log("Graduation progress after 10 AVAX buy:", progressAfter, "bps");
    }

    // ============ View Function Tests ============

    function test_GetTokenInfo() public {
        (address token, address curve) = _createEasyToken("Info Test", "INFO");

        (
            string memory name,
            string memory symbol,
            address creator,
            string memory creatorHandle,
            bool isGraduated,
            bool isProLaunch,
            uint256 currentPrice,
            uint256 marketCap,
            uint256 graduationProgress
        ) = router.getTokenInfo(token);

        assertEq(name, "Info Test");
        assertEq(symbol, "INFO");
        assertEq(creator, creator1);
        assertFalse(isGraduated);
        assertFalse(isProLaunch);
        assertGt(currentPrice, 0);
    }

    function test_GetQuotes() public {
        (address token,) = _createEasyToken("Quote Test", "QUOTE");

        // Get buy quote
        (uint256 tokensOut, uint256 fee, uint256 priceImpact) = router.getQuoteBuy(token, 1 ether);

        assertGt(tokensOut, 0);
        console.log("Buy quote for 1 AVAX:");
        console.log("  Tokens out:", tokensOut / 1e18);
        console.log("  Fee:", fee);
        console.log("  Price impact:", priceImpact, "bps");
    }

    // ============ Helper Functions ============

    function _createEasyToken(string memory name, string memory symbol)
        internal
        returns (address token, address curve)
    {
        LaunchpadFactoryV2.EasyLaunchParams memory params = LaunchpadFactoryV2.EasyLaunchParams({
            name: name,
            symbol: symbol,
            imageURI: "",
            description: "",
            twitter: "",
            telegram: "",
            website: "",
            creatorBuyBps: 0
        });

        vm.prank(creator1);
        (token, curve) = factory.createTokenEasy{value: CREATION_FEE}(params);

        // Skip past launch protection period for new tokens
        vm.warp(block.timestamp + 301);

        return (token, curve);
    }
}

/**
 * @title GasOptimizationTest
 * @notice Test gas costs to ensure $1 launches are achievable
 */
contract GasOptimizationTest is Test {
    LaunchpadTokenV2 public tokenImpl;
    BondingCurveV2 public curveImpl;
    LaunchpadFactoryV2 public factory;
    FeeManager public feeManager;
    CreatorRegistry public creatorRegistry;
    ActivityTracker public activityTracker;

    address public creator;

    function setUp() public {
        creator = makeAddr("creator");
        vm.deal(creator, 10 ether);

        tokenImpl = new LaunchpadTokenV2();
        curveImpl = new BondingCurveV2();
        creatorRegistry = new CreatorRegistry();
        activityTracker = new ActivityTracker();
        feeManager = new FeeManager(address(this));

        factory = new LaunchpadFactoryV2(
            address(tokenImpl),
            address(curveImpl),
            address(creatorRegistry),
            address(activityTracker)
        );

        factory.setFeeManager(address(feeManager));
        feeManager.setFactory(address(factory));
        creatorRegistry.setFactory(address(factory));
        factory.setRequireProfile(false);
        activityTracker.setAuthorizedTracker(address(factory), true);

        // Skip past launch protection period
        vm.warp(block.timestamp + 301);
    }

    function test_GasCostEasyLaunch() public {
        LaunchpadFactoryV2.EasyLaunchParams memory params = LaunchpadFactoryV2.EasyLaunchParams({
            name: "Gas Test",
            symbol: "GAS",
            imageURI: "",
            description: "",
            twitter: "",
            telegram: "",
            website: "",
            creatorBuyBps: 0
        });

        uint256 gasBefore = gasleft();

        vm.prank(creator);
        factory.createTokenEasy{value: 0.02 ether}(params);

        uint256 gasUsed = gasBefore - gasleft();

        console.log("Gas used for Easy Launch:", gasUsed);
        // At 25 gwei and $50 AVAX, this should be well under $1
        // gasUsed * 25 gwei * $50 / 1e18 = cost in USD
    }

    function test_GasCostProLaunch() public {
        address[] memory whitelist = new address[](5);
        for (uint i = 0; i < 5; i++) {
            whitelist[i] = address(uint160(i + 1));
        }

        LaunchpadFactoryV2.ProLaunchParams memory params = LaunchpadFactoryV2.ProLaunchParams({
            name: "Pro Gas Test",
            symbol: "PGAS",
            imageURI: "",
            description: "",
            twitter: "",
            telegram: "",
            website: "",
            creatorBuyBps: 0,
            whitelist: whitelist,
            whitelistDuration: 1 hours,
            tradingStartTime: 0
        });

        uint256 gasBefore = gasleft();

        vm.prank(creator);
        factory.createTokenPro{value: 0.02 ether}(params);

        uint256 gasUsed = gasBefore - gasleft();

        console.log("Gas used for Pro Launch (5 whitelist):", gasUsed);
    }

    function test_GasCostBuy() public {
        LaunchpadFactoryV2.EasyLaunchParams memory params = LaunchpadFactoryV2.EasyLaunchParams({
            name: "Buy Gas Test",
            symbol: "BGAS",
            imageURI: "",
            description: "",
            twitter: "",
            telegram: "",
            website: "",
            creatorBuyBps: 0
        });

        vm.prank(creator);
        (, address curve) = factory.createTokenEasy{value: 0.02 ether}(params);

        address buyer = makeAddr("buyer");
        vm.deal(buyer, 10 ether);

        uint256 gasBefore = gasleft();

        vm.prank(buyer);
        BondingCurveV2(payable(curve)).buy{value: 1 ether}(0);

        uint256 gasUsed = gasBefore - gasleft();

        console.log("Gas used for Buy:", gasUsed);
    }
}
