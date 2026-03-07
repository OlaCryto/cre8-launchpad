// Contract addresses — Cre8Manager (UUPS proxy) single-contract architecture
// Address will be filled after deployment to Fuji
export const CONTRACTS = {
  avalanche: {
    Cre8Manager: '0x...', // UUPS proxy — to be deployed
    LiquidityManager: '0x...',
    LiquidityLocker: '0x...',
  },
  fuji: {
    Cre8Manager: '0x4e972F92461AE6bc080411723C856996Dbe1591E',
    LiquidityManager: '0xcB9267e247ee1530066dBf6387f7A4c1EB7d4E47',
    LiquidityLocker: '0xa0fC9fFa9595D9976341C9d998819fD33fc351c2',
  },
} as const;

// Active network — change to 'avalanche' for mainnet
export const ACTIVE_NETWORK = 'fuji' as const;

// Token economics constants
export const TOKEN_CONSTANTS = {
  TOTAL_SUPPLY: 1_000_000_000n, // 1B
  CURVE_SUPPLY: 800_000_000n,   // 80%
  LIQUIDITY_RESERVE: 200_000_000n, // 20%
  GRADUATION_THRESHOLD: 69000n, // 69,000 AVAX
  LP_LOCK_DURATION: 365 * 24 * 60 * 60, // 1 year in seconds
} as const;

// Fee structure
export const FEES = {
  CREATION: 0.02, // AVAX
  TRADING: 0.01,  // 1%
  TRADING_PLATFORM: 0.01, // 1% (protocol only by default)
  TRADING_CREATOR: 0,     // 0% by default (configurable)
} as const;

// Avalanche chain config
export const CHAINS = {
  avalanche: {
    id: 43114,
    name: 'Avalanche',
    rpcUrl: 'https://api.avax.network/ext/bc/C/rpc',
    explorer: 'https://snowtrace.io',
  },
  fuji: {
    id: 43113,
    name: 'Avalanche Fuji',
    rpcUrl: 'https://api.avax-test.network/ext/bc/C/rpc',
    explorer: 'https://testnet.snowtrace.io',
  },
} as const;
