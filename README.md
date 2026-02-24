# Cre8

**Dual-Intent Token Launchpad on Avalanche C-Chain**

Cre8 separates speculation from structured capital formation. Two launch modes, one platform — Trenches for degens, Forge for verified creators.

> **Website:** [cre8.bond](https://cre8.bond) · **Network:** Avalanche C-Chain · **Status:** Live on Fuji Testnet

---

## The Problem

Every token launchpad treats all launches the same. A meme coin and a legitimate project with a working product go through the same undifferentiated process. This causes:

- **No accountability** — anyone can launch and dump with zero consequences
- **No trust signal** — users can't distinguish serious builders from pump-and-dump operators
- **Manual chaos** — presales coordinated via Twitter DMs, airdrops done by copying wallet addresses
- **Constant rugs** — funds move freely off-platform with no enforcement
- **Reputation destruction** — serious builders get grouped with scammers

## The Solution

Cre8 offers two distinct launch modes for two types of builders:

### Trenches Mode
Open, fast, permissionless. For meme coins, community tokens, and quick experiments.
- Launch a token in under 60 seconds for ~$1 (0.02 AVAX)
- No registration required — connect wallet and go
- Bonding curve pricing with automatic price discovery
- Anti-bot protection built in
- Auto-graduation to TraderJoe DEX at $69K market cap

### Forge Mode (Creator Mode)
Structured, accountable, transparent. For verified builders with real products.
- Creator verification required — apply, get reviewed, earn a verified badge
- Whitelist phases for early supporters
- Presale vault with on-chain fund locking
- Team token vesting with cliff and schedule
- All rules enforced by smart contracts — no trust required

---

## Architecture

```
User → LaunchpadRouterV2 (entry point)
 ├→ LaunchpadFactoryV2 (deploys token + curve via EIP-1167 clones)
 │   ├→ LaunchpadTokenV2 (ERC20, whitelist/blacklist, trading phases)
 │   └→ BondingCurveV2 (linear pricing, buy/sell execution)
 ├→ FeeManager (1% trades: 0.8% platform + 0.2% creator)
 ├→ CreatorRegistry (profiles, verification status)
 ├→ ActivityTracker (live feed, circular buffer)
 └→ LiquidityManager → TraderJoe Router (graduation)
     └→ LiquidityLocker (1-year LP lock)
```

### Forge Mode Flow
```
Creator verified → LaunchManager creates PresaleVault
  → Pre-sale opens → Contributors send AVAX to vault
  → Pre-sale closes → Vault locks
  → Token deployed → Allocations calculated
  → LP locked → DEX pool created
  → Team tokens vested → VestingContract enforces schedule
  → Contributors claim via Claim Page
  → Transparency Dashboard goes live
```

---

## Token Economics

| Property | Value |
|----------|-------|
| Total Supply | 1,000,000,000 (1B) per token |
| Bonding Curve | 800,000,000 (80%) — minted/burned on buy/sell |
| Liquidity Reserve | 200,000,000 (20%) — locked until graduation |
| Creation Fee | 0.02 AVAX (~$1) |
| Creator Initial Buy | 0–20% of supply at launch |
| Trading Fee | 1% (0.8% platform + 0.2% creator) |
| Graduation | 69,000 AVAX market cap → auto-migrate to TraderJoe |
| LP Lock | 1 year after graduation |

---

## Security

### Anti-Bot Protection
| Protection | Value |
|------------|-------|
| Trade Cooldown | 30 seconds between trades |
| Max Transaction | 1% of total supply |
| Max Wallet | 2% of total supply |
| Launch Protection | 5-minute window with stricter limits |

### Anti-Rug Features
- No presales or team allocations in Trenches mode
- Creator must buy from bonding curve like everyone else
- 1-year liquidity lock on graduation (LP tokens locked)
- All transactions transparent and on-chain
- Forge mode: verified creators only, vesting enforced by contract

### Smart Contract Security
- OpenZeppelin standards (ReentrancyGuard, Ownable, Pausable)
- EIP-1167 minimal proxy clones for gas-efficient deployment
- Custom errors for gas optimization
- Input validation on all external functions
- Emergency pause functionality

---

## Tech Stack

### Smart Contracts
- **Solidity 0.8.24** with via-IR optimization
- **Foundry** (forge, cast, anvil)
- **OpenZeppelin Contracts** (ERC20, access control, security)
- **EVM Target:** Cancun

### Frontend
- **React 19** + TypeScript + Vite 7
- **TanStack Query v5** for data fetching
- **viem** for blockchain interactions
- **Tailwind CSS** + shadcn/ui (Radix primitives)
- **Recharts** for price charts
- **GSAP** for animations

### Backend
- **Express.js** + TypeScript
- **SQLite** (better-sqlite3) for persistence
- **X (Twitter) OAuth** for authentication
- **Background price indexer** for real-time data

---

## Deployed Contracts (Fuji Testnet)

| Contract | Address |
|----------|---------|
| LaunchpadRouterV2 | `0x29292B61e820736E5920e8f0cc42C9D3e699f5eA` |
| LaunchpadFactoryV2 | `0xeD1A3Af4faA086BF4dff4Fa2cd4d49F0138DFad8` |
| FeeManager | `0xe033C8Bd9488844358f2a2D41267D51FD2a648B3` |
| LiquidityManager | `0xc52B09eca7cC3828adF692B4cd2f685dFF30e6B0` |
| LiquidityLocker | `0xFDC16396dcff7960B7ba9F3554a5C28576C2D9a8` |
| CreatorRegistry | `0x2BE70a5EC63FB415635956519D243c7c85C587E5` |
| ActivityTracker | `0xaBAeDD8b59Ee92D2d9266F9b07E9c6b92EfC142E` |
| TokenV2 (impl) | `0x8827948871eC905fA432dE3CAcbD43CAB54E1DaD` |
| BondingCurveV2 (impl) | `0xF36E5D363E057Ecd11D04D51F0f2955C15A0254b` |

**Deployer:** `0x7Df01967DC22d397b443E1A0e780B10EB440A828`
**DEX Router:** TraderJoe Fuji `0xd7f655E3376cE2D7A2b08fF01Eb3B1023191A901`

---

## Quick Start

### Prerequisites
- [Foundry](https://book.getfoundry.sh/getting-started/installation)
- Node.js 18+

### Smart Contracts

```bash
# Install dependencies
forge install

# Build
forge build

# Test
forge test -vvv

# Deploy to Fuji
forge script scripts/DeployV2.s.sol --tc DeployV2Script --rpc-url fuji --broadcast
```

### Frontend

```bash
cd frontend/app
npm install
npm run dev          # http://localhost:5173
```

### Backend

```bash
cd frontend/server
npm install
cp .env.example .env # Configure credentials
npx tsx index.ts     # http://localhost:3001
```

---

## Project Structure

```
cre8/
├── contracts/
│   ├── core/                    # Core launchpad contracts
│   │   ├── LaunchpadTokenV2.sol # ERC20 with whitelist/blacklist
│   │   ├── BondingCurveV2.sol   # Linear bonding curve
│   │   ├── LaunchpadFactoryV2.sol # Token factory (EIP-1167 clones)
│   │   ├── CreatorRegistry.sol  # Creator profiles & verification
│   │   ├── ActivityTracker.sol  # Live activity feed
│   │   ├── FeeManager.sol       # Fee collection/distribution
│   │   ├── LiquidityManager.sol # TraderJoe DEX integration
│   │   └── LiquidityLocker.sol  # LP token locking
│   ├── router/
│   │   └── LaunchpadRouterV2.sol # Main entry point
│   ├── forge/                   # Forge mode (structured launches)
│   │   ├── LaunchManager.sol    # Launch orchestrator
│   │   ├── PresaleVault.sol     # Presale fund locking
│   │   └── VestingContract.sol  # Team token vesting
│   ├── interfaces/              # Contract interfaces
│   ├── libraries/               # BondingCurveMath, errors
│   └── security/                # AntiBot, Pausable
├── test/                        # Foundry tests
├── scripts/                     # Deployment scripts
├── frontend/
│   ├── app/                     # React frontend (Vite)
│   │   └── src/
│   │       ├── components/      # UI components
│   │       ├── pages/           # Route pages
│   │       ├── hooks/           # Contract interaction hooks
│   │       ├── contexts/        # Auth context
│   │       └── config/          # ABIs, addresses, chain config
│   └── server/                  # Express.js backend
│       ├── routes/              # API endpoints
│       ├── middleware/          # Auth, validation
│       └── services/            # Price indexer, auth
└── foundry.toml                 # Foundry configuration
```

---

## Environment Variables

### Smart Contracts (.env)
```
PRIVATE_KEY=0x...
FUJI_RPC_URL=https://api.avax-test.network/ext/bc/C/rpc
AVALANCHE_RPC_URL=https://api.avax.network/ext/bc/C/rpc
SNOWTRACE_API_KEY=...
```

### Backend (frontend/server/.env)
```
TWITTER_CLIENT_ID=...
TWITTER_CLIENT_SECRET=...
TWITTER_CALLBACK_URL=http://localhost:3001/api/auth/callback
ENCRYPTION_KEY=...
SESSION_SECRET=...
PORT=3001
FRONTEND_URL=http://localhost:5173
INDEXER_API_KEY=...
ADMIN_API_KEY=...
```

---

## Roadmap

- [x] Core smart contracts (bonding curve, factory, router)
- [x] Anti-bot protection (cooldown, max tx/wallet, launch protection)
- [x] Fee management (platform + creator split)
- [x] Liquidity locking (1-year auto-lock on graduation)
- [x] Creator profiles & verification system
- [x] Activity tracking (live feed)
- [x] Easy & Pro launch modes
- [x] Frontend (React + Tailwind + shadcn/ui)
- [x] Backend API (Express + SQLite)
- [x] X (Twitter) OAuth authentication
- [x] Comment system (token discussion threads)
- [x] Fuji testnet deployment
- [ ] End-to-end integration testing
- [ ] Forge mode frontend (presale, vesting, claims)
- [ ] Mainnet deployment
- [ ] Security audit

---

## License

MIT

## Links

- **Website:** [cre8.bond](https://cre8.bond)
- **Network:** [Avalanche C-Chain](https://www.avax.network/)
- **DEX:** [TraderJoe](https://traderjoexyz.com/)
- **Competition:** [Avalanche Build Games 2026](https://build.avax.network/build-games)

---

> **Disclaimer:** Cre8 is under active development. All information in this document — including tokenomics, fee structures, contract addresses, and feature descriptions — is subject to change as the platform evolves and undergoes testing. Nothing here constitutes financial advice.
