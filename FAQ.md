# Cre8 — Frequently Asked Questions

---

## General

### What is Cre8?
Cre8 is a dual-intent token launchpad built on Avalanche C-Chain. It lets anyone launch a token in under 60 seconds for about $1, with two distinct modes: **Trenches** for meme coins and quick launches, and **Forge** for verified creators building real products. Every token trades on a bonding curve with automatic price discovery and auto-graduates to TraderJoe DEX when it hits a $69K market cap.

### How is Cre8 different from pump.fun?
pump.fun pioneered the bonding curve launchpad model on Solana. Cre8 brings that same core mechanic to Avalanche but adds something no launchpad has: **dual-intent launching**. Trenches mode works like pump.fun — fast, permissionless, no friction. But Forge mode adds creator verification, presale vaults, team vesting, and whitelist phases — all enforced by smart contracts. Pump.fun treats every token the same; Cre8 lets users see the difference between a meme coin and a verified project.

### How is Cre8 different from Arena?
Arena is a social platform on Avalanche with tickets, groups, and a built-in token launcher. But Arena's token launcher doesn't differentiate between types of tokens. Every launch goes into the same pool, which means serious creators compete with thousands of low-effort meme coins. Cre8 solves this with the Trenches/Forge split and a creator verification system that gives legitimate builders a verified badge and access to structured launch tools.

### What blockchain is Cre8 built on?
Avalanche C-Chain. Transactions cost about $0.01, finality is sub-second, and TraderJoe provides deep DEX liquidity for graduated tokens.

### Is Cre8 live?
Cre8 is currently deployed on Avalanche's Fuji testnet. Mainnet launch is coming soon.

---

## Trenches Mode

### What is Trenches mode?
Trenches is the permissionless lane. Anyone can launch a token instantly without verification. It's designed for meme coins, community tokens, and experiments. Think of it as the "degen" side of Cre8.

### How do I launch a token in Trenches?
1. Connect your wallet and log in with X (Twitter)
2. Click "Create" and fill in your token details (name, ticker, image, description)
3. Choose your initial buy percentage (0–20% of supply)
4. Pay 0.02 AVAX (~$1) creation fee
5. Your token is instantly live and tradeable

### How much does it cost to launch?
0.02 AVAX, which is roughly $1 at current prices. That covers the contract deployment using gas-efficient minimal proxy clones.

### Do I need to be verified to launch in Trenches?
No. Trenches is fully permissionless. Anyone with a wallet can launch.

### Can I buy my own token at launch?
Yes. You can set an initial buy percentage from 0% to 20% of the total supply. This buy goes through the bonding curve just like any other purchase — no special allocation.

---

## Forge Mode (Creator Mode)

### What is Forge mode?
Forge is the structured lane for verified creators. It's designed for builders who have real products, real teams, and want to launch a token with accountability and transparency. Forge mode includes whitelist phases, presale vaults, team vesting, and locked liquidity — all enforced by smart contracts.

### Who is Forge mode for?
- Creators who have built a product, platform, or community
- Teams that want structured fundraising without manual chaos
- Projects that need to signal legitimacy to their audience
- Anyone who wants their token to be clearly differentiated from meme coins

### How do I get verified for Forge mode?
1. Create your account on Cre8
2. Go to the Creator section and submit a verification application
3. Provide your project details: name, category, description, product proof, social links, team info, token utility, and roadmap
4. Your application is reviewed by the Cre8 team
5. On approval, you receive a verified creator badge and Forge mode is unlocked

### What happens if my application is rejected?
You'll receive feedback explaining why. You can address the issues and reapply. Rejection from Forge mode doesn't affect your ability to launch in Trenches.

### What does the verified badge mean?
The verified badge appears next to your name across the platform. It tells users that your identity and project have been reviewed and that you've met the criteria for creator verification. It does NOT guarantee the success of your token — it signals that you are a real builder with a real product.

### What features does Forge mode unlock?
- **Whitelist phases** — choose who can buy first before public trading opens
- **Presale vault** — contributors send funds to a smart contract (not your personal wallet)
- **Team vesting** — your team's tokens are locked with a cliff and release schedule
- **Locked liquidity** — LP tokens are locked for a minimum of 1 year

---

## Bonding Curve & Trading

### How does the bonding curve work?
Every Cre8 token trades on a virtual constant-product bonding curve (Pump.fun-style) before graduation. When you buy, new tokens are minted and the price goes up exponentially. When you sell, tokens are burned and the price goes down. The curve provides guaranteed liquidity at all times.

### What is the pricing formula?
Cre8 uses a virtual constant-product AMM: `Price = virtualAvax × virtualTokens / effectiveTokens²`

Early buyers get dramatically more tokens per AVAX than later buyers — the price accelerates as supply is purchased, creating strong early-buyer incentives.

### What is the total supply per token?
1,000,000,000 (1 billion) tokens per launch. 80% (800M) is available on the bonding curve, and 20% (200M) is reserved for DEX liquidity at graduation.

### What are the trading fees?
1% on every buy and sell. Of that 1%:
- 0.8% goes to the Cre8 platform treasury
- 0.2% goes to the token creator

Creators earn passive income from their token's trading volume.

### What is graduation?
When a token's market cap hits **420 AVAX**, it "graduates" — trading on the bonding curve stops, the reserved 20% of tokens is paired with accumulated AVAX, liquidity is added to TraderJoe DEX, and LP tokens are locked for 1 year. The token is now tradeable on the open market.

### Is graduation automatic?
Yes. No human intervention is needed. The smart contract handles the entire migration process.

### Can the creator pull liquidity after graduation?
No. LP tokens are locked in the LiquidityLocker contract for 1 year. This is enforced by code — the creator cannot circumvent it.

---

## Security & Anti-Bot

### How does Cre8 prevent bots?
Every token launch has built-in anti-bot protection:
- **30-second cooldown** between trades per wallet
- **1% max transaction** — no wallet can buy more than 1% of supply in a single trade
- **2% max wallet** — no wallet can hold more than 2% of total supply
- **5-minute launch protection** — stricter limits during the first 5 minutes after launch

### Can tokens be rugged?
Cre8 minimizes rug risk through multiple mechanisms:
- In Trenches mode, creators must buy from the bonding curve like everyone else — no hidden allocations
- Liquidity is locked automatically for 1 year on graduation
- In Forge mode, team tokens are locked in a vesting contract with a cliff and schedule
- All transactions are on-chain and transparent

### Are the smart contracts audited?
The contracts use battle-tested OpenZeppelin libraries and follow standard security patterns (ReentrancyGuard, Ownable, Pausable). A professional audit is planned before mainnet launch.

---

## Platform & Technical

### What wallet do I need?
Any wallet that supports Avalanche C-Chain works — MetaMask, Core Wallet, Rabby, etc.

### Do I need to sign up?
You log in with your X (Twitter) account. The platform generates a platform wallet for you, so you don't need to manually manage private keys if you don't want to.

### What is the tech stack?
- **Smart Contracts:** Solidity 0.8.24, Foundry, OpenZeppelin
- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS, shadcn/ui
- **Backend:** Express.js, SQLite, X OAuth
- **Blockchain:** Avalanche C-Chain, TraderJoe DEX

### Where are the contracts deployed?
Currently on Avalanche's Fuji testnet. All contract addresses are listed in the project README.

---

## Fees

| Action | Fee | Goes To |
|--------|-----|---------|
| Create a token | 0.02 AVAX (~$1) | Platform |
| Buy/Sell trades | 1% | 0.8% Platform + 0.2% Creator |
| Graduation | 1.5% | Platform |

### Do creators make money?
Yes. Creators earn 0.2% of every trade on their token. If your token does $100,000 in trading volume, you earn $200 in creator fees — automatically, without doing anything.

---

## Competition & Roadmap

### Is Cre8 part of a competition?
Yes. Cre8 is an official entry in the [Avalanche Build Games 2026](https://build.avax.network/build-games), a $1,000,000 builder competition hosted by Ava Labs.

### What's the roadmap?
**Now:** Core smart contracts deployed on Fuji, frontend MVP live, backend API operational, creator verification system built.

**Next:** End-to-end integration, Forge mode frontend, mainnet deployment.

**Future:** Creator bond mechanism (skin-in-the-game deposits), reputation scoring, advanced anti-sniper tools, revenue sharing, mobile app, multi-chain expansion.

---

## Community

### Where can I follow Cre8?
- **Website:** [cre8.bond](https://cre8.bond)
- **X (Twitter):** [@NetWhizCrypto](https://x.com/NetWhizCrypto)

### How can I get involved?
Launch a token on testnet, provide feedback, and follow the project. Early supporters will be recognized.

---

*Last updated: February 2026*

> **Note:** Cre8 is under active development. All information in this FAQ is subject to change as the platform evolves and gets tested. Nothing here constitutes financial advice.
