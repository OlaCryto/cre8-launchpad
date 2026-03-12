# Cre8 — Whitepaper

**A Dual-Intent Token Launchpad on Avalanche C-Chain**

Version 1.0 · February 2026

---

## Abstract

The token launch ecosystem is broken. Every platform treats all token launches identically — a meme coin created in 30 seconds and a legitimate project backed by a real product go through the same undifferentiated process, appear in the same feed, and face the same speculation-driven dynamics. This creates an environment where creators can't signal legitimacy, users can't distinguish quality, and trust erodes constantly.

Cre8 solves this by introducing **dual-intent launching** — two distinct launch modes on a single platform, each designed for a fundamentally different purpose:

- **Trenches Mode** — permissionless, instant, zero-friction token creation for meme coins and community experiments
- **Forge Mode** — structured, verified, accountable token creation for builders with real products and long-term intent

Both modes share the same bonding curve mechanics and automatic DEX graduation, but Forge Mode layers on creator verification, presale vaults, team vesting, and whitelist phases — all enforced by smart contracts.

Cre8 is built on Avalanche C-Chain, leveraging its low fees (~$0.01 per transaction), sub-second finality, and deep DEX liquidity via TraderJoe.

---

## 1. The Problem

### 1.1 No Differentiation Between Token Types

Every existing launchpad — from pump.fun on Solana to Arena on Avalanche — lumps all tokens into a single undifferentiated pool. A creator who spent months building a product and wants to launch a utility token competes for attention with thousands of meme coins created in seconds. There is no mechanism to separate intent.

**The result:** Serious builders avoid these platforms entirely, or get drowned out by noise. Users default to treating every token as a short-term gamble.

### 1.2 No Creator Accountability

Permissionless launching is powerful but creates a trust vacuum. Anyone can launch a token, attract capital, and dump — repeatedly, with zero consequences. There is no reputation system, no verification layer, and no way for users to evaluate whether a creator is legitimate before committing funds.

**The result:** 98%+ of tokens launched on permissionless platforms go to zero. The few legitimate projects suffer by association.

### 1.3 Manual, Off-Platform Coordination

Current "structured" launches happen through Twitter threads and Discord DMs. Presale contributions are sent to personal wallet addresses. Airdrops are done manually by copying addresses from spreadsheets. Whitelist slots are awarded through social media engagement farming.

**The result:** Rugs happen constantly. Funds are never protected. There is no recourse when a creator disappears.

### 1.4 No On-Chain Enforcement

Even when creators make promises — locked liquidity, vesting schedules, fair distribution — there is nothing enforcing those promises. Locks can be circumvented. Vesting can be ignored. Liquidity can be pulled.

**The result:** Promises are meaningless without code. Users have learned to trust nothing, which kills legitimate projects before they start.

---

## 2. The Solution: Dual-Intent Launching

Cre8 introduces a simple but powerful framework: **two launch modes, one platform**.

### 2.1 Trenches Mode

Trenches is the permissionless lane. It mirrors the pump.fun model and is designed for:
- Meme coins and community tokens
- Quick experiments and social tokens
- Any launch where speed and simplicity matter more than structure

**How it works:**
1. Connect wallet, log in via X (Twitter)
2. Set token name, ticker, image, description
3. Choose initial buy percentage (0–20% of supply)
4. Pay 0.02 AVAX creation fee
5. Token is instantly live on the bonding curve

No verification required. No approval process. The token is tradeable immediately.

**Mechanics:**
- Virtual constant-product bonding curve (Pump.fun-style): price increases exponentially as supply is bought
- 80% of supply available on the curve, 20% reserved for DEX liquidity
- At 420 AVAX market cap (~87 AVAX invested), the token automatically "graduates" — liquidity migrates to TraderJoe with a 1-year LP lock
- Anti-bot protection: 30-second trade cooldown, 1% max transaction, 2% max wallet, 5-minute launch protection window

### 2.2 Forge Mode (Creator Mode)

Forge is the accountability lane. It is designed for:
- Builders with real products or platforms
- Teams that want structured fundraising
- Projects that need to signal legitimacy to their community

**To access Forge Mode, a creator must:**
1. Register a creator profile (handle, avatar, bio)
2. Submit a verification application with project details, product proof, social links, and team information
3. Pass admin review
4. Receive a verified creator badge (visible across the platform)

**Once verified, Forge Mode unlocks:**
- **Whitelist phases** — creator defines who can buy during an initial window before public trading opens
- **Presale vault** — contributors send AVAX to a smart contract vault that locks funds until the presale closes; no manual wallet transfers
- **Team vesting** — creator's token allocation is locked in a VestingContract with a cliff and linear release schedule
- **Locked liquidity** — LP tokens are locked in LiquidityLocker for a minimum of 1 year, publicly visible on-chain
- **Transparency dashboard** — every metric (raised, contributors, lock status, vesting schedule, supply) is visible on the token page

**The key difference:** Every promise is enforced by code. The creator cannot pull liquidity early. The vesting schedule cannot be accelerated. The vault cannot be drained before close. Users contribute knowing exactly what will happen to their funds.

---

## 3. How It Works

### 3.1 Token Creation Flow

```
Trenches:  Wallet → Create Form → Pay 0.02 AVAX → Token Live on Curve
Forge:     Verify → Create Form → Configure Presale → Deploy → Vault Opens
```

### 3.2 Bonding Curve Mechanics

Every Cre8 token trades on a virtual constant-product bonding curve (Pump.fun-style) before graduation:

```
Price = (virtualAvax × virtualTokens) / effectiveTokens²
where effectiveTokens = virtualTokens - currentSupply
```

- **Buying** mints new tokens from the curve, increasing the price exponentially
- **Selling** burns tokens back to the curve, decreasing the price
- The curve provides guaranteed liquidity at all times — no liquidity pool needed
- Early buyers get dramatically more tokens per AVAX — price accelerates as supply fills
- ~87 AVAX total investment fills the curve to graduation
- 1% trading fee on every transaction (protocol fee, configurable creator share)

### 3.3 Graduation

When a token's market cap reaches **420 AVAX** (~$10.5K at current prices):

1. Trading on the bonding curve stops
2. The reserved 20% of token supply is paired with accumulated AVAX
3. Liquidity is added to TraderJoe DEX
4. LP tokens are locked in LiquidityLocker for 1 year
5. The token is now tradeable on the open market

Graduation is automatic and irreversible. No human intervention required.

### 3.4 Creator Verification Flow (Forge Mode)

```
1. Creator submits application
   ├── Project name, category, description
   ├── Product proof (URL to working product)
   ├── Social links (X, Telegram, Discord, website)
   ├── Team information
   ├── Token utility description
   └── Roadmap

2. Admin reviews application
   ├── Evaluates product legitimacy
   ├── Checks social presence
   └── Approves or rejects with notes

3. On approval
   ├── CreatorRegistry updated on-chain (isVerified = true)
   ├── Verified badge appears on creator profile
   └── Forge Mode features unlocked
```

### 3.5 Forge Mode Launch Flow

```
Verified creator starts launch
  → Configure presale: target raise, duration, whitelist
  → Deploy: LaunchManager creates PresaleVault
  → Presale opens: contributors send AVAX to vault
  → Presale closes: vault locks, no more contributions
  → Token deployed: allocations calculated from contributions
  → LP locked: liquidity added to TraderJoe, LP tokens locked
  → Vesting starts: team tokens locked with cliff + schedule
  → Contributors claim: connect wallet, see allocation, claim tokens
  → Public trading opens
```

---

## 4. Smart Contract Architecture

Cre8 uses a modular contract architecture where each contract handles a single responsibility. All token and bonding curve deployments use **EIP-1167 minimal proxy clones** for gas efficiency (~$0.10 per deployment vs ~$50 for full deployments).

### 4.1 Core Contracts

| Contract | Purpose |
|----------|---------|
| **LaunchpadRouterV2** | Single entry point for all user interactions (create, buy, sell) |
| **LaunchpadFactoryV2** | Deploys token + bonding curve pairs as minimal proxy clones |
| **LaunchpadTokenV2** | ERC20 with whitelist/blacklist and trading phase enforcement |
| **BondingCurveV2** | Constant-product pricing engine, handles buy/sell execution |
| **FeeManager** | Collects and distributes trading fees (platform + creator split) |
| **LiquidityManager** | Handles graduation — adds liquidity to TraderJoe |
| **LiquidityLocker** | Locks LP tokens with time-based release |
| **CreatorRegistry** | Stores creator profiles, handles, avatars, verification status |
| **ActivityTracker** | Circular buffer of last 1,000 platform events (trades, launches, graduations) |

### 4.2 Forge Mode Contracts

| Contract | Purpose |
|----------|---------|
| **LaunchManager** | Orchestrates the full Forge mode launch lifecycle |
| **PresaleVault** | Accepts and locks AVAX contributions during presale |
| **VestingContract** | Locks team tokens with configurable cliff and vesting schedule |

### 4.3 Security Contracts

| Contract | Purpose |
|----------|---------|
| **AntiBot** | Trade cooldowns, max tx/wallet limits, launch protection window |
| **Pausable** | Emergency pause functionality for all contracts |

---

## 5. Fee Structure

| Fee | Amount | Recipient |
|-----|--------|-----------|
| Token Creation | 0.02 AVAX | Platform Treasury |
| Trading (buy/sell) | 1.0% | 0.8% Platform + 0.2% Creator |
| Graduation | 1.5% | Platform Treasury |

Creator fees are distributed automatically on every trade. Creators earn passive income from their token's trading volume for the life of the token.

---

## 6. Why Avalanche

Cre8 is built exclusively on Avalanche C-Chain for several reasons:

1. **Low fees** — Transactions cost ~$0.01, making vault interactions, claim transactions, and frequent trading economically viable for all users
2. **Fast finality** — Sub-second transaction finality means trades execute instantly, enabling the real-time experience users expect
3. **EVM compatibility** — Full Solidity support with modern EVM features (Cancun target)
4. **DEX infrastructure** — TraderJoe provides deep liquidity and a proven router for graduation
5. **Growing ecosystem** — Avalanche's builder programs and grants create a natural user base for a launchpad

---

## 7. Competitive Landscape

| Feature | pump.fun (Solana) | Arena (Avalanche) | Cre8 (Avalanche) |
|---------|-------------------|-------------------|-------------------|
| Chain | Solana | Avalanche | Avalanche |
| Launch cost | ~$1 | Varies | ~$1 (0.02 AVAX) |
| Bonding curve | Exponential | AMM-style | Virtual constant-product (Pump.fun-style) |
| Auto-graduation | Yes ($69K) | No | Yes (420 AVAX) |
| LP lock | Burned | N/A | 1-year lock |
| Anti-bot | Limited | Limited | Full suite |
| Creator verification | No | No | Yes (Forge Mode) |
| Presale vault | No | No | Yes (on-chain) |
| Team vesting | No | No | Yes (enforced) |
| Creator fees | Revenue share (PUMP token) | Ticket fees | 0.2% of all trades |
| Dual-mode launch | No | No | Yes |

**Cre8's unique advantage:** No other platform offers dual-intent launching. The separation of speculative (Trenches) and structured (Forge) launches is a first-of-its-kind approach.

---

## 8. Roadmap

### Phase 1: Foundation (Complete)
- Core smart contracts deployed to Fuji testnet
- Bonding curve, factory, router, fee management
- Anti-bot protection
- Creator registry and verification
- Activity tracking
- Frontend MVP (React + Tailwind)
- Backend API (Express + SQLite)
- X (Twitter) OAuth authentication

### Phase 2: MVP Polish (In Progress — Build Games)
- End-to-end integration with deployed contracts
- Forge mode frontend (presale dashboard, vesting, claims)
- Real-time price feeds and trade activity
- Comment system and social layer
- Mobile responsive design

### Phase 3: Mainnet Launch
- Security audit
- Mainnet deployment
- Contract verification on Snowtrace
- Production infrastructure
- Community launch

### Phase 4: Growth
- Creator bond mechanism (stake AVAX as accountability deposit)
- Reputation layer (creator success history, public scoring)
- Advanced anti-sniper (Merkle proof whitelists, MEV protection)
- Revenue sharing for long-surviving tokens
- Mobile app
- Multi-chain expansion

---

## 9. Team

Built by [@NetWhizCrypto](https://x.com/NetWhizCrypto) — a long-time Avalanche community member and Arena power user who experienced firsthand the problems Cre8 solves. The platform is born from real frustration with the status quo, not theoretical research.

---

## 10. Conclusion

Cre8 doesn't try to reinvent token launching. It takes the proven bonding curve model popularized by pump.fun, adapts it for Avalanche, and adds the one thing no platform has: **intent separation**.

Trenches mode serves the degen culture that drives crypto adoption. Forge mode serves the builders who create lasting value. Both coexist on the same platform, and users can move between them freely.

The result is a launchpad where meme coins can thrive without drowning out real projects, and real projects can launch without being treated like meme coins.

**Cre8 — We separate speculation from structured capital formation.**

---

*Built on Avalanche C-Chain · [cre8.bond](https://cre8.bond) · February 2026*

> **Disclaimer:** This whitepaper is a living document. All information — including tokenomics, fee structures, technical architecture, and feature descriptions — is subject to change as Cre8 develops and undergoes testing. Nothing in this document constitutes financial advice.
