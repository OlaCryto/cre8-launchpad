# Cre8 — Security Audit Report

> **Date:** March 5, 2026
> **Auditor:** Automated deep audit (smart contracts + backend + frontend)
> **Scope:** All attack surfaces — DeFi exploits, web vulnerabilities, access control, key management
> **Status:** Pre-mainnet review

---

## Severity Summary

| Severity | Count | Description |
|----------|-------|-------------|
| **Critical** | 5 | Immediate fund loss or total compromise possible |
| **High** | 7 | Significant financial or security impact |
| **Medium** | 8 | Exploitable under certain conditions |
| **Low** | 10 | Minor issues, griefing, or design concerns |
| **Total** | **30** | |

---

## Critical Vulnerabilities

### CRIT-1: Private Key Stored in localStorage — XSS = Total Fund Theft

**File:** `frontend/app/src/contexts/AuthContext.tsx:108-151`

**How it works now:** After login, the server decrypts the user's private key and sends it to the frontend. The frontend stores it in `localStorage` as part of the `cre8_user` JSON object.

**Attack:** Any XSS vulnerability anywhere on the site allows an attacker to run:
```javascript
JSON.parse(localStorage.getItem('cre8_user')).wallet.privateKey
```
This exfiltrates every logged-in user's private key. XSS could come from: stored XSS in comments, token names/descriptions, social links, or a compromised third-party dependency.

**Impact:** Total fund theft. Attacker gains full control of every user's custodial wallet.

**Fix:** Never send or store raw private keys in the browser. Options:
1. Server-side transaction signing (user submits intent, server signs and broadcasts)
2. Non-custodial wallets (MetaMask/Core — user holds their own key)
3. Secure enclave (WebCrypto non-extractable key in iframe sandbox)

**Note:** This is the same architecture Pump.fun uses (custodial wallet in browser), so it's acceptable for MVP/testnet. But must be addressed before mainnet with real funds.

---

### CRIT-2: API Endpoint Returns Raw Private Key Over HTTP

**File:** `frontend/server/routes/auth.ts:104-128`

**Attack:** `POST /api/auth/wallet-key` decrypts and returns the user's raw private key in the response body. Anyone who steals a session token (via XSS, network sniffing, log exposure) can call this endpoint.

**Impact:** Complete wallet compromise for the victim.

**Fix:** Remove this endpoint. Implement server-side transaction signing.

---

### CRIT-3: Single Encryption Key for All User Wallets

**File:** `frontend/server/services/wallet.ts:6-12`

**Attack:** One `ENCRYPTION_KEY` env var protects every user's private key. If this key leaks (env exposure, backup, Railway dashboard compromise, `.env` in git), every wallet is instantly compromised.

**Impact:** Catastrophic — all user funds stolen simultaneously.

**Fix:** Per-user key derivation with HKDF + user-specific salt. Or use HSM/KMS for key wrapping. Long-term: migrate to non-custodial wallets.

---

### CRIT-4: Cross-Contract Reentrancy Risk in Sell Flow

**File:** `contracts/core/BondingCurveV2.sol:325-370`

**Attack:** The `sell()` function updates state then sends AVAX via low-level call. While `nonReentrant` is on the BondingCurve's `sell()`, the cross-contract interaction between Router and BondingCurve creates a gap. A malicious contract receiving AVAX could re-enter the Router (different contract) to call `buy()` while the price is manipulated.

**Impact:** Price manipulation, potential fund extraction.

**Mitigation already present:** Checks-effects-interactions pattern is mostly followed. `nonReentrant` on the curve prevents direct re-entry.

**Fix:** Add global reentrancy lock across Router+Curve. Consider pull-over-push for AVAX payouts.

---

### CRIT-5: withdrawCreatorFees() Has No Access Control

**File:** `contracts/core/FeeManager.sol:253-266`

**Attack:** Anyone can call `withdrawCreatorFees(address creator)` for any creator. While AVAX goes to the creator address (not the caller), if the creator is a contract that reverts on receive, fees are permanently locked. Also creates a griefing vector (forcing unwanted ETH transfers to contracts).

**Impact:** Fee lockup, griefing, forced gas consumption.

**Fix:** Require `msg.sender == creator`. Only creators can withdraw their own fees.

---

## High Severity

### HIGH-1: Creator Can Blacklist Buyers — Trapping Their Funds

**File:** `contracts/core/LaunchpadTokenV2.sol:358-386`

**Attack:** In Pro Launch mode, the creator can add addresses to the blacklist after they've bought tokens. Blacklisted addresses cannot transfer or sell. Creator blacklists large holders, sells their own position, then removes blacklist.

**Impact:** Direct financial loss to targeted users. This is a form of rug pull.

**Fix:** Blacklisted users should always be able to sell back to the bonding curve. Limit blacklist to preventing new purchases, not sales.

---

### HIGH-2: No Slippage Protection on Presale Curve Buy

**File:** `contracts/forge/LaunchManager.sol:351`

**Attack:** `curve.buy{value: totalAvax}(0)` — the `minTokensOut` is hardcoded to `0`. A frontrunner can sandwich this transaction.

**Impact:** Presale contributors receive significantly fewer tokens than expected.

**Fix:** Calculate expected output and pass a reasonable `minTokensOut`.

---

### HIGH-3: Owner Can Replace Token/Curve Implementations (Backdoor)

**File:** `contracts/core/LaunchpadFactoryV2.sol:190-199`

**Attack:** Factory owner calls `setTokenImplementation()` to point to a malicious contract with a hidden `drainAll()` function. All future clones inherit the backdoor.

**Impact:** Rug pull of all future token launches.

**Fix:** Timelock on implementation changes. Multi-sig ownership. Consider making implementations immutable.

---

### HIGH-4: Emergency Withdraw Functions — Owner Can Drain Funds

**Files:** `LaunchpadFactoryV2.sol:697-710`, `LaunchpadRouterV2.sol:596-605`, `LiquidityManager.sol:358-371`

**Attack:** Owner calls `emergencyWithdraw()` to extract any tokens or AVAX held by these contracts. During graduation, significant AVAX flows through the Factory.

**Impact:** Owner steals funds mid-transaction or accumulated fees.

**Fix:** Timelock + multi-sig for emergency withdrawals. Public announcement period.

---

### HIGH-5: Emergency LP Unlock Controlled by Single Address

**File:** `contracts/core/LiquidityLocker.sol:227-252`

**Attack:** `emergencyMultisig` can unlock any LP tokens immediately. Owner can also change the multisig address via `setEmergencyMultisig()`. Chain: change multisig → emergency unlock → steal all LP.

**Impact:** Complete rug pull of all graduated token liquidity.

**Fix:** Actual multi-sig verification. Timelock on address changes. Governance vote requirement.

---

### HIGH-6: Admin API Key — No Rate Limiting

**File:** `frontend/server/routes/admin.ts:9-19`

**Attack:** Admin routes have no rate limiting. Attacker brute-forces `x-admin-key` header.

**Impact:** Full admin access — approve/reject creator applications.

**Fix:** Rate limit admin routes. Use proper auth (not static key). IP allowlisting.

---

### HIGH-7: Session Token Exposed in URL

**File:** `frontend/server/routes/auth.ts:71`

**Attack:** After OAuth, session token is in the redirect URL: `/auth/callback?session=TOKEN`. Exposed in browser history, server logs, referrer headers.

**Impact:** Session hijacking if logs are leaked.

**Fix:** Use HTTP-only secure cookies, or short-lived one-time exchange codes.

---

## Medium Severity

### MED-1: Sandwich Attacks on All Trades

**File:** `contracts/core/BondingCurveV2.sol:265-317`

**Attack:** Standard MEV sandwich. Attacker frontrunns buy, victim executes at worse price, attacker backruns with sell. Anti-bot cooldown is per-address, so multiple addresses bypass it.

**Mitigation present:** Slippage protection (`minTokensOut`).

**Fix:** Ensure frontend sets tight slippage defaults. Consider commit-reveal or private mempool.

---

### MED-2: Dev Login NODE_ENV Bypass

**File:** `frontend/server/routes/auth.ts:131-201`

**Attack:** Dev login checks `NODE_ENV === 'production'`. If env var is unset or set to anything else, endpoint is open. Grants full authenticated access with creator privileges.

**Fix:** Default to blocking. Use explicit `ENABLE_DEV_LOGIN=true` flag.

---

### MED-3: Graduation 5% Slippage — MEV Extraction

**File:** `contracts/core/LaunchpadFactoryV2.sol:550-551`

**Attack:** Liquidity added with 5% slippage tolerance. MEV bots can extract up to 5% of graduation liquidity by manipulating the DEX pair.

**Impact:** Thousands of AVAX extracted per graduation.

**Fix:** Tighter slippage. Atomic pair creation. Private transaction submission.

---

### MED-4: OAuth State In-Memory

**File:** `frontend/server/services/twitter.ts:12-21`

**Attack:** Server restart loses all pending OAuth states. Multi-instance deployment breaks auth.

**Fix:** Store in database or Redis with TTL.

---

### MED-5: Creator Initial Buy Bypasses Anti-Bot Max Wallet

**File:** `contracts/core/LaunchpadFactoryV2.sol:445-453`

**Attack:** Factory executes creator buy as `msg.sender` (factory address). Anti-bot checks factory's balance, not creator's. Creator receives tokens via transfer, bypassing max wallet limits.

**Fix:** Check limits against the actual token recipient.

---

### MED-6: Presale Token Allocation Rounding Loss

**File:** `contracts/forge/PresaleVault.sol:243-244`

**Attack:** Integer division `(contributed * totalTokens) / totalRaised` loses dust. Unclaimed tokens locked in vault forever.

**Fix:** Track total allocated, assign remainder to last contributor or sweep function.

---

### MED-7: Image Upload — No Content Validation

**File:** `frontend/server/routes/images.ts:50-58`

**Attack:** Only checks data URI prefix, not actual image content. Polyglot files could contain malicious payloads.

**Mitigation present:** Correct Content-Type headers on serving.

**Fix:** Validate with image library (sharp). Strip EXIF data.

---

### MED-8: ADMIN_API_KEY Not Validated on Startup

**File:** `frontend/server/routes/admin.ts:13-16`

**Attack:** If unset, admin routes always return 403 (safe). But one refactor (`!expected || apiKey === expected`) opens the admin panel entirely.

**Fix:** Fail startup if critical env vars are missing.

---

## Low Severity

### LOW-1: Anti-Bot Bypass via Multiple Wallets
Per-address protections are inherently bypassable with multiple addresses. Fundamental limitation.

### LOW-2: Vesting Contract Never Funded
`LaunchManager._handleVesting` creates a VestingContract but never transfers tokens to it. Vesting is non-functional.

### LOW-3: triggerGraduationCheck() Public
Anyone can call it. Not harmful but can cause unexpected state transitions at threshold.

### LOW-4: Session Not Bound to Client
Stolen tokens work from any IP/device. Add device fingerprinting.

### LOW-5: Database SSL rejectUnauthorized: false
Railway connections skip cert validation. Vulnerable to MITM.

### LOW-6: CORS Null Origin Allowed
Requests without origin header are permitted. Allows `file://` protocol access.

### LOW-7: Missing Rate Limits on Presale/Notification Routes
Bulk notification sends not rate limited. Potential DoS.

### LOW-8: Token Ownership Goes to Factory
All tokens owned by Factory. Confusing but not currently exploitable.

### LOW-9: Bulk Notifications No Count Limit
Single announce can create thousands of DB rows. Performance risk.

### LOW-10: Graduation Front-Running
Multi-step graduation can be front-run on the DEX pair creation.

---

## Attack Surface Map

```
                          ┌─────────────────────────────────┐
                          │        ATTACK SURFACES          │
                          └─────────────────────────────────┘

┌─── FRONTEND ────────────────────────────────────────────────────────┐
│                                                                      │
│  localStorage                XSS Vectors              Browser        │
│  ┌──────────────┐    ┌──────────────────────┐    ┌──────────────┐   │
│  │ Private Key   │◄───│ Token names/desc     │    │ Session token │   │
│  │ Session token │    │ Comments             │    │ in URL params │   │
│  │ User data     │    │ Social links         │    │ Referrer leak │   │
│  └──────┬───────┘    │ 3rd party deps       │    └──────────────┘   │
│         │            └──────────────────────┘                        │
│         ▼ CRIT-1: XSS steals private key                            │
└─────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─── BACKEND API ─────────────────────────────────────────────────────┐
│                                                                      │
│  /api/auth/wallet-key        /api/admin/*          /api/presales     │
│  ┌──────────────────┐    ┌────────────────┐    ┌────────────────┐   │
│  │ Returns raw PK    │    │ No rate limit   │    │ No input valid │   │
│  │ CRIT-2            │    │ Brute force     │    │ Bulk notifs    │   │
│  └──────────────────┘    │ HIGH-6          │    │ LOW-7, LOW-9   │   │
│                          └────────────────┘    └────────────────┘   │
│  /api/auth/dev-login         Database              Encryption       │
│  ┌──────────────────┐    ┌────────────────┐    ┌────────────────┐   │
│  │ NODE_ENV bypass   │    │ SSL disabled    │    │ Single key     │   │
│  │ MED-2             │    │ LOW-5           │    │ CRIT-3         │   │
│  └──────────────────┘    └────────────────┘    └────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─── SMART CONTRACTS ─────────────────────────────────────────────────┐
│                                                                      │
│  Bonding Curve               Factory Owner           MEV / Mempool   │
│  ┌──────────────────┐    ┌────────────────────┐  ┌──────────────┐   │
│  │ Cross-contract    │    │ Replace impls      │  │ Sandwich     │   │
│  │ reentrancy        │    │ Emergency withdraw │  │ Front-run    │   │
│  │ CRIT-4            │    │ HIGH-3, HIGH-4     │  │ MED-1, MED-3 │   │
│  └──────────────────┘    └────────────────────┘  └──────────────┘   │
│                                                                      │
│  FeeManager                  LP Locker              Pro Launch       │
│  ┌──────────────────┐    ┌────────────────────┐  ┌──────────────┐   │
│  │ No access control │    │ Emergency unlock   │  │ Blacklist     │   │
│  │ on withdrawal     │    │ single address     │  │ traps funds   │   │
│  │ CRIT-5            │    │ HIGH-5             │  │ HIGH-1        │   │
│  └──────────────────┘    └────────────────────┘  └──────────────┘   │
│                                                                      │
│  Presale                     Anti-Bot               Graduation       │
│  ┌──────────────────┐    ┌────────────────────┐  ┌──────────────┐   │
│  │ Zero slippage     │    │ Multi-wallet       │  │ 5% slippage   │   │
│  │ on curve buy      │    │ bypass             │  │ extraction    │   │
│  │ HIGH-2             │    │ LOW-1              │  │ MED-3         │   │
│  └──────────────────┘    └────────────────────┘  └──────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Fix Priority for Mainnet

### Before Mainnet (Must Fix)

| # | Fix | Effort |
|---|-----|--------|
| CRIT-1,2 | Remove client-side private key. Server-side signing or MetaMask | 2-3 days |
| CRIT-3 | Per-user key derivation or KMS | 1 day |
| CRIT-5 | Add `require(msg.sender == creator)` to withdrawCreatorFees | 10 min |
| HIGH-1 | Allow blacklisted users to sell back to curve | 2 hours |
| HIGH-2 | Add slippage protection to presale buy | 30 min |
| HIGH-3,4,5 | Timelock + multi-sig on all owner operations | 1 week |
| HIGH-6 | Rate limit admin routes | 30 min |
| HIGH-7 | Move session token out of URL | 2 hours |
| MED-2 | Default dev-login to disabled | 15 min |

### Before Scale (Should Fix)

| # | Fix | Effort |
|---|-----|--------|
| CRIT-4 | Cross-contract reentrancy lock | 4 hours |
| MED-1 | Tighter default slippage in frontend | 30 min |
| MED-3 | Tighter graduation slippage | 30 min |
| MED-4 | OAuth state to Redis/DB | 2 hours |
| MED-5 | Anti-bot checks on actual recipient | 1 hour |
| MED-7 | Image content validation with sharp | 1 hour |
| MED-8 | Env var validation on startup | 30 min |

### Acceptable for MVP / Testnet

The following are acceptable trade-offs for MVP phase:
- CRIT-1,2,3 (custodial wallet model — same as Pump.fun on testnet)
- LOW-1 through LOW-10 (minor issues, not exploitable for significant funds)
- MED-6 (presale rounding dust — negligible amounts)

---

## Conclusion

The most critical systemic risk is the **custodial wallet architecture** (CRIT-1, CRIT-2, CRIT-3). On testnet with test AVAX, this is acceptable and matches the Pump.fun model. For mainnet with real funds, this must be addressed — either via server-side signing or MetaMask/Core wallet integration.

The smart contracts are well-written with proper reentrancy guards and access control. The main contract-level risks are **centralization risks** (owner can replace implementations, emergency withdraw, emergency unlock) which are standard for admin-controlled protocols but require multi-sig + timelock before mainnet.

**For the BuildGames competition submission on testnet: the current security posture is acceptable.** The issues documented here form the roadmap for hardening before any mainnet deployment.
