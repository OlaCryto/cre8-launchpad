// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {LaunchpadErrors} from "../libraries/LaunchpadErrors.sol";

/**
 * @title CreatorRegistry
 * @notice User profile system for token creators
 * @dev Creators must have a profile to launch tokens (like Arena)
 *
 * Features:
 * - Creator profiles with handle, avatar, bio
 * - Unique handle registration
 * - Profile verification system
 * - Creator statistics tracking
 * - Social links
 */
contract CreatorRegistry is Ownable, ReentrancyGuard {
    // ============ Structs ============

    struct CreatorProfile {
        string handle;              // Unique username (e.g., "@creator")
        string displayName;         // Display name
        string avatarURI;           // Profile image
        string bio;                 // Short bio
        string twitter;             // Twitter/X handle
        string telegram;            // Telegram handle
        string website;             // Personal website
        uint256 createdAt;          // Profile creation timestamp
        uint256 tokensLaunched;     // Number of tokens launched
        uint256 totalVolume;        // Total trading volume generated
        bool isVerified;            // Verified creator badge
        bool isActive;              // Profile is active
    }

    struct CreatorStats {
        uint256 totalTokens;
        uint256 graduatedTokens;
        uint256 totalVolume;
        uint256 totalFeeEarned;
        address[] tokens;
    }

    // ============ State Variables ============

    // Address => Profile
    mapping(address => CreatorProfile) public profiles;

    // Handle => Address (for uniqueness)
    mapping(string => address) public handleToAddress;

    // Address => Stats
    mapping(address => CreatorStats) public creatorStats;

    // Handle validation
    uint256 public constant MIN_HANDLE_LENGTH = 3;
    uint256 public constant MAX_HANDLE_LENGTH = 20;

    // Verified creators list
    mapping(address => bool) public verifiedCreators;

    // Factory address (can update stats)
    address public factory;

    // Total registered creators
    uint256 public totalCreators;

    // ============ Events ============

    event ProfileCreated(
        address indexed creator,
        string handle,
        string displayName
    );

    event ProfileUpdated(
        address indexed creator,
        string displayName,
        string avatarURI,
        string bio
    );

    event HandleChanged(
        address indexed creator,
        string oldHandle,
        string newHandle
    );

    event CreatorVerified(address indexed creator, bool status);

    event TokenLaunched(
        address indexed creator,
        address indexed token,
        uint256 totalTokens
    );

    event StatsUpdated(
        address indexed creator,
        uint256 totalVolume,
        uint256 totalFeeEarned
    );

    // ============ Modifiers ============

    modifier onlyRegistered() {
        if (!profiles[msg.sender].isActive) {
            revert LaunchpadErrors.Unauthorized();
        }
        _;
    }

    modifier onlyFactory() {
        if (msg.sender != factory && msg.sender != owner()) {
            revert LaunchpadErrors.OnlyFactory();
        }
        _;
    }

    // ============ Constructor ============

    constructor() Ownable(msg.sender) {}

    // ============ Configuration ============

    /**
     * @notice Set the factory address
     * @param factory_ Factory contract address
     */
    function setFactory(address factory_) external onlyOwner {
        if (factory_ == address(0)) revert LaunchpadErrors.ZeroAddress();
        factory = factory_;
    }

    // ============ Profile Management ============

    /**
     * @notice Create a new creator profile
     * @param handle Unique handle (username)
     * @param displayName Display name
     * @param avatarURI Profile image URI
     * @param bio Short biography
     */
    function createProfile(
        string calldata handle,
        string calldata displayName,
        string calldata avatarURI,
        string calldata bio
    ) external nonReentrant {
        if (profiles[msg.sender].isActive) {
            revert LaunchpadErrors.AlreadyInitialized();
        }

        // Validate handle
        _validateHandle(handle);

        // Check handle uniqueness
        if (handleToAddress[_toLowerCase(handle)] != address(0)) {
            revert LaunchpadErrors.InvalidInput();
        }

        // Create profile
        profiles[msg.sender] = CreatorProfile({
            handle: handle,
            displayName: displayName,
            avatarURI: avatarURI,
            bio: bio,
            twitter: "",
            telegram: "",
            website: "",
            createdAt: block.timestamp,
            tokensLaunched: 0,
            totalVolume: 0,
            isVerified: false,
            isActive: true
        });

        // Register handle
        handleToAddress[_toLowerCase(handle)] = msg.sender;

        totalCreators++;

        emit ProfileCreated(msg.sender, handle, displayName);
    }

    /**
     * @notice Update profile information
     * @param displayName New display name
     * @param avatarURI New avatar URI
     * @param bio New bio
     */
    function updateProfile(
        string calldata displayName,
        string calldata avatarURI,
        string calldata bio
    ) external onlyRegistered {
        CreatorProfile storage profile = profiles[msg.sender];

        profile.displayName = displayName;
        profile.avatarURI = avatarURI;
        profile.bio = bio;

        emit ProfileUpdated(msg.sender, displayName, avatarURI, bio);
    }

    /**
     * @notice Update social links
     * @param twitter Twitter handle
     * @param telegram Telegram handle
     * @param website Website URL
     */
    function updateSocials(
        string calldata twitter,
        string calldata telegram,
        string calldata website
    ) external onlyRegistered {
        CreatorProfile storage profile = profiles[msg.sender];

        profile.twitter = twitter;
        profile.telegram = telegram;
        profile.website = website;
    }

    /**
     * @notice Change handle (username)
     * @param newHandle New unique handle
     */
    function changeHandle(string calldata newHandle) external onlyRegistered {
        _validateHandle(newHandle);

        string memory lowerNew = _toLowerCase(newHandle);

        // Check new handle is available
        if (handleToAddress[lowerNew] != address(0)) {
            revert LaunchpadErrors.InvalidInput();
        }

        CreatorProfile storage profile = profiles[msg.sender];
        string memory oldHandle = profile.handle;

        // Release old handle
        delete handleToAddress[_toLowerCase(oldHandle)];

        // Register new handle
        handleToAddress[lowerNew] = msg.sender;
        profile.handle = newHandle;

        emit HandleChanged(msg.sender, oldHandle, newHandle);
    }

    // ============ Stats Management (Factory Only) ============

    /**
     * @notice Record a new token launch
     * @param creator Creator address
     * @param token Token address
     */
    function recordTokenLaunch(address creator, address token) external onlyFactory {
        if (!profiles[creator].isActive) return;

        profiles[creator].tokensLaunched++;

        CreatorStats storage stats = creatorStats[creator];
        stats.totalTokens++;
        stats.tokens.push(token);

        emit TokenLaunched(creator, token, stats.totalTokens);
    }

    /**
     * @notice Record token graduation
     * @param creator Creator address
     */
    function recordGraduation(address creator) external onlyFactory {
        if (!profiles[creator].isActive) return;

        creatorStats[creator].graduatedTokens++;
    }

    /**
     * @notice Update volume and fees
     * @param creator Creator address
     * @param volume Trading volume to add
     * @param fees Fees earned to add
     */
    function updateStats(
        address creator,
        uint256 volume,
        uint256 fees
    ) external onlyFactory {
        if (!profiles[creator].isActive) return;

        profiles[creator].totalVolume += volume;

        CreatorStats storage stats = creatorStats[creator];
        stats.totalVolume += volume;
        stats.totalFeeEarned += fees;

        emit StatsUpdated(creator, stats.totalVolume, stats.totalFeeEarned);
    }

    // ============ Verification (Admin Only) ============

    /**
     * @notice Verify or unverify a creator
     * @param creator Creator address
     * @param status Verification status
     */
    function setVerified(address creator, bool status) external onlyOwner {
        if (!profiles[creator].isActive) revert LaunchpadErrors.NotInitialized();

        profiles[creator].isVerified = status;
        verifiedCreators[creator] = status;

        emit CreatorVerified(creator, status);
    }

    /**
     * @notice Batch verify creators
     * @param creators Array of creator addresses
     * @param status Verification status
     */
    function batchSetVerified(address[] calldata creators, bool status) external onlyOwner {
        for (uint256 i = 0; i < creators.length; i++) {
            if (profiles[creators[i]].isActive) {
                profiles[creators[i]].isVerified = status;
                verifiedCreators[creators[i]] = status;
                emit CreatorVerified(creators[i], status);
            }
        }
    }

    // ============ View Functions ============

    /**
     * @notice Check if an address has a profile
     * @param creator Address to check
     */
    function hasProfile(address creator) external view returns (bool) {
        return profiles[creator].isActive;
    }

    /**
     * @notice Get profile by address
     * @param creator Creator address
     */
    function getProfile(address creator) external view returns (CreatorProfile memory) {
        return profiles[creator];
    }

    /**
     * @notice Get profile by handle
     * @param handle Creator handle
     */
    function getProfileByHandle(string calldata handle) external view returns (address, CreatorProfile memory) {
        address creator = handleToAddress[_toLowerCase(handle)];
        return (creator, profiles[creator]);
    }

    /**
     * @notice Get creator statistics
     * @param creator Creator address
     */
    function getStats(address creator) external view returns (CreatorStats memory) {
        return creatorStats[creator];
    }

    /**
     * @notice Get all tokens launched by a creator
     * @param creator Creator address
     */
    function getCreatorTokens(address creator) external view returns (address[] memory) {
        return creatorStats[creator].tokens;
    }

    /**
     * @notice Check if a handle is available
     * @param handle Handle to check
     */
    function isHandleAvailable(string calldata handle) external view returns (bool) {
        if (bytes(handle).length < MIN_HANDLE_LENGTH || bytes(handle).length > MAX_HANDLE_LENGTH) {
            return false;
        }
        return handleToAddress[_toLowerCase(handle)] == address(0);
    }

    // ============ Internal Functions ============

    /**
     * @notice Validate handle format
     */
    function _validateHandle(string calldata handle) internal pure {
        bytes memory handleBytes = bytes(handle);

        if (handleBytes.length < MIN_HANDLE_LENGTH || handleBytes.length > MAX_HANDLE_LENGTH) {
            revert LaunchpadErrors.InvalidInput();
        }

        // Check for valid characters (alphanumeric and underscore only)
        for (uint256 i = 0; i < handleBytes.length; i++) {
            bytes1 char = handleBytes[i];
            bool isValid = (char >= 0x30 && char <= 0x39) || // 0-9
                          (char >= 0x41 && char <= 0x5A) || // A-Z
                          (char >= 0x61 && char <= 0x7A) || // a-z
                          (char == 0x5F);                    // _

            if (!isValid) {
                revert LaunchpadErrors.InvalidInput();
            }
        }
    }

    /**
     * @notice Convert string to lowercase for case-insensitive comparison
     */
    function _toLowerCase(string memory str) internal pure returns (string memory) {
        bytes memory strBytes = bytes(str);
        bytes memory result = new bytes(strBytes.length);

        for (uint256 i = 0; i < strBytes.length; i++) {
            bytes1 char = strBytes[i];
            // If uppercase A-Z, convert to lowercase
            if (char >= 0x41 && char <= 0x5A) {
                result[i] = bytes1(uint8(char) + 32);
            } else {
                result[i] = char;
            }
        }

        return string(result);
    }
}
