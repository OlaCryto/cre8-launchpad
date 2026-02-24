// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";

import {LaunchpadToken} from "../contracts/core/LaunchpadToken.sol";
import {BondingCurve} from "../contracts/core/BondingCurve.sol";
import {LaunchpadFactory} from "../contracts/core/LaunchpadFactory.sol";
import {FeeManager} from "../contracts/core/FeeManager.sol";
import {CreatorRegistry} from "../contracts/core/CreatorRegistry.sol";
import {LiquidityLocker} from "../contracts/core/LiquidityLocker.sol";
import {LiquidityManager} from "../contracts/core/LiquidityManager.sol";
import {PresaleVault} from "../contracts/forge/PresaleVault.sol";
import {VestingContract} from "../contracts/forge/VestingContract.sol";
import {LaunchManager} from "../contracts/forge/LaunchManager.sol";

// ============ PresaleVault Tests ============

contract PresaleVaultTest is Test {
    PresaleVault public vault;

    address public creator;
    address public launchMgr;
    address public contributor1;
    address public contributor2;
    address public contributor3;

    uint256 constant MAX_PER_WALLET = 2 ether;
    uint256 constant DURATION = 2 days;

    function setUp() public {
        creator = makeAddr("creator");
        launchMgr = makeAddr("launchManager");
        contributor1 = makeAddr("contributor1");
        contributor2 = makeAddr("contributor2");
        contributor3 = makeAddr("contributor3");

        vm.deal(contributor1, 10 ether);
        vm.deal(contributor2, 10 ether);
        vm.deal(contributor3, 10 ether);

        vm.prank(launchMgr);
        vault = new PresaleVault(creator, MAX_PER_WALLET, DURATION, launchMgr);
    }

    function test_InitialState() public view {
        assertEq(uint256(vault.state()), uint256(PresaleVault.VaultState.Open));
        assertEq(vault.totalRaised(), 0);
        assertEq(vault.totalContributors(), 0);
        assertEq(vault.launchManager(), launchMgr);

        (uint256 maxPerWallet, uint256 duration,, uint256 endTime, address vaultCreator) = vault.config();
        assertEq(maxPerWallet, MAX_PER_WALLET);
        assertEq(duration, DURATION);
        assertEq(vaultCreator, creator);
        assertGt(endTime, block.timestamp);
    }

    function test_Contribute() public {
        vm.prank(contributor1);
        vault.contribute{value: 1 ether}();

        assertEq(vault.totalRaised(), 1 ether);
        assertEq(vault.totalContributors(), 1);

        PresaleVault.ContributorInfo memory info = vault.getContributor(contributor1);
        assertEq(info.contributed, 1 ether);
        assertFalse(info.claimed);
    }

    function test_ContributeMultiple() public {
        vm.prank(contributor1);
        vault.contribute{value: 1 ether}();

        vm.prank(contributor2);
        vault.contribute{value: 1.5 ether}();

        vm.prank(contributor3);
        vault.contribute{value: 2 ether}();

        assertEq(vault.totalRaised(), 4.5 ether);
        assertEq(vault.totalContributors(), 3);
    }

    function test_ContributeIncrementally() public {
        vm.startPrank(contributor1);
        vault.contribute{value: 0.5 ether}();
        vault.contribute{value: 0.5 ether}();
        vault.contribute{value: 1 ether}();
        vm.stopPrank();

        PresaleVault.ContributorInfo memory info = vault.getContributor(contributor1);
        assertEq(info.contributed, 2 ether);
        assertEq(vault.totalContributors(), 1); // Still just 1 contributor
    }

    function test_RevertMaxPerWallet() public {
        vm.prank(contributor1);
        vm.expectRevert(abi.encodeWithSignature("MaxTransactionExceeded()"));
        vault.contribute{value: 3 ether}();
    }

    function test_RevertZeroContribution() public {
        vm.prank(contributor1);
        vm.expectRevert(abi.encodeWithSignature("ZeroAmount()"));
        vault.contribute{value: 0}();
    }

    function test_RemainingAllowance() public {
        vm.prank(contributor1);
        vault.contribute{value: 0.5 ether}();

        assertEq(vault.remainingAllowance(contributor1), 1.5 ether);
        assertEq(vault.remainingAllowance(contributor2), 2 ether);
    }

    function test_TimeRemaining() public {
        uint256 remaining = vault.timeRemaining();
        assertGt(remaining, 0);
        assertLe(remaining, DURATION);

        // Warp past end
        vm.warp(block.timestamp + DURATION + 1);
        assertEq(vault.timeRemaining(), 0);
    }

    function test_CloseAfterTimeExpires() public {
        // Contribute first
        vm.prank(contributor1);
        vault.contribute{value: 1 ether}();

        // Warp past end
        vm.warp(block.timestamp + DURATION + 1);

        // Anyone can close
        vault.close();
        assertEq(uint256(vault.state()), uint256(PresaleVault.VaultState.Closed));
    }

    function test_CreatorCloseEarly() public {
        vm.prank(contributor1);
        vault.contribute{value: 1 ether}();

        vm.prank(creator);
        vault.close();
        assertEq(uint256(vault.state()), uint256(PresaleVault.VaultState.Closed));
    }

    function test_ManagerCloseEarly() public {
        vm.prank(launchMgr);
        vault.close();
        assertEq(uint256(vault.state()), uint256(PresaleVault.VaultState.Closed));
    }

    function test_RevertCloseEarlyByRandom() public {
        vm.prank(contributor1);
        vm.expectRevert(abi.encodeWithSignature("Unauthorized()"));
        vault.close();
    }

    function test_RevertContributeAfterClose() public {
        vm.prank(creator);
        vault.close();

        vm.prank(contributor1);
        vm.expectRevert(abi.encodeWithSignature("InvalidInput()"));
        vault.contribute{value: 1 ether}();
    }

    function test_Cancel() public {
        vm.prank(contributor1);
        vault.contribute{value: 1 ether}();

        vm.prank(creator);
        vault.cancel();
        assertEq(uint256(vault.state()), uint256(PresaleVault.VaultState.Cancelled));
    }

    function test_Refund() public {
        vm.prank(contributor1);
        vault.contribute{value: 2 ether}();

        uint256 balBefore = contributor1.balance;

        vm.prank(creator);
        vault.cancel();

        vm.prank(contributor1);
        vault.refund();

        assertEq(contributor1.balance, balBefore + 2 ether);

        PresaleVault.ContributorInfo memory info = vault.getContributor(contributor1);
        assertTrue(info.refunded);
    }

    function test_RevertDoubleRefund() public {
        vm.prank(contributor1);
        vault.contribute{value: 1 ether}();

        vm.prank(creator);
        vault.cancel();

        vm.prank(contributor1);
        vault.refund();

        vm.prank(contributor1);
        vm.expectRevert(abi.encodeWithSignature("AlreadyInitialized()"));
        vault.refund();
    }

    function test_GetContributorsPaginated() public {
        vm.prank(contributor1);
        vault.contribute{value: 1 ether}();
        vm.prank(contributor2);
        vault.contribute{value: 1.5 ether}();
        vm.prank(contributor3);
        vault.contribute{value: 2 ether}();

        (address[] memory addrs, uint256[] memory amounts) = vault.getContributors(0, 2);
        assertEq(addrs.length, 2);
        assertEq(addrs[0], contributor1);
        assertEq(amounts[0], 1 ether);
        assertEq(addrs[1], contributor2);
        assertEq(amounts[1], 1.5 ether);

        // Second page
        (addrs, amounts) = vault.getContributors(2, 10);
        assertEq(addrs.length, 1);
        assertEq(addrs[0], contributor3);
        assertEq(amounts[0], 2 ether);
    }

    function test_FinalizeAndClaim() public {
        // Contribute
        vm.prank(contributor1);
        vault.contribute{value: 1 ether}();
        vm.prank(contributor2);
        vault.contribute{value: 2 ether}();

        // Close
        vm.prank(creator);
        vault.close();

        // Deploy a mock token and send tokens to vault
        LaunchpadToken tokenImpl = new LaunchpadToken();
        LaunchpadToken token = LaunchpadToken(Clones.clone(address(tokenImpl)));
        BondingCurve curveImpl = new BondingCurve();
        BondingCurve curve = BondingCurve(payable(Clones.clone(address(curveImpl))));

        LaunchpadToken.TokenMetadata memory metadata = LaunchpadToken.TokenMetadata({
            name: "Forge Token", symbol: "FORGE",
            description: "", imageURI: "", twitter: "", telegram: "", website: ""
        });
        token.initialize("Forge Token", "FORGE", creator, address(curve), metadata);

        // Mint tokens to vault (simulating what LaunchManager does after buying on curve)
        uint256 totalTokens = 1_000_000 * 1e18;
        vm.prank(address(curve));
        token.mint(address(vault), totalTokens);

        // Finalize
        vm.prank(launchMgr);
        vault.finalize(address(token), totalTokens);

        assertEq(uint256(vault.state()), uint256(PresaleVault.VaultState.Finalized));

        // Check allocations: contributor1 gets 1/3, contributor2 gets 2/3
        PresaleVault.ContributorInfo memory info1 = vault.getContributor(contributor1);
        PresaleVault.ContributorInfo memory info2 = vault.getContributor(contributor2);

        assertEq(info1.tokenAllocation, (1 ether * totalTokens) / 3 ether);
        assertEq(info2.tokenAllocation, (2 ether * totalTokens) / 3 ether);

        // Claim
        vm.prank(contributor1);
        vault.claim();

        assertEq(token.balanceOf(contributor1), info1.tokenAllocation);

        vm.prank(contributor2);
        vault.claim();

        assertEq(token.balanceOf(contributor2), info2.tokenAllocation);
    }

    function test_RevertDoubleClaim() public {
        vm.prank(contributor1);
        vault.contribute{value: 1 ether}();

        vm.prank(creator);
        vault.close();

        // Setup mock token
        LaunchpadToken tokenImpl = new LaunchpadToken();
        LaunchpadToken token = LaunchpadToken(Clones.clone(address(tokenImpl)));
        BondingCurve curveImpl = new BondingCurve();
        BondingCurve curve = BondingCurve(payable(Clones.clone(address(curveImpl))));

        LaunchpadToken.TokenMetadata memory metadata = LaunchpadToken.TokenMetadata({
            name: "T", symbol: "T", description: "", imageURI: "", twitter: "", telegram: "", website: ""
        });
        token.initialize("T", "T", creator, address(curve), metadata);

        vm.prank(address(curve));
        token.mint(address(vault), 1000e18);

        vm.prank(launchMgr);
        vault.finalize(address(token), 1000e18);

        vm.prank(contributor1);
        vault.claim();

        vm.prank(contributor1);
        vm.expectRevert(abi.encodeWithSignature("AlreadyInitialized()"));
        vault.claim();
    }
}

// ============ VestingContract Tests ============

contract VestingContractTest is Test {
    VestingContract public vesting;

    address public beneficiary;
    address public launchMgr;
    LaunchpadToken public token;

    uint256 constant TOTAL_AMOUNT = 1_000_000 * 1e18;
    uint256 constant CLIFF = 30 days;
    uint256 constant VESTING_DURATION = 180 days;

    function setUp() public {
        beneficiary = makeAddr("beneficiary");
        launchMgr = makeAddr("launchManager");

        // Deploy mock token
        LaunchpadToken tokenImpl = new LaunchpadToken();
        token = LaunchpadToken(Clones.clone(address(tokenImpl)));
        BondingCurve curveImpl = new BondingCurve();
        BondingCurve curve = BondingCurve(payable(Clones.clone(address(curveImpl))));

        LaunchpadToken.TokenMetadata memory metadata = LaunchpadToken.TokenMetadata({
            name: "Vesting Token", symbol: "VEST",
            description: "", imageURI: "", twitter: "", telegram: "", website: ""
        });
        token.initialize("Vesting Token", "VEST", beneficiary, address(curve), metadata);

        // Deploy vesting contract
        vesting = new VestingContract(
            beneficiary,
            address(token),
            TOTAL_AMOUNT,
            CLIFF,
            VESTING_DURATION,
            launchMgr
        );

        // Mint tokens to vesting contract
        vm.prank(address(curve));
        token.mint(address(vesting), TOTAL_AMOUNT);
    }

    function test_InitialState() public view {
        (
            address _beneficiary, address _token, uint256 _total,
            uint256 _released, uint256 _releasable, uint256 _vested,
            uint256 _cliffEnd, uint256 _vestEnd, bool _revoked
        ) = vesting.getVestingInfo();

        assertEq(_beneficiary, beneficiary);
        assertEq(_token, address(token));
        assertEq(_total, TOTAL_AMOUNT);
        assertEq(_released, 0);
        assertEq(_releasable, 0);
        assertEq(_vested, 0);
        assertFalse(_revoked);
        assertEq(_cliffEnd, block.timestamp + CLIFF);
        assertEq(_vestEnd, block.timestamp + CLIFF + VESTING_DURATION);
    }

    function test_NothingDuringCliff() public {
        // Warp to halfway through cliff
        vm.warp(block.timestamp + CLIFF / 2);

        assertEq(vesting.getVestedAmount(), 0);
        assertEq(vesting.getReleasable(), 0);
        assertEq(vesting.getProgress(), 0);
    }

    function test_VestingAfterCliff() public {
        // Warp to right after cliff
        vm.warp(block.timestamp + CLIFF + 1);

        uint256 vested = vesting.getVestedAmount();
        assertGt(vested, 0);
        assertLt(vested, TOTAL_AMOUNT);
    }

    function test_LinearVesting() public {
        // Warp to cliff + half the vesting period
        vm.warp(block.timestamp + CLIFF + VESTING_DURATION / 2);

        uint256 vested = vesting.getVestedAmount();
        // Should be approximately 50% of total
        assertApproxEqRel(vested, TOTAL_AMOUNT / 2, 0.01e18); // 1% tolerance
    }

    function test_FullyVested() public {
        // Warp past all vesting
        vm.warp(block.timestamp + CLIFF + VESTING_DURATION + 1);

        assertEq(vesting.getVestedAmount(), TOTAL_AMOUNT);
        assertEq(vesting.getReleasable(), TOTAL_AMOUNT);
        assertEq(vesting.getProgress(), 10000); // 100%
    }

    function test_Release() public {
        // Warp to cliff + half vesting
        vm.warp(block.timestamp + CLIFF + VESTING_DURATION / 2);

        uint256 releasable = vesting.getReleasable();
        assertGt(releasable, 0);

        vm.prank(beneficiary);
        vesting.release();

        assertEq(token.balanceOf(beneficiary), releasable);
    }

    function test_MultipleReleases() public {
        // First release at 25%
        vm.warp(block.timestamp + CLIFF + VESTING_DURATION / 4);
        vm.prank(beneficiary);
        vesting.release();
        uint256 balance1 = token.balanceOf(beneficiary);

        // Second release at 75%
        vm.warp(block.timestamp + VESTING_DURATION / 2); // now at cliff + 3/4 of vesting
        vm.prank(beneficiary);
        vesting.release();
        uint256 balance2 = token.balanceOf(beneficiary);

        assertGt(balance2, balance1);

        // Final release at 100%
        vm.warp(block.timestamp + VESTING_DURATION); // past full vesting
        vm.prank(beneficiary);
        vesting.release();

        assertEq(token.balanceOf(beneficiary), TOTAL_AMOUNT);
    }

    function test_RevertReleaseNotBeneficiary() public {
        vm.warp(block.timestamp + CLIFF + VESTING_DURATION / 2);

        vm.prank(launchMgr);
        vm.expectRevert(abi.encodeWithSignature("Unauthorized()"));
        vesting.release();
    }

    function test_RevertReleaseNothingVested() public {
        // Still in cliff
        vm.prank(beneficiary);
        vm.expectRevert(abi.encodeWithSignature("ZeroAmount()"));
        vesting.release();
    }

    function test_Revoke() public {
        // Warp to cliff + half vesting
        vm.warp(block.timestamp + CLIFF + VESTING_DURATION / 2);

        uint256 vested = vesting.getVestedAmount();
        uint256 unvested = TOTAL_AMOUNT - vested;

        vm.prank(launchMgr);
        vesting.revoke();

        // Beneficiary should have received vested tokens
        assertEq(token.balanceOf(beneficiary), vested);
        // LaunchManager should have received unvested tokens
        assertEq(token.balanceOf(launchMgr), unvested);
    }

    function test_RevertDoubleRevoke() public {
        vm.prank(launchMgr);
        vesting.revoke();

        vm.prank(launchMgr);
        vm.expectRevert(abi.encodeWithSignature("AlreadyInitialized()"));
        vesting.revoke();
    }

    function test_RevertRevokeNotManager() public {
        vm.prank(beneficiary);
        vm.expectRevert(abi.encodeWithSignature("Unauthorized()"));
        vesting.revoke();
    }

    function test_TimeUntilCliff() public view {
        uint256 remaining = vesting.timeUntilCliff();
        assertEq(remaining, CLIFF);
    }

    function test_TimeUntilFullyVested() public view {
        uint256 remaining = vesting.timeUntilFullyVested();
        assertEq(remaining, CLIFF + VESTING_DURATION);
    }
}

// ============ LaunchManager Tests ============

contract LaunchManagerTest is Test {
    LaunchManager public manager;
    LaunchpadFactory public factory;
    CreatorRegistry public registry;
    FeeManager public feeManager;

    LaunchpadToken public tokenImpl;
    BondingCurve public curveImpl;

    address public owner;
    address public creator;
    address public contributor1;
    address public contributor2;
    address public treasury;

    uint256 constant CREATION_FEE = 0.02 ether;

    function setUp() public {
        owner = address(this);
        creator = makeAddr("creator");
        contributor1 = makeAddr("contributor1");
        contributor2 = makeAddr("contributor2");
        treasury = makeAddr("treasury");

        vm.deal(creator, 100 ether);
        vm.deal(contributor1, 100 ether);
        vm.deal(contributor2, 100 ether);

        // Deploy implementations
        tokenImpl = new LaunchpadToken();
        curveImpl = new BondingCurve();

        // Deploy core contracts
        factory = new LaunchpadFactory(address(tokenImpl), address(curveImpl));
        feeManager = new FeeManager(treasury);
        registry = new CreatorRegistry();

        // Deploy LaunchManager
        manager = new LaunchManager(address(factory), address(registry));

        // Configure factory
        factory.setFeeManager(address(feeManager));
        factory.setRouter(address(manager)); // LaunchManager acts as router for factory

        // Configure fee manager
        feeManager.setFactory(address(factory));
        feeManager.setRouter(address(manager));

        // Configure creator registry
        registry.setFactory(address(manager));

        // Register creator profile
        vm.prank(creator);
        registry.createProfile("testcreator", "Test Creator", "", "A test creator");
    }

    function _buildDirectLaunchConfig() internal pure returns (LaunchManager.ForgeConfig memory) {
        address[] memory whitelist = new address[](0);

        return LaunchManager.ForgeConfig({
            name: "Forge Token",
            symbol: "FORGE",
            description: "A forge mode token",
            imageURI: "",
            twitter: "",
            telegram: "",
            website: "",
            presaleEnabled: false,
            whitelistEnabled: false,
            vestingEnabled: false,
            presaleMaxPerWallet: 0,
            presaleDuration: 0,
            whitelist: whitelist,
            whitelistDuration: 0,
            vestingTeamBps: 0,
            vestingCliff: 0,
            vestingDuration: 0
        });
    }

    function _buildPresaleConfig() internal view returns (LaunchManager.ForgeConfig memory) {
        address[] memory whitelist = new address[](0);

        return LaunchManager.ForgeConfig({
            name: "Presale Token",
            symbol: "PRE",
            description: "A presale token",
            imageURI: "",
            twitter: "",
            telegram: "",
            website: "",
            presaleEnabled: true,
            whitelistEnabled: false,
            vestingEnabled: false,
            presaleMaxPerWallet: 2 ether,
            presaleDuration: 2 days,
            whitelist: whitelist,
            whitelistDuration: 0,
            vestingTeamBps: 0,
            vestingCliff: 0,
            vestingDuration: 0
        });
    }

    function _buildWhitelistConfig() internal view returns (LaunchManager.ForgeConfig memory) {
        address[] memory whitelist = new address[](2);
        whitelist[0] = contributor1;
        whitelist[1] = contributor2;

        return LaunchManager.ForgeConfig({
            name: "WL Token",
            symbol: "WL",
            description: "A whitelist token",
            imageURI: "",
            twitter: "",
            telegram: "",
            website: "",
            presaleEnabled: false,
            whitelistEnabled: true,
            vestingEnabled: false,
            presaleMaxPerWallet: 0,
            presaleDuration: 0,
            whitelist: whitelist,
            whitelistDuration: 10 minutes,
            vestingTeamBps: 0,
            vestingCliff: 0,
            vestingDuration: 0
        });
    }

    // --- Direct Launch Tests ---

    function test_DirectLaunch() public {
        LaunchManager.ForgeConfig memory config = _buildDirectLaunchConfig();

        vm.prank(creator);
        uint256 launchId = manager.createForgeLaunch{value: CREATION_FEE}(config);

        (
            address launchCreator, address token, address bondingCurve,
            address presaleVault, address vestingContract,
            LaunchManager.LaunchPhase phase,,
        ) = manager.getLaunch(launchId);

        assertEq(launchCreator, creator);
        assertNotEq(token, address(0));
        assertNotEq(bondingCurve, address(0));
        assertEq(presaleVault, address(0)); // No presale
        assertEq(vestingContract, address(0)); // No vesting
        assertEq(uint256(phase), uint256(LaunchManager.LaunchPhase.Public));
    }

    function test_DirectLaunchIsForgeToken() public {
        LaunchManager.ForgeConfig memory config = _buildDirectLaunchConfig();

        vm.prank(creator);
        uint256 launchId = manager.createForgeLaunch{value: CREATION_FEE}(config);

        (,address token,,,,,,) = manager.getLaunch(launchId);
        assertTrue(manager.isForgeToken(token));
    }

    function test_RevertNoProfile() public {
        address noProfile = makeAddr("noProfile");
        vm.deal(noProfile, 10 ether);

        LaunchManager.ForgeConfig memory config = _buildDirectLaunchConfig();

        vm.prank(noProfile);
        vm.expectRevert(abi.encodeWithSignature("Unauthorized()"));
        manager.createForgeLaunch{value: CREATION_FEE}(config);
    }

    // --- Presale Launch Tests ---

    function test_PresaleLaunchCreatesVault() public {
        LaunchManager.ForgeConfig memory config = _buildPresaleConfig();

        vm.prank(creator);
        uint256 launchId = manager.createForgeLaunch{value: CREATION_FEE}(config);

        (,,, address presaleVault,, LaunchManager.LaunchPhase phase,,) = manager.getLaunch(launchId);
        assertNotEq(presaleVault, address(0));
        assertEq(uint256(phase), uint256(LaunchManager.LaunchPhase.Presale));
    }

    function test_PresaleContribute() public {
        LaunchManager.ForgeConfig memory config = _buildPresaleConfig();

        vm.prank(creator);
        uint256 launchId = manager.createForgeLaunch{value: CREATION_FEE}(config);

        (,,, address vaultAddr,,,,) = manager.getLaunch(launchId);
        PresaleVault vault = PresaleVault(payable(vaultAddr));

        vm.prank(contributor1);
        vault.contribute{value: 1 ether}();

        vm.prank(contributor2);
        vault.contribute{value: 2 ether}();

        assertEq(vault.totalRaised(), 3 ether);
        assertEq(vault.totalContributors(), 2);
    }

    function test_PresaleExecuteLaunch() public {
        LaunchManager.ForgeConfig memory config = _buildPresaleConfig();

        vm.prank(creator);
        uint256 launchId = manager.createForgeLaunch{value: CREATION_FEE}(config);

        (,,, address vaultAddr,,,,) = manager.getLaunch(launchId);
        PresaleVault vault = PresaleVault(payable(vaultAddr));

        // Contribute
        vm.prank(contributor1);
        vault.contribute{value: 1 ether}();
        vm.prank(contributor2);
        vault.contribute{value: 2 ether}();

        // Warp past presale end
        vm.warp(block.timestamp + 2 days + 1);

        // Execute launch — vault will withdraw AVAX to manager for curve buy
        manager.executeLaunch(launchId);

        (,address token, address bondingCurve,,, LaunchManager.LaunchPhase phase,,) = manager.getLaunch(launchId);
        assertNotEq(token, address(0));
        assertNotEq(bondingCurve, address(0));
        assertEq(uint256(phase), uint256(LaunchManager.LaunchPhase.Public));

        // Vault should be finalized
        assertEq(uint256(vault.state()), uint256(PresaleVault.VaultState.Finalized));
    }

    // --- Whitelist Launch Tests ---

    function test_WhitelistLaunch() public {
        LaunchManager.ForgeConfig memory config = _buildWhitelistConfig();

        vm.prank(creator);
        uint256 launchId = manager.createForgeLaunch{value: CREATION_FEE}(config);

        (,,,,, LaunchManager.LaunchPhase phase,,) = manager.getLaunch(launchId);
        assertEq(uint256(phase), uint256(LaunchManager.LaunchPhase.WhitelistOnly));
    }

    function test_WhitelistToPublicTransition() public {
        LaunchManager.ForgeConfig memory config = _buildWhitelistConfig();

        vm.prank(creator);
        uint256 launchId = manager.createForgeLaunch{value: CREATION_FEE}(config);

        // Warp past whitelist window
        vm.warp(block.timestamp + 10 minutes + 1);

        manager.openPublicTrading(launchId);

        (,,,,, LaunchManager.LaunchPhase phase,,) = manager.getLaunch(launchId);
        assertEq(uint256(phase), uint256(LaunchManager.LaunchPhase.Public));
    }

    function test_CreatorCanOpenPublicEarly() public {
        LaunchManager.ForgeConfig memory config = _buildWhitelistConfig();

        vm.prank(creator);
        uint256 launchId = manager.createForgeLaunch{value: CREATION_FEE}(config);

        // Creator opens before whitelist window ends
        vm.prank(creator);
        manager.openPublicTrading(launchId);

        (,,,,, LaunchManager.LaunchPhase phase,,) = manager.getLaunch(launchId);
        assertEq(uint256(phase), uint256(LaunchManager.LaunchPhase.Public));
    }

    function test_RevertOpenPublicTooEarly() public {
        LaunchManager.ForgeConfig memory config = _buildWhitelistConfig();

        vm.prank(creator);
        uint256 launchId = manager.createForgeLaunch{value: CREATION_FEE}(config);

        // Random user can't open early
        vm.prank(contributor1);
        vm.expectRevert(abi.encodeWithSignature("Unauthorized()"));
        manager.openPublicTrading(launchId);
    }

    // --- View Function Tests ---

    function test_CreatorLaunches() public {
        LaunchManager.ForgeConfig memory config = _buildDirectLaunchConfig();

        vm.prank(creator);
        manager.createForgeLaunch{value: CREATION_FEE}(config);

        config.name = "Second Token";
        config.symbol = "SEC";

        vm.prank(creator);
        manager.createForgeLaunch{value: CREATION_FEE}(config);

        uint256[] memory launchIds = manager.getCreatorLaunches(creator);
        assertEq(launchIds.length, 2);
        assertEq(launchIds[0], 0);
        assertEq(launchIds[1], 1);
    }

    function test_TotalLaunches() public {
        assertEq(manager.getTotalLaunches(), 0);

        LaunchManager.ForgeConfig memory config = _buildDirectLaunchConfig();

        vm.prank(creator);
        manager.createForgeLaunch{value: CREATION_FEE}(config);

        assertEq(manager.getTotalLaunches(), 1);
    }

    function test_GetLaunchConfig() public {
        LaunchManager.ForgeConfig memory config = _buildDirectLaunchConfig();

        vm.prank(creator);
        uint256 launchId = manager.createForgeLaunch{value: CREATION_FEE}(config);

        (string memory name, string memory symbol, bool presale, bool whitelist, bool vesting) = manager.getLaunchConfig(launchId);
        assertEq(name, "Forge Token");
        assertEq(symbol, "FORGE");
        assertFalse(presale);
        assertFalse(whitelist);
        assertFalse(vesting);
    }

    // --- Validation Tests ---

    function test_RevertInvalidPresaleDuration() public {
        address[] memory whitelist = new address[](0);
        LaunchManager.ForgeConfig memory config = LaunchManager.ForgeConfig({
            name: "Bad", symbol: "BAD",
            description: "", imageURI: "", twitter: "", telegram: "", website: "",
            presaleEnabled: true, whitelistEnabled: false, vestingEnabled: false,
            presaleMaxPerWallet: 1 ether,
            presaleDuration: 1 minutes, // Too short — min is 1 hour
            whitelist: whitelist, whitelistDuration: 0,
            vestingTeamBps: 0, vestingCliff: 0, vestingDuration: 0
        });

        vm.prank(creator);
        vm.expectRevert(abi.encodeWithSignature("InvalidInput()"));
        manager.createForgeLaunch{value: CREATION_FEE}(config);
    }

    function test_RevertInvalidVestingBps() public {
        address[] memory whitelist = new address[](0);
        LaunchManager.ForgeConfig memory config = LaunchManager.ForgeConfig({
            name: "Bad", symbol: "BAD",
            description: "", imageURI: "", twitter: "", telegram: "", website: "",
            presaleEnabled: false, whitelistEnabled: false, vestingEnabled: true,
            presaleMaxPerWallet: 0, presaleDuration: 0,
            whitelist: whitelist, whitelistDuration: 0,
            vestingTeamBps: 3000, // 30% — exceeds 20% max
            vestingCliff: 30 days, vestingDuration: 180 days
        });

        vm.prank(creator);
        vm.expectRevert(abi.encodeWithSignature("InvalidInput()"));
        manager.createForgeLaunch{value: CREATION_FEE}(config);
    }
}
