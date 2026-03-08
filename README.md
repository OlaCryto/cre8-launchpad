# Cre8

**Token Launchpad on Avalanche C-Chain**

Launch tokens in under 60 seconds for ~$1. Two modes — Easy for anyone, Forge for verified creators with anti-bot protection.

> **Live MVP:** [cre8app.net](https://cre8app.net) | **Network:** Avalanche C-Chain (Fuji Testnet) | **Built for:** [Avalanche Build Games 2026](https://build.avax.network/build-games)

---

## What is Cre8?

Cre8 is a token launchpad that makes fair-launch token creation ultra-cheap and accessible on Avalanche. Every token starts on a bonding curve with automatic price discovery, and auto-graduates to TraderJoe DEX when it hits the market cap threshold.

### Easy Mode (Trenches)
Open, fast, permissionless. For meme coins, community tokens, and experiments.
- Launch a token in under 60 seconds for 0.02 AVAX (~$1)
- No registration required — connect wallet and go
- Bonding curve pricing with automatic price discovery
- Auto-graduation to TraderJoe DEX at 69,000 AVAX market cap

### Forge Mode (Creator)
Structured launches for verified creators with anti-bot protection.
- Creator verification required — apply, get reviewed, earn a verified badge
- **Whitelist phase** — early access window for selected wallets (1–60 min)
- **Max wallet limit** — cap how much AVAX any single wallet can spend
- **Max transaction limit** — cap individual buy sizes
- **Blacklist** — block known bots and bad actors
- All rules enforced on-chain by Cre8Manager

---

## Architecture

Cre8 uses a single upgradeable contract (UUPS proxy pattern) that handles everything:

```
User → Cre8Manager (UUPS Proxy)
         ├→ createToken()       — Easy Mode launch
         ├→ createTokenForge()  — Forge Mode launch (whitelist + anti-bot)
         ├→ buy() / sell()      — Bonding curve trading
         ├→ graduate()          — Auto-migrate to TraderJoe DEX
         ├→ updateWhitelist()   — Manage whitelist (creator only)
         └→ updateBlacklist()   — Manage blacklist (creator only)

External:
  LiquidityManager → TraderJoe Router (graduation)
  LiquidityLocker  → LP token locking (1 year)
```

Each token is deployed as an EIP-1167 minimal proxy clone for gas efficiency. The bonding curve math is embedded in Cre8Manager — no separate curve contracts needed.

---

## Token Economics

| Property | Value |
|----------|-------|
| Total Supply | 1,000,000,000 (1B) per token |
| Bonding Curve | 800,000,000 (80%) — minted/burned on buy/sell |
| Liquidity Reserve | 200,000,000 (20%) — locked until graduation |
| Creation Fee | 0.02 AVAX (~$1) |
| Creator Initial Buy | 0–20% of supply at launch |
| Trading Fee | 1% per trade |
| Graduation Threshold | 69,000 AVAX market cap → auto-migrate to TraderJoe |
| LP Lock | 1 year after graduation |

---

## Anti-Bot Protection

| Protection | Default | Forge Mode |
|------------|---------|------------|
| Trade Cooldown | 30 seconds | 30 seconds |
| Max Transaction | 1% of supply | Configurable by creator |
| Max Wallet | 2% of supply | Configurable by creator |
| Launch Protection | 5-minute window | Whitelist phase (1–60 min) |
| Blacklist | - | Creator can block addresses |

---

## Deployed Contracts (Fuji Testnet)

| Contract | Address |
|----------|---------|
| **Cre8Manager (Proxy)** | [`0x4e972F92461AE6bc080411723C856996Dbe1591E`](https://testnet.snowtrace.io/address/0x4e972F92461AE6bc080411723C856996Dbe1591E) |
| LiquidityManager | [`0xcB9267e247ee1530066dBf6387f7A4c1EB7d4E47`](https://testnet.snowtrace.io/address/0xcB9267e247ee1530066dBf6387f7A4c1EB7d4E47) |
| LiquidityLocker | [`0xa0fC9fFa9595D9976341C9d998819fD33fc351c2`](https://testnet.snowtrace.io/address/0xa0fC9fFa9595D9976341C9d998819fD33fc351c2) |

**DEX Router:** TraderJoe Fuji [`0xd7f655E3376cE2D7A2b08fF01Eb3B1023191A901`](https://testnet.snowtrace.io/address/0xd7f655E3376cE2D7A2b08fF01Eb3B1023191A901)

---

## Tech Stack

### Smart Contracts
- **Solidity 0.8.24** with via-IR optimization
- **Foundry** (forge, cast, anvil) for development and testing
- **OpenZeppelin** — ERC20, UUPS proxy, ReentrancyGuard, Pausable
- **EIP-1167** minimal proxy clones for cheap token deployment

### Frontend
- **React 19** + TypeScript + Vite
- **viem** for blockchain interactions
- **TanStack Query v5** for data fetching
- **Tailwind CSS** + shadcn/ui (Radix primitives)
- **Recharts** for price charts
- **GSAP** for animations

### Backend
- **Express.js** + TypeScript
- **PostgreSQL** for persistence
- **Google OAuth 2.0** for authentication
- **Background price indexer** for historical data

### Infrastructure
- **Frontend:** Cloudflare Pages
- **Backend:** Railway
- **Database:** Railway PostgreSQL
- **Contracts:** Avalanche Fuji C-Chain

---

## Quick Start

### Prerequisites
- [Foundry](https://book.getfoundry.sh/getting-started/installation)
- Node.js 20+
- PostgreSQL database

### Smart Contracts

```bash
forge install
forge build
forge test -vvv
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

## Project Structure

```
cre8/
├── contracts/
│   ├── Cre8Manager.sol          # Main contract (UUPS proxy) — token creation, trading, graduation
│   ├── LaunchpadToken.sol       # ERC20 token template (deployed as clones)
│   ├── LiquidityManager.sol     # TraderJoe DEX integration
│   ├── LiquidityLocker.sol      # LP token locking (1 year)
│   ├── libraries/               # BondingCurveMath, errors
│   └── security/                # AntiBot protection
├── test/                        # Foundry tests
├── scripts/                     # Deployment scripts
├── frontend/
│   ├── app/                     # React frontend (Vite)
│   │   └── src/
│   │       ├── components/      # Sidebar, TradingChart, UI components
│   │       ├── pages/           # Home, Create, TokenDetail, Dashboard, Profile
│   │       ├── hooks/           # useContracts, useForge, useTransactions
│   │       ├── contexts/        # AuthContext (Google OAuth)
│   │       └── config/          # ABIs, contract addresses, chain config
│   └── server/                  # Express.js backend
│       ├── routes/              # API routes
│       ├── middleware/          # Auth, validation, rate limiting
│       ├── services/            # Price indexer, Google OAuth
│       └── database.ts          # PostgreSQL schema + queries
└── foundry.toml
```

---

## Features

- [x] Single upgradeable contract (UUPS proxy) architecture
- [x] Easy Mode — permissionless token creation in 60 seconds
- [x] Forge Mode — whitelist, max wallet, max tx, blacklist protection
- [x] Bonding curve pricing with automatic price discovery
- [x] Auto-graduation to TraderJoe DEX at market cap threshold
- [x] 1-year LP token locking on graduation
- [x] Anti-bot protection (cooldown, max tx/wallet, launch protection)
- [x] Creator verification system with dashboard
- [x] Google OAuth 2.0 authentication
- [x] Comment threads on token pages
- [x] Creator follow system + notifications
- [x] Price charts with historical data
- [x] Live activity feed
- [x] Desktop-optimized UI
- [x] Fuji testnet deployment

---

## How to Test the MVP

1. Visit [cre8app.net](https://cre8app.net)
2. Connect your wallet (you'll need Fuji testnet AVAX — get from [Avalanche Faucet](https://faucet.avax.network/))
3. Click **Create** to launch a token (costs 0.02 AVAX)
4. Your token appears instantly on the homepage with a bonding curve
5. Buy/sell tokens — price moves along the curve
6. Sign in with Google to comment, follow creators, and access the Creator Dashboard

---

## Author

Built by [@NetWhizCrypto](https://x.com/NetWhizCrypto) for [Avalanche Build Games 2026](https://build.avax.network/build-games)

## License

MIT

## Links

- **Live MVP:** [cre8app.net](https://cre8app.net)
- **X (Twitter):** [@NetWhizCrypto](https://x.com/NetWhizCrypto)
- **Network:** [Avalanche C-Chain](https://www.avax.network/)
- **DEX:** [TraderJoe](https://traderjoexyz.com/)
- **Competition:** [Avalanche Build Games 2026](https://build.avax.network/build-games)

---

> **Disclaimer:** Cre8 is under active development on Fuji testnet. All information — including tokenomics, fee structures, contract addresses, and features — is subject to change. Nothing here constitutes financial advice.
