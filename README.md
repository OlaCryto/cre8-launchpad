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
- **Presale vault** with hard cap and soft cap enforcement, on-chain fund locking
- **Whitelist phases** for early supporters before public trading
- **Team token vesting** with cliff period and linear release schedule
- **Presale announcements** — notify followers when a new presale opens
- All rules enforced by smart contracts — no trust required

---

## Architecture

```
User → LaunchpadRouterV2 (entry point for buy/sell/create)
 ├→ LaunchpadFactoryV2 (deploys token + curve via EIP-1167 clones)
 │   ├→ LaunchpadTokenV2 (ERC20, whitelist/blacklist, trading phases)
 │   └→ BondingCurveV2 (linear pricing, buy/sell execution)
 ├→ FeeManager (1% trades: 0.8% platform + 0.2% creator)
 ├→ CreatorRegistry (profiles, verification status)
 ├→ ActivityTracker (live feed, circular buffer of 1000 events)
 └→ LiquidityManager → TraderJoe Router (graduation)
     └→ LiquidityLocker (1-year LP lock)
```

### Forge Mode Flow
```
Creator verified → Dashboard: "Run Presale"
  → LaunchManager creates PresaleVault (hard cap, soft cap, max/wallet, duration)
  → Presale opens → Contributors send AVAX to vault
  → Presale closes (time or hard cap hit)
  → Dashboard: "Execute Launch" → Token deployed, presale AVAX buys on curve
  → Contributors claim tokens proportionally
  → Optional: whitelist phase → public trading
  → Optional: team tokens vest via VestingContract (cliff + linear release)
  → Auto-graduation to TraderJoe DEX at market cap threshold
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
- Presale vault: hard cap prevents over-raising, soft cap enables refunds if minimum not met
- 5% slippage protection on presale-to-curve buy

### Smart Contract Security
- OpenZeppelin standards (ReentrancyGuard, Ownable, Pausable)
- EIP-1167 minimal proxy clones for gas-efficient deployment
- Custom errors for gas optimization
- Input validation on all external functions
- Emergency pause functionality
- Creator fee withdrawal authorization (only creator can withdraw their fees)

---

## Tech Stack

### Smart Contracts
- **Solidity 0.8.24** with via-IR optimization
- **Foundry** (forge, cast, anvil) — 94 tests, 1000-run fuzz testing
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
- **Express.js** + TypeScript (38 API endpoints)
- **PostgreSQL** for persistence (10 tables)
- **X (Twitter) OAuth 2.0 PKCE** for authentication
- **Background price indexer** for historical data
- **Rate limiting** (global + per-route)

---

## Deployed Contracts (Fuji Testnet)

| Contract | Address |
|----------|---------|
| LaunchpadRouterV2 | [`0xecE29f311363b3689C838a7e12db20ddc32E9896`](https://testnet.snowtrace.io/address/0xecE29f311363b3689C838a7e12db20ddc32E9896) |
| LaunchpadFactoryV2 | [`0x0926707Dc7a64d63f37390d7C616352b180E807a`](https://testnet.snowtrace.io/address/0x0926707Dc7a64d63f37390d7C616352b180E807a) |
| LaunchManager | [`0x85B7572Fd253549dB38A638ddcDae1Cc40E2eF73`](https://testnet.snowtrace.io/address/0x85B7572Fd253549dB38A638ddcDae1Cc40E2eF73) |
| CreatorRegistry | [`0x699251A1Ee60E4396F9F2a911e4d42E7Eeb1A634`](https://testnet.snowtrace.io/address/0x699251A1Ee60E4396F9F2a911e4d42E7Eeb1A634) |
| FeeManager | [`0xa7D8Df017E9FbAaaf05Bd96381EB0b746038f9e9`](https://testnet.snowtrace.io/address/0xa7D8Df017E9FbAaaf05Bd96381EB0b746038f9e9) |
| LiquidityManager | [`0xcB9267e247ee1530066dBf6387f7A4c1EB7d4E47`](https://testnet.snowtrace.io/address/0xcB9267e247ee1530066dBf6387f7A4c1EB7d4E47) |
| LiquidityLocker | [`0xa0fC9fFa9595D9976341C9d998819fD33fc351c2`](https://testnet.snowtrace.io/address/0xa0fC9fFa9595D9976341C9d998819fD33fc351c2) |
| ActivityTracker | [`0x3831ec083AC3Bc9914A00Bc749fF0958d68DDA2B`](https://testnet.snowtrace.io/address/0x3831ec083AC3Bc9914A00Bc749fF0958d68DDA2B) |
| TokenV2 (impl) | [`0x79a08fD01BaEbA1807f0EEb17Af00e21F66671e8`](https://testnet.snowtrace.io/address/0x79a08fD01BaEbA1807f0EEb17Af00e21F66671e8) |
| BondingCurveV2 (impl) | [`0x53675d55Be1AFa990C6f43C814c42f2b02CBFdc0`](https://testnet.snowtrace.io/address/0x53675d55Be1AFa990C6f43C814c42f2b02CBFdc0) |

**Deployer:** `0x7Df01967DC22d397b443E1A0e780B10EB440A828`
**Treasury:** `0x1804c8AB1F12E6bbf3894d4083f33e07309d1f38`
**DEX Router:** TraderJoe Fuji `0xd7f655E3376cE2D7A2b08fF01Eb3B1023191A901`

---

## Quick Start

### Prerequisites
- [Foundry](https://book.getfoundry.sh/getting-started/installation)
- Node.js 20+
- PostgreSQL database (or use Supabase)

### Smart Contracts

```bash
# Install dependencies
forge install

# Build
forge build

# Test (94 tests)
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
npm run dev          # http://localhost:3001
```

---

## API Endpoints

The backend exposes 38 endpoints across 12 route files:

| Category | Endpoints | Auth |
|----------|-----------|------|
| **Auth** | OAuth flow, session, wallet key, dev-login, logout | Public / Session |
| **Users** | Batch fetch by wallet addresses | Public |
| **Creators** | Apply, check status, categories | Session |
| **Admin** | Review applications, stats | Admin key |
| **Comments** | CRUD + likes on token threads | Session |
| **Prices** | Latest price, history, snapshots | Public / API key |
| **Favorites** | Add/remove/list favorite tokens | Session |
| **Follows** | Follow/unfollow creators | Session |
| **Notifications** | Inbox CRUD, mark read | Session |
| **Presales** | Record events, announce to followers | Session |
| **Images** | Upload/serve token images | Session / Public |
| **Health** | `GET /health` | Public |

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
│   │   ├── PresaleVault.sol     # Presale fund locking (hard/soft cap)
│   │   └── VestingContract.sol  # Team token vesting (cliff + linear)
│   ├── interfaces/              # Contract interfaces
│   ├── libraries/               # BondingCurveMath, errors
│   └── security/                # AntiBot, Pausable
├── test/                        # Foundry tests (94 tests)
│   ├── LaunchpadV2.t.sol        # Core integration + gas tests
│   ├── BondingCurve.t.sol       # Curve math + fuzz tests
│   ├── LaunchpadFactory.t.sol   # Factory deployment tests
│   └── ForgeMode.t.sol          # Presale, vesting, launch manager tests
├── scripts/                     # Deployment scripts
├── frontend/
│   ├── app/                     # React frontend (Vite)
│   │   └── src/
│   │       ├── components/      # Sidebar, TradingChart, UI
│   │       ├── pages/           # Home, Create, TokenDetail, Presale, Vesting, Inbox, Dashboard
│   │       ├── hooks/           # useContracts, useForge, useTransactions
│   │       ├── contexts/        # AuthContext (Twitter OAuth)
│   │       └── config/          # ABIs, contract addresses, chain config
│   └── server/                  # Express.js backend
│       ├── routes/              # 12 route files (38 endpoints)
│       ├── middleware/          # Auth, validation, rate limiting
│       ├── services/            # Price indexer, Twitter OAuth, wallet gen
│       └── database.ts          # PostgreSQL schema + CRUD functions
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
TREASURY_ADDRESS=0x...
EMERGENCY_MULTISIG=0x...
```

### Backend (frontend/server/.env)
```
DATABASE_URL=postgresql://...        # PostgreSQL connection string
ENCRYPTION_KEY=...                   # 64-char hex (AES-256 for wallet encryption)
TWITTER_CLIENT_ID=...
TWITTER_CLIENT_SECRET=...
TWITTER_CALLBACK_URL=http://localhost:3001/api/auth/callback
FRONTEND_URL=http://localhost:5173
PORT=3001
ADMIN_API_KEY=...
INDEXER_API_KEY=...
FACTORY_ADDRESS=0x...                # For price indexer
FUJI_RPC_URL=https://api.avax-test.network/ext/bc/C/rpc
```

---

## Features Completed

- [x] Core smart contracts (bonding curve, factory, router)
- [x] Anti-bot protection (cooldown, max tx/wallet, launch protection)
- [x] Fee management (platform + creator split)
- [x] Liquidity locking (1-year auto-lock on graduation)
- [x] Creator profiles & verification system
- [x] Activity tracking (live feed)
- [x] Trenches Mode (Easy Launch) — permissionless token creation
- [x] Pro Launch — whitelist/blacklist phases
- [x] Forge Mode — presale vault with hard cap/soft cap
- [x] Forge Mode — team token vesting (cliff + linear)
- [x] Forge Mode — creator dashboard (presale, launch, announce)
- [x] Notification system — inbox with presale announcements
- [x] Creator follow system
- [x] Frontend (React + Tailwind + shadcn/ui)
- [x] Backend API (Express + PostgreSQL, 38 endpoints)
- [x] X (Twitter) OAuth 2.0 authentication
- [x] Comment system (token discussion threads)
- [x] Price indexer with historical data
- [x] Token type labels (Trenches vs Creator Launch)
- [x] Graduated token detection (TraderJoe + DexScreener redirect)
- [x] Security audit + fixes (30 vulnerabilities identified, critical/high fixed)
- [x] Fuji testnet deployment (all 10 contracts)
- [x] 94 passing tests (including 1000-run fuzz tests)

## Roadmap

- [ ] End-to-end integration testing on Fuji
- [ ] Community beta testing
- [ ] Featured Creator Launches homepage section
- [ ] Explore Creators page
- [ ] Mainnet deployment
- [ ] Professional security audit
- [ ] Governance & multisig admin

---

## Author

Built by [@NetWhizCrypto](https://x.com/NetWhizCrypto) for [Avalanche BuildGames 2026](https://build.avax.network/build-games)

## License

MIT

## Links

- **Website:** [cre8.bond](https://cre8.bond)
- **X (Twitter):** [@NetWhizCrypto](https://x.com/NetWhizCrypto)
- **Network:** [Avalanche C-Chain](https://www.avax.network/)
- **DEX:** [TraderJoe](https://traderjoexyz.com/)
- **Competition:** [Avalanche BuildGames 2026](https://build.avax.network/build-games)

---

> **Disclaimer:** Cre8 is under active development. All information in this document — including tokenomics, fee structures, contract addresses, and feature descriptions — is subject to change as the platform evolves and undergoes testing. Nothing here constitutes financial advice.
