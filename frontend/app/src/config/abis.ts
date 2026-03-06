/**
 * ABI fragments for Cre8 contract interactions.
 * Only includes the functions the frontend actually calls.
 * Matches deployed V1 contracts on Fuji.
 */

export const TokenCreatedEvent = {
  name: 'TokenLaunched',
  type: 'event',
  inputs: [
    { name: 'token', type: 'address', indexed: true },
    { name: 'bondingCurve', type: 'address', indexed: true },
    { name: 'creator', type: 'address', indexed: true },
    { name: 'name', type: 'string', indexed: false },
    { name: 'symbol', type: 'string', indexed: false },
    { name: 'isProLaunch', type: 'bool', indexed: false },
  ],
} as const;

export const SwapExecutedEvent = {
  name: 'SwapExecuted',
  type: 'event',
  inputs: [
    { name: 'user', type: 'address', indexed: true },
    { name: 'token', type: 'address', indexed: true },
    { name: 'isBuy', type: 'bool', indexed: false },
    { name: 'amountIn', type: 'uint256', indexed: false },
    { name: 'amountOut', type: 'uint256', indexed: false },
    { name: 'newPrice', type: 'uint256', indexed: false },
  ],
} as const;

export const LaunchpadRouterABI = [
  TokenCreatedEvent,
  SwapExecutedEvent,
  {
    name: 'createTokenEasy',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      { name: 'name', type: 'string' },
      { name: 'symbol', type: 'string' },
      { name: 'imageURI', type: 'string' },
      { name: 'description', type: 'string' },
      { name: 'twitter', type: 'string' },
      { name: 'telegram', type: 'string' },
      { name: 'website', type: 'string' },
      { name: 'creatorBuyBps', type: 'uint256' },
    ],
    outputs: [
      { name: 'token', type: 'address' },
      { name: 'bondingCurve', type: 'address' },
    ],
  },
  {
    name: 'buy',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'token', type: 'address' },
          { name: 'amountIn', type: 'uint256' },
          { name: 'minAmountOut', type: 'uint256' },
          { name: 'recipient', type: 'address' },
          { name: 'deadline', type: 'uint256' },
        ],
      },
    ],
    outputs: [{ name: 'tokensOut', type: 'uint256' }],
  },
  {
    name: 'sell',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'token', type: 'address' },
          { name: 'amountIn', type: 'uint256' },
          { name: 'minAmountOut', type: 'uint256' },
          { name: 'recipient', type: 'address' },
          { name: 'deadline', type: 'uint256' },
        ],
      },
    ],
    outputs: [{ name: 'avaxOut', type: 'uint256' }],
  },
  {
    name: 'getQuoteBuy',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'avaxAmount', type: 'uint256' },
    ],
    outputs: [
      { name: 'tokensOut', type: 'uint256' },
      { name: 'fee', type: 'uint256' },
      { name: 'priceImpact', type: 'uint256' },
    ],
  },
  {
    name: 'getQuoteSell',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'tokenAmount', type: 'uint256' },
    ],
    outputs: [
      { name: 'avaxOut', type: 'uint256' },
      { name: 'fee', type: 'uint256' },
      { name: 'priceImpact', type: 'uint256' },
    ],
  },
] as const;

export const LaunchpadFactoryABI = [
  {
    name: 'createTokenEasy',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'name', type: 'string' },
          { name: 'symbol', type: 'string' },
          { name: 'imageURI', type: 'string' },
          { name: 'description', type: 'string' },
          { name: 'twitter', type: 'string' },
          { name: 'telegram', type: 'string' },
          { name: 'website', type: 'string' },
          { name: 'creatorBuyBps', type: 'uint256' },
        ],
      },
    ],
    outputs: [
      { name: 'token', type: 'address' },
      { name: 'bondingCurve', type: 'address' },
    ],
  },
  TokenCreatedEvent,
  {
    name: 'getLaunchInfo',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'token', type: 'address' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'token', type: 'address' },
          { name: 'bondingCurve', type: 'address' },
          { name: 'creator', type: 'address' },
          { name: 'createdAt', type: 'uint256' },
          { name: 'isGraduated', type: 'bool' },
          { name: 'isProLaunch', type: 'bool' },
          { name: 'creatorHandle', type: 'string' },
        ],
      },
    ],
  },
  {
    name: 'getTokens',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'offset', type: 'uint256' },
      { name: 'limit', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'address[]' }],
  },
  {
    name: 'getTokenCount',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

export const TokensPurchasedEvent = {
  name: 'TokensPurchased',
  type: 'event',
  inputs: [
    { name: 'buyer', type: 'address', indexed: true },
    { name: 'token', type: 'address', indexed: true },
    { name: 'avaxIn', type: 'uint256', indexed: false },
    { name: 'tokensOut', type: 'uint256', indexed: false },
    { name: 'newPrice', type: 'uint256', indexed: false },
  ],
} as const;

export const TokensSoldEvent = {
  name: 'TokensSold',
  type: 'event',
  inputs: [
    { name: 'seller', type: 'address', indexed: true },
    { name: 'token', type: 'address', indexed: true },
    { name: 'tokensIn', type: 'uint256', indexed: false },
    { name: 'avaxOut', type: 'uint256', indexed: false },
    { name: 'newPrice', type: 'uint256', indexed: false },
  ],
} as const;

export const BondingCurveABI = [
  TokensPurchasedEvent,
  TokensSoldEvent,
  {
    name: 'getCurrentPrice',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'getBuyPrice',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'avaxAmount', type: 'uint256' }],
    outputs: [
      { name: 'tokensOut', type: 'uint256' },
      { name: 'priceImpact', type: 'uint256' },
    ],
  },
  {
    name: 'getSellPrice',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'tokenAmount', type: 'uint256' }],
    outputs: [
      { name: 'avaxOut', type: 'uint256' },
      { name: 'priceImpact', type: 'uint256' },
    ],
  },
  {
    name: 'reserveBalance',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'state',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
  },
  {
    name: 'currentSupply',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'getMarketCap',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'getGraduationProgress',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: 'progressBps', type: 'uint256' }],
  },
] as const;

export const LaunchManagerABI = [
  {
    name: 'createForgeLaunch',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      {
        name: 'config_',
        type: 'tuple',
        components: [
          { name: 'name', type: 'string' },
          { name: 'symbol', type: 'string' },
          { name: 'description', type: 'string' },
          { name: 'imageURI', type: 'string' },
          { name: 'twitter', type: 'string' },
          { name: 'telegram', type: 'string' },
          { name: 'website', type: 'string' },
          { name: 'presaleEnabled', type: 'bool' },
          { name: 'whitelistEnabled', type: 'bool' },
          { name: 'vestingEnabled', type: 'bool' },
          { name: 'presaleMaxPerWallet', type: 'uint256' },
          { name: 'presaleDuration', type: 'uint256' },
          { name: 'presaleHardCap', type: 'uint256' },
          { name: 'presaleSoftCap', type: 'uint256' },
          { name: 'whitelist', type: 'address[]' },
          { name: 'whitelistDuration', type: 'uint256' },
          { name: 'vestingTeamBps', type: 'uint256' },
          { name: 'vestingCliff', type: 'uint256' },
          { name: 'vestingDuration', type: 'uint256' },
        ],
      },
    ],
    outputs: [{ name: 'launchId', type: 'uint256' }],
  },
  {
    name: 'getLaunchConfig',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'launchId', type: 'uint256' }],
    outputs: [
      { name: 'name', type: 'string' },
      { name: 'symbol', type: 'string' },
      { name: 'presaleEnabled', type: 'bool' },
      { name: 'whitelistEnabled', type: 'bool' },
      { name: 'vestingEnabled', type: 'bool' },
    ],
  },
  {
    name: 'getTotalLaunches',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'getLaunch',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'launchId', type: 'uint256' }],
    outputs: [
      { name: 'creator', type: 'address' },
      { name: 'token', type: 'address' },
      { name: 'bondingCurve', type: 'address' },
      { name: 'presaleVault', type: 'address' },
      { name: 'vestingContract', type: 'address' },
      { name: 'phase', type: 'uint8' },
      { name: 'createdAt', type: 'uint256' },
      { name: 'launchedAt', type: 'uint256' },
    ],
  },
  {
    name: 'executeLaunch',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'launchId', type: 'uint256' }],
    outputs: [],
  },
  {
    name: 'openPublicTrading',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'launchId', type: 'uint256' }],
    outputs: [],
  },
  {
    name: 'getCreatorLaunches',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'creator', type: 'address' }],
    outputs: [{ name: '', type: 'uint256[]' }],
  },
  {
    name: 'getLaunchByToken',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'token', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'isForgeToken',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'token', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const;

export const PresaleVaultABI = [
  {
    name: 'contribute',
    type: 'function',
    stateMutability: 'payable',
    inputs: [],
    outputs: [],
  },
  {
    name: 'claim',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
  {
    name: 'refund',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
  {
    name: 'cancel',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
  {
    name: 'close',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
  {
    name: 'state',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
  },
  {
    name: 'totalRaised',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'totalContributors',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'token',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    name: 'totalTokensBought',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'config',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      { name: 'maxPerWallet', type: 'uint256' },
      { name: 'duration', type: 'uint256' },
      { name: 'startTime', type: 'uint256' },
      { name: 'endTime', type: 'uint256' },
      { name: 'creator', type: 'address' },
      { name: 'hardCap', type: 'uint256' },
      { name: 'softCap', type: 'uint256' },
    ],
  },
  {
    name: 'timeRemaining',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'getContributor',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'contributor', type: 'address' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'contributed', type: 'uint256' },
          { name: 'tokenAllocation', type: 'uint256' },
          { name: 'claimed', type: 'bool' },
          { name: 'refunded', type: 'bool' },
        ],
      },
    ],
  },
  {
    name: 'getContributors',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'offset', type: 'uint256' },
      { name: 'limit', type: 'uint256' },
    ],
    outputs: [
      { name: 'addresses', type: 'address[]' },
      { name: 'amounts', type: 'uint256[]' },
    ],
  },
  {
    name: 'remainingAllowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'contributor', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'isExpired',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'remainingHardCap',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

export const VestingContractABI = [
  {
    name: 'release',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
  {
    name: 'getVestingInfo',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      { name: 'beneficiary', type: 'address' },
      { name: 'token', type: 'address' },
      { name: 'totalAmount', type: 'uint256' },
      { name: 'released', type: 'uint256' },
      { name: 'releasable', type: 'uint256' },
      { name: 'vestedAmount', type: 'uint256' },
      { name: 'cliffEnd', type: 'uint256' },
      { name: 'vestingEnd', type: 'uint256' },
      { name: 'revoked', type: 'bool' },
    ],
  },
  {
    name: 'getProgress',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'getReleasable',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'getVestedAmount',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'timeUntilCliff',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'timeUntilFullyVested',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

export const CreatorRegistryABI = [
  {
    name: 'getProfile',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'creator', type: 'address' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'handle', type: 'string' },
          { name: 'displayName', type: 'string' },
          { name: 'avatarURI', type: 'string' },
          { name: 'bio', type: 'string' },
          { name: 'twitter', type: 'string' },
          { name: 'telegram', type: 'string' },
          { name: 'website', type: 'string' },
          { name: 'createdAt', type: 'uint256' },
          { name: 'tokensLaunched', type: 'uint256' },
          { name: 'totalVolume', type: 'uint256' },
          { name: 'isVerified', type: 'bool' },
          { name: 'isActive', type: 'bool' },
        ],
      },
    ],
  },
  {
    name: 'hasProfile',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'creator', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'createProfile',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'handle', type: 'string' },
      { name: 'displayName', type: 'string' },
      { name: 'avatarURI', type: 'string' },
      { name: 'bio', type: 'string' },
    ],
    outputs: [],
  },
  {
    name: 'updateProfile',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'displayName', type: 'string' },
      { name: 'avatarURI', type: 'string' },
      { name: 'bio', type: 'string' },
    ],
    outputs: [],
  },
  {
    name: 'updateSocials',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'twitter', type: 'string' },
      { name: 'telegram', type: 'string' },
      { name: 'website', type: 'string' },
    ],
    outputs: [],
  },
] as const;

export const FeeManagerABI = [
  {
    name: 'feeConfig',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'platformFeeBps', type: 'uint256' },
          { name: 'creatorFeeBps', type: 'uint256' },
          { name: 'graduationFeeBps', type: 'uint256' },
          { name: 'creationFee', type: 'uint256' },
        ],
      },
    ],
  },
] as const;

/** Read full token metadata (description, imageURI, socials) */
export const TokenMetadataABI = [
  {
    name: 'metadata',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'name', type: 'string' },
          { name: 'symbol', type: 'string' },
          { name: 'description', type: 'string' },
          { name: 'imageURI', type: 'string' },
          { name: 'twitter', type: 'string' },
          { name: 'telegram', type: 'string' },
          { name: 'website', type: 'string' },
        ],
      },
    ],
  },
] as const;

export const TransferEvent = {
  name: 'Transfer',
  type: 'event',
  inputs: [
    { name: 'from', type: 'address', indexed: true },
    { name: 'to', type: 'address', indexed: true },
    { name: 'value', type: 'uint256', indexed: false },
  ],
} as const;

export const ERC20ABI = [
  TransferEvent,
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'name',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
  },
  {
    name: 'symbol',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
  },
  {
    name: 'totalSupply',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;
