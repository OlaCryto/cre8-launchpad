/**
 * ABI fragments for Cre8 contract interactions.
 * Only includes the functions the frontend actually calls.
 * Matches Cre8Manager (UUPS proxy) single-contract architecture.
 */

// ============ Cre8Manager Events ============

export const TokenCreatedEvent = {
  name: 'TokenCreated',
  type: 'event',
  inputs: [
    { name: 'tokenId', type: 'uint256', indexed: true },
    { name: 'token', type: 'address', indexed: true },
    { name: 'creator', type: 'address', indexed: true },
    { name: 'name', type: 'string', indexed: false },
    { name: 'symbol', type: 'string', indexed: false },
    { name: 'creatorBuyAmount', type: 'uint256', indexed: false },
  ],
} as const;

export const TokenCreatedForgeEvent = {
  name: 'TokenCreatedForge',
  type: 'event',
  inputs: [
    { name: 'tokenId', type: 'uint256', indexed: true },
    { name: 'token', type: 'address', indexed: true },
    { name: 'creator', type: 'address', indexed: true },
    { name: 'whitelistEndTime', type: 'uint256', indexed: false },
    { name: 'maxWalletAvax', type: 'uint256', indexed: false },
    { name: 'maxTxAvax', type: 'uint256', indexed: false },
    { name: 'whitelistedCount', type: 'uint256', indexed: false },
  ],
} as const;

export const BuyEvent = {
  name: 'Buy',
  type: 'event',
  inputs: [
    { name: 'buyer', type: 'address', indexed: true },
    { name: 'tokenId', type: 'uint256', indexed: true },
    { name: 'avaxIn', type: 'uint256', indexed: false },
    { name: 'tokensOut', type: 'uint256', indexed: false },
    { name: 'newSupply', type: 'uint256', indexed: false },
    { name: 'newPrice', type: 'uint256', indexed: false },
  ],
} as const;

export const SellEvent = {
  name: 'Sell',
  type: 'event',
  inputs: [
    { name: 'seller', type: 'address', indexed: true },
    { name: 'tokenId', type: 'uint256', indexed: true },
    { name: 'tokensIn', type: 'uint256', indexed: false },
    { name: 'avaxOut', type: 'uint256', indexed: false },
    { name: 'newSupply', type: 'uint256', indexed: false },
    { name: 'newPrice', type: 'uint256', indexed: false },
  ],
} as const;

export const GraduatedEvent = {
  name: 'Graduated',
  type: 'event',
  inputs: [
    { name: 'tokenId', type: 'uint256', indexed: true },
    { name: 'token', type: 'address', indexed: true },
    { name: 'pair', type: 'address', indexed: false },
    { name: 'avaxLiquidity', type: 'uint256', indexed: false },
    { name: 'tokenLiquidity', type: 'uint256', indexed: false },
  ],
} as const;

// ============ Cre8Manager ABI ============

export const Cre8ManagerABI = [
  TokenCreatedEvent,
  TokenCreatedForgeEvent,
  BuyEvent,
  SellEvent,
  GraduatedEvent,
  // --- Easy Mode: Token Creation ---
  {
    name: 'createToken',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      { name: 'name', type: 'string' },
      { name: 'symbol', type: 'string' },
      { name: 'creatorBuyBps', type: 'uint256' },
    ],
    outputs: [
      { name: 'tokenId', type: 'uint256' },
      { name: 'tokenAddress', type: 'address' },
    ],
  },
  // --- Forge Mode: Token Creation with Whitelist ---
  {
    name: 'createTokenForge',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      { name: 'name', type: 'string' },
      { name: 'symbol', type: 'string' },
      { name: 'creatorBuyBps', type: 'uint256' },
      { name: 'whitelistDuration', type: 'uint256' },
      { name: 'maxWalletAvax', type: 'uint256' },
      { name: 'maxTxAvax', type: 'uint256' },
      { name: 'whitelistAddrs', type: 'address[]' },
      { name: 'blacklistAddrs', type: 'address[]' },
    ],
    outputs: [
      { name: 'tokenId', type: 'uint256' },
      { name: 'tokenAddress', type: 'address' },
    ],
  },
  // --- Trading ---
  {
    name: 'buy',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      { name: 'tokenId', type: 'uint256' },
      { name: 'minTokensOut', type: 'uint256' },
      { name: 'deadline', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    name: 'sell',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'tokenId', type: 'uint256' },
      { name: 'amount', type: 'uint256' },
      { name: 'minAvaxOut', type: 'uint256' },
      { name: 'deadline', type: 'uint256' },
    ],
    outputs: [],
  },
  // --- View Functions ---
  {
    name: 'tokenCount',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'getTokenInfo',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [
      { name: 'tokenAddress', type: 'address' },
      { name: 'creator', type: 'address' },
      { name: 'name', type: 'string' },
      { name: 'symbol', type: 'string' },
      { name: 'currentSupply', type: 'uint256' },
      { name: 'reserveBalance', type: 'uint256' },
      { name: 'currentPrice', type: 'uint256' },
      { name: 'marketCap', type: 'uint256' },
      { name: 'graduationProgress', type: 'uint256' },
      { name: 'graduated', type: 'bool' },
    ],
  },
  {
    name: 'getTokenByAddress',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'tokenAddr', type: 'address' }],
    outputs: [{ name: 'tokenId', type: 'uint256' }],
  },
  {
    name: 'getBuyQuote',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'tokenId', type: 'uint256' },
      { name: 'avaxAmount', type: 'uint256' },
    ],
    outputs: [
      { name: 'tokensOut', type: 'uint256' },
      { name: 'fee', type: 'uint256' },
    ],
  },
  {
    name: 'getSellQuote',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'tokenId', type: 'uint256' },
      { name: 'tokenAmount', type: 'uint256' },
    ],
    outputs: [
      { name: 'avaxOut', type: 'uint256' },
      { name: 'fee', type: 'uint256' },
    ],
  },
  {
    name: 'getCurrentPrice',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  // --- Whitelist View Functions ---
  {
    name: 'isWhitelistActive',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'getWhitelistAllowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'tokenId', type: 'uint256' },
      { name: 'wallet', type: 'address' },
    ],
    outputs: [{ name: 'remaining', type: 'uint256' }],
  },
  // --- Whitelist Management (creator only) ---
  {
    name: 'updateWhitelist',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'tokenId', type: 'uint256' },
      { name: 'accounts', type: 'address[]' },
      { name: 'status', type: 'bool' },
    ],
    outputs: [],
  },
  {
    name: 'updateBlacklist',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'tokenId', type: 'uint256' },
      { name: 'accounts', type: 'address[]' },
      { name: 'status', type: 'bool' },
    ],
    outputs: [],
  },
  // --- Graduation ---
  {
    name: 'graduate',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [],
  },
] as const;

// ============ Standard ERC20 ABI (for balance, transfer, etc.) ============

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
  {
    name: 'transfer',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const;
