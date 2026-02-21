// Contract addresses — deployed to Fuji testnet
export const CONTRACTS = {
  avalanche: {
    LaunchpadRouter: '0x...',
    LaunchManager: '0x...',
    LaunchpadFactory: '0x...',
    CreatorRegistry: '0x...',
    FeeManager: '0x...',
    LiquidityManager: '0x...',
    LiquidityLocker: '0x...',
  },
  fuji: {
    LaunchpadRouter: '0xdF0c09E2dc3656c525F2a0E315FD4F8073589CC6',
    LaunchManager: '0xE00EE83B30ef619171c93256Eedc72A6Dd8f9988',
    LaunchpadFactory: '0x2fAf1F996052fC46c8Efc07C54C5a653725D80ae',
    CreatorRegistry: '0xc10A4e61465744A0d9FE16D4c006b7CEaC752C7e',
    FeeManager: '0xEc3719a76fFFbB9fE656C5c9d57a98E5Cc66eD77',
    LiquidityManager: '0x6f3FE0A19678850DD5DF9796d667Ca30A046aD71',
    LiquidityLocker: '0x37485Ae94C1b3a43235C13eC3BA2120120cfD932',
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
  TRADING_PLATFORM: 0.008, // 0.8%
  TRADING_CREATOR: 0.002,  // 0.2%
  GRADUATION: 0.015, // 1.5%
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
