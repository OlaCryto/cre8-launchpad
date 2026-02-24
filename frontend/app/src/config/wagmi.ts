// Contract addresses — deployed to Fuji testnet (2026-02-24)
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
    LaunchpadRouter: '0x29292B61e820736E5920e8f0cc42C9D3e699f5eA',
    LaunchpadFactory: '0xeD1A3Af4faA086BF4dff4Fa2cd4d49F0138DFad8',
    CreatorRegistry: '0x2BE70a5EC63FB415635956519D243c7c85C587E5',
    FeeManager: '0xe033C8Bd9488844358f2a2D41267D51FD2a648B3',
    LiquidityManager: '0xc52B09eca7cC3828adF692B4cd2f685dFF30e6B0',
    LiquidityLocker: '0xFDC16396dcff7960B7ba9F3554a5C28576C2D9a8',
    ActivityTracker: '0xaBAeDD8b59Ee92D2d9266F9b07E9c6b92EfC142E',
    TokenImplementation: '0x8827948871eC905fA432dE3CAcbD43CAB54E1DaD',
    BondingCurveImplementation: '0xF36E5D363E057Ecd11D04D51F0f2955C15A0254b',
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
