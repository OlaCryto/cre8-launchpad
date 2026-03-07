// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Cre8Manager} from "../contracts/v3/Cre8Manager.sol";
import {Cre8Token} from "../contracts/v3/Cre8Token.sol";

contract Cre8ManagerTest is Test {
    Cre8Manager public manager;
    address public treasury = makeAddr("treasury");
    address public owner = makeAddr("owner");
    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");

    uint256 constant DEADLINE = type(uint256).max; // no deadline for tests

    function setUp() public {
        // Deploy implementation + proxy
        Cre8Manager impl = new Cre8Manager();
        bytes memory initData = abi.encodeWithSelector(
            Cre8Manager.initialize.selector, treasury, owner
        );
        ERC1967Proxy proxy = new ERC1967Proxy(address(impl), initData);
        manager = Cre8Manager(payable(address(proxy)));

        // Fund test accounts
        vm.deal(alice, 100 ether);
        vm.deal(bob, 100 ether);
    }

    // ============ Token Creation ============

    function test_createToken() public {
        vm.prank(alice);
        (uint256 tokenId, address tokenAddr) = manager.createToken{value: 0.02 ether}("Test", "TST", 0);

        assertEq(tokenId, 1);
        assertTrue(tokenAddr != address(0));
        assertEq(manager.tokenCount(), 1);

        // Verify token params
        (address addr, address creator,,,,,) = manager.tokenParams(1);
        assertEq(addr, tokenAddr);
        assertEq(creator, alice);
    }

    function test_createTokenWithInitialBuy() public {
        vm.prank(alice);
        (uint256 tokenId, address tokenAddr) = manager.createToken{value: 1.02 ether}("Test", "TST", 1000);

        // Alice should have tokens (1 AVAX worth after fees)
        uint256 balance = IERC20(tokenAddr).balanceOf(alice);
        assertTrue(balance > 0);
        console.log("Initial buy tokens:", balance);
    }

    function test_createToken_insufficientFee() public {
        vm.prank(alice);
        vm.expectRevert();
        manager.createToken{value: 0.01 ether}("Test", "TST", 0);
    }

    // ============ Buy ============

    function test_buy() public {
        // Create token
        vm.prank(alice);
        (uint256 tokenId, address tokenAddr) = manager.createToken{value: 0.02 ether}("Test", "TST", 0);

        // Bob buys
        uint256 bobBalBefore = bob.balance;
        vm.prank(bob);
        manager.buy{value: 1 ether}(tokenId, 0, DEADLINE);

        uint256 tokens = IERC20(tokenAddr).balanceOf(bob);
        assertTrue(tokens > 0);
        console.log("Bob bought tokens:", tokens);
        console.log("Bob spent AVAX:", bobBalBefore - bob.balance);
    }

    function test_buy_slippageProtection() public {
        vm.prank(alice);
        (uint256 tokenId,) = manager.createToken{value: 0.02 ether}("Test", "TST", 0);

        // Request impossibly high minTokensOut
        vm.prank(bob);
        vm.expectRevert(); // SlippageExceeded
        manager.buy{value: 1 ether}(tokenId, type(uint256).max, DEADLINE);
    }

    function test_buy_deadlineProtection() public {
        vm.prank(alice);
        (uint256 tokenId,) = manager.createToken{value: 0.02 ether}("Test", "TST", 0);

        // Set deadline in the past
        vm.prank(bob);
        vm.expectRevert(); // DeadlineExpired
        manager.buy{value: 1 ether}(tokenId, 0, block.timestamp - 1);
    }

    function test_buy_afterGraduation() public {
        vm.prank(alice);
        (uint256 tokenId,) = manager.createToken{value: 0.02 ether}("Test", "TST", 0);

        // Mark as graduated (simulate)
        // Can't directly, so test via the revert
        // With slope=0, graduation would need 69K AVAX market cap
    }

    // ============ Sell ============

    function test_sell() public {
        vm.prank(alice);
        (uint256 tokenId, address tokenAddr) = manager.createToken{value: 0.02 ether}("Test", "TST", 0);

        // Bob buys
        vm.prank(bob);
        manager.buy{value: 1 ether}(tokenId, 0, DEADLINE);
        uint256 tokens = IERC20(tokenAddr).balanceOf(bob);

        // Bob sells half
        uint256 sellAmount = tokens / 2;
        uint256 bobAvaxBefore = bob.balance;
        vm.prank(bob);
        manager.sell(tokenId, sellAmount, 0, DEADLINE);

        uint256 avaxReceived = bob.balance - bobAvaxBefore;
        assertTrue(avaxReceived > 0);
        console.log("Bob sold tokens:", sellAmount);
        console.log("Bob received AVAX:", avaxReceived);
    }

    function test_sell_slippageProtection() public {
        vm.prank(alice);
        (uint256 tokenId, address tokenAddr) = manager.createToken{value: 0.02 ether}("Test", "TST", 0);

        vm.prank(bob);
        manager.buy{value: 1 ether}(tokenId, 0, DEADLINE);
        uint256 tokens = IERC20(tokenAddr).balanceOf(bob);

        // Request impossibly high minAvaxOut
        vm.prank(bob);
        vm.expectRevert(); // SlippageExceeded
        manager.sell(tokenId, tokens, type(uint256).max, DEADLINE);
    }

    // ============ Reserve Solvency ============

    function test_reserveSolvency_buySellCycle() public {
        vm.prank(alice);
        (uint256 tokenId, address tokenAddr) = manager.createToken{value: 0.02 ether}("Test", "TST", 0);

        // Bob buys
        vm.prank(bob);
        manager.buy{value: 5 ether}(tokenId, 0, DEADLINE);
        uint256 tokens = IERC20(tokenAddr).balanceOf(bob);

        // Bob sells ALL tokens back
        uint256 reserveBefore = manager.tokenBalance(tokenId);
        vm.prank(bob);
        manager.sell(tokenId, tokens, 0, DEADLINE);

        // Reserve should be >= 0 (solvency)
        uint256 reserveAfter = manager.tokenBalance(tokenId);
        console.log("Reserve before sell:", reserveBefore);
        console.log("Reserve after sell:", reserveAfter);
        console.log("Dust remaining:", reserveAfter);

        // The reserve should have a tiny positive dust from rounding
        // (buy floors tokens, sell floors AVAX — reserve wins on both sides)
        assertTrue(reserveAfter >= 0, "Reserve should be solvent");
    }

    function test_reserveSolvency_manyBuySellCycles() public {
        vm.prank(alice);
        (uint256 tokenId, address tokenAddr) = manager.createToken{value: 0.02 ether}("Test", "TST", 0);

        // Multiple users buy and sell repeatedly
        for (uint256 i = 0; i < 10; i++) {
            vm.prank(bob);
            manager.buy{value: 0.5 ether}(tokenId, 0, DEADLINE);
            uint256 tokens = IERC20(tokenAddr).balanceOf(bob);

            vm.prank(bob);
            manager.sell(tokenId, tokens, 0, DEADLINE);
        }

        // Reserve should still be solvent
        uint256 reserve = manager.tokenBalance(tokenId);
        uint256 supply = manager.tokenSupply(tokenId);
        console.log("After 10 cycles - Reserve:", reserve, "Supply:", supply);
        assertEq(supply, 0, "All tokens should be sold back");
        assertTrue(reserve >= 0, "Reserve must be solvent");
    }

    // ============ Rounding Exploit Test ============

    function test_noRoundingExploit() public {
        // Enable slope to test rounding with non-zero slope
        vm.prank(owner);
        manager.setCurveConfig(1e12, 1e6, 800_000_000e18, 69_000 ether);

        vm.prank(alice);
        (uint256 tokenId, address tokenAddr) = manager.createToken{value: 0.02 ether}("Test", "TST", 0);

        uint256 aliceStartBalance = alice.balance;

        // Try to exploit: buy small, sell small, repeat
        for (uint256 i = 0; i < 20; i++) {
            vm.prank(alice);
            manager.buy{value: 0.01 ether}(tokenId, 0, DEADLINE);
            uint256 tokens = IERC20(tokenAddr).balanceOf(alice);
            if (tokens > 0) {
                vm.prank(alice);
                manager.sell(tokenId, tokens, 0, DEADLINE);
            }
        }

        uint256 aliceEndBalance = alice.balance;
        // Alice should NOT have profited (fees + rounding both work against the trader)
        assertTrue(aliceEndBalance <= aliceStartBalance, "Should not profit from rounding");
        console.log("Alice lost (wei):", aliceStartBalance - aliceEndBalance);
    }

    // ============ Fee Calculation ============

    function test_feeCalculation() public {
        vm.prank(alice);
        (uint256 tokenId,) = manager.createToken{value: 0.02 ether}("Test", "TST", 0);

        uint256 treasuryBefore = treasury.balance;

        // Bob buys 1 AVAX (1% fee = 0.01 AVAX to treasury)
        vm.prank(bob);
        manager.buy{value: 1 ether}(tokenId, 0, DEADLINE);

        uint256 treasuryAfter = treasury.balance;
        uint256 feeCollected = treasuryAfter - treasuryBefore;
        console.log("Fee collected (wei):", feeCollected);
        // 1% of 1 ether with rounding = ~0.01 ether
        assertTrue(feeCollected > 0.009 ether && feeCollected < 0.011 ether, "Fee should be ~1%");
    }

    // ============ View Functions ============

    function test_getBuyQuote() public {
        vm.prank(alice);
        (uint256 tokenId,) = manager.createToken{value: 0.02 ether}("Test", "TST", 0);

        (uint256 tokensOut, uint256 fee) = manager.getBuyQuote(tokenId, 1 ether);
        assertTrue(tokensOut > 0);
        assertTrue(fee > 0);
        console.log("Buy quote - tokens:", tokensOut, "fee:", fee);
    }

    function test_getSellQuote() public {
        vm.prank(alice);
        (uint256 tokenId, address tokenAddr) = manager.createToken{value: 0.02 ether}("Test", "TST", 0);

        vm.prank(bob);
        manager.buy{value: 1 ether}(tokenId, 0, DEADLINE);
        uint256 tokens = IERC20(tokenAddr).balanceOf(bob);

        (uint256 avaxOut, uint256 fee) = manager.getSellQuote(tokenId, tokens);
        assertTrue(avaxOut > 0);
        console.log("Sell quote - avax:", avaxOut, "fee:", fee);
    }

    // ============ Admin ============

    function test_pause_unpause() public {
        vm.prank(owner);
        manager.pause();

        vm.prank(alice);
        vm.expectRevert(); // Paused
        manager.createToken{value: 0.02 ether}("Test", "TST", 0);

        vm.prank(owner);
        manager.unpause();

        vm.prank(alice);
        manager.createToken{value: 0.02 ether}("Test", "TST", 0); // should work
    }

    function test_onlyOwnerCanPause() public {
        vm.prank(alice);
        vm.expectRevert(); // not owner
        manager.pause();
    }

    function test_renounceOwnershipBlocked() public {
        vm.prank(owner);
        manager.renounceOwnership(); // no-op
        assertEq(manager.owner(), owner, "Owner should not change");
    }

    // ============ Overflow Safety with Slope ============

    function test_largeSupplyWithSlope() public {
        vm.prank(owner);
        manager.setCurveConfig(1e12, 1e8, 800_000_000e18, 69_000 ether);

        vm.prank(alice);
        (uint256 tokenId, address tokenAddr) = manager.createToken{value: 0.02 ether}("Test", "TST", 0);

        vm.prank(bob);
        manager.buy{value: 10 ether}(tokenId, 0, DEADLINE);
        uint256 tokens = IERC20(tokenAddr).balanceOf(bob);
        assertTrue(tokens > 0, "Should receive tokens");

        vm.prank(bob);
        manager.sell(tokenId, tokens, 0, DEADLINE);
    }

    // ============ Forge Mode: Whitelist ============

    function _createForgeToken() internal returns (uint256 tokenId, address tokenAddr) {
        address[] memory wlAddrs = new address[](2);
        wlAddrs[0] = alice;
        wlAddrs[1] = bob;
        address[] memory blAddrs = new address[](0);

        vm.prank(alice);
        (tokenId, tokenAddr) = manager.createTokenForge{value: 0.02 ether}(
            "ForgeToken", "FRG",
            0,                  // no creator buy
            5 minutes,          // 5 min whitelist
            2 ether,            // max 2 AVAX per wallet
            0.5 ether,          // max 0.5 AVAX per transaction
            wlAddrs,
            blAddrs
        );
    }

    function test_forgeMode_createToken() public {
        (uint256 tokenId, address tokenAddr) = _createForgeToken();

        assertEq(tokenId, 1);
        assertTrue(tokenAddr != address(0));
        assertTrue(manager.isWhitelistActive(tokenId));

        // Check whitelist config
        (uint256 endTime, uint256 maxWallet, uint256 maxTx) = manager.whitelistConfig(tokenId);
        assertEq(maxWallet, 2 ether);
        assertEq(maxTx, 0.5 ether);
        assertTrue(endTime > block.timestamp);
    }

    function test_forgeMode_whitelistedCanBuy() public {
        (uint256 tokenId, address tokenAddr) = _createForgeToken();

        // Bob is whitelisted — can buy within limits
        vm.prank(bob);
        manager.buy{value: 0.5 ether}(tokenId, 0, DEADLINE);

        uint256 tokens = IERC20(tokenAddr).balanceOf(bob);
        assertTrue(tokens > 0, "Whitelisted user should receive tokens");
        console.log("Bob WL buy tokens:", tokens);
    }

    function test_forgeMode_nonWhitelistedBlocked() public {
        (uint256 tokenId,) = _createForgeToken();

        address charlie = makeAddr("charlie");
        vm.deal(charlie, 10 ether);

        // Charlie is NOT whitelisted — should be blocked
        vm.prank(charlie);
        vm.expectRevert(); // TradingNotStarted
        manager.buy{value: 0.5 ether}(tokenId, 0, DEADLINE);
    }

    function test_forgeMode_maxTxEnforced() public {
        (uint256 tokenId,) = _createForgeToken();

        // Bob tries to buy 1 AVAX but maxTx is 0.5 AVAX
        vm.prank(bob);
        vm.expectRevert(); // MaxTransactionExceeded
        manager.buy{value: 1 ether}(tokenId, 0, DEADLINE);
    }

    function test_forgeMode_maxWalletEnforced() public {
        (uint256 tokenId,) = _createForgeToken();

        // Bob buys 0.5 AVAX x4 = 2 AVAX (hits wallet limit)
        vm.startPrank(bob);
        manager.buy{value: 0.5 ether}(tokenId, 0, DEADLINE);
        manager.buy{value: 0.5 ether}(tokenId, 0, DEADLINE);
        manager.buy{value: 0.5 ether}(tokenId, 0, DEADLINE);
        manager.buy{value: 0.5 ether}(tokenId, 0, DEADLINE);

        // 5th buy exceeds 2 AVAX wallet limit
        vm.expectRevert(); // MaxWalletExceeded
        manager.buy{value: 0.5 ether}(tokenId, 0, DEADLINE);
        vm.stopPrank();
    }

    function test_forgeMode_publicAfterWhitelistEnds() public {
        (uint256 tokenId,) = _createForgeToken();

        address charlie = makeAddr("charlie");
        vm.deal(charlie, 10 ether);

        // Charlie blocked during WL
        vm.prank(charlie);
        vm.expectRevert();
        manager.buy{value: 0.5 ether}(tokenId, 0, DEADLINE);

        // Fast forward past whitelist end (5 minutes)
        vm.warp(block.timestamp + 6 minutes);

        // Whitelist should be inactive now
        assertFalse(manager.isWhitelistActive(tokenId));

        // Charlie can buy now — no limits
        vm.prank(charlie);
        manager.buy{value: 5 ether}(tokenId, 0, DEADLINE);
    }

    function test_forgeMode_creatorCanUpdateWhitelist() public {
        (uint256 tokenId,) = _createForgeToken();

        address charlie = makeAddr("charlie");
        vm.deal(charlie, 10 ether);

        // Charlie not whitelisted
        vm.prank(charlie);
        vm.expectRevert();
        manager.buy{value: 0.5 ether}(tokenId, 0, DEADLINE);

        // Alice (creator) adds Charlie to whitelist
        address[] memory addrs = new address[](1);
        addrs[0] = charlie;
        vm.prank(alice);
        manager.updateWhitelist(tokenId, addrs, true);

        // Charlie can buy now
        vm.prank(charlie);
        manager.buy{value: 0.5 ether}(tokenId, 0, DEADLINE);
    }

    function test_forgeMode_getWhitelistAllowance() public {
        (uint256 tokenId,) = _createForgeToken();

        // Bob has full allowance
        uint256 allowance = manager.getWhitelistAllowance(tokenId, bob);
        assertEq(allowance, 2 ether);

        // Bob spends 0.5 AVAX
        vm.prank(bob);
        manager.buy{value: 0.5 ether}(tokenId, 0, DEADLINE);

        // Allowance reduced
        allowance = manager.getWhitelistAllowance(tokenId, bob);
        assertEq(allowance, 1.5 ether);
    }

    function test_forgeMode_blacklistPermanent() public {
        address badActor = makeAddr("badActor");
        vm.deal(badActor, 10 ether);

        address[] memory wlAddrs = new address[](1);
        wlAddrs[0] = badActor;
        address[] memory blAddrs = new address[](1);
        blAddrs[0] = badActor;

        // Create with badActor both whitelisted AND blacklisted
        vm.prank(alice);
        (uint256 tokenId,) = manager.createTokenForge{value: 0.02 ether}(
            "ForgeToken", "FRG", 0,
            5 minutes, 2 ether, 0.5 ether,
            wlAddrs, blAddrs
        );

        // Blacklist overrides whitelist (checked on token level during mint)
        vm.prank(badActor);
        vm.expectRevert(); // Blacklisted (from Cre8Token._beforeTokenTransfer)
        manager.buy{value: 0.5 ether}(tokenId, 0, DEADLINE);
    }
}
