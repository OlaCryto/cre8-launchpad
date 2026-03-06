// Contract addresses — deployed to Fuji testnet (2026-03-06)
export const CONTRACTS = {
  avalanche: {
    LaunchpadRouter: '0x...',
    LaunchManager: '0x...',
    LaunchpadFactory: '0x...',
    CreatorRegistry: '0x...',
    FeeManager: '0x...',
    LiquidityManager: '0x...',
    LiquidityLocker: '0x...',
    ActivityTracker: '0x...',
    TokenImplementation: '0x...',
    BondingCurveImplementation: '0x...',
  },
  fuji: {
    LaunchpadRouter: '0xecE29f311363b3689C838a7e12db20ddc32E9896',
    LaunchManager: '0x85B7572Fd253549dB38A638ddcDae1Cc40E2eF73',
    LaunchpadFactory: '0x0926707Dc7a64d63f37390d7C616352b180E807a',
    CreatorRegistry: '0x699251A1Ee60E4396F9F2a911e4d42E7Eeb1A634',
    FeeManager: '0xa7D8Df017E9FbAaaf05Bd96381EB0b746038f9e9',
    LiquidityManager: '0xcB9267e247ee1530066dBf6387f7A4c1EB7d4E47',
    LiquidityLocker: '0xa0fC9fFa9595D9976341C9d998819fD33fc351c2',
    ActivityTracker: '0x3831ec083AC3Bc9914A00Bc749fF0958d68DDA2B',
    TokenImplementation: '0x79a08fD01BaEbA1807f0EEb17Af00e21F66671e8',
    BondingCurveImplementation: '0x53675d55Be1AFa990C6f43C814c42f2b02CBFdc0',
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
