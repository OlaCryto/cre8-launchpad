# Community Feedback Tracker

Feedback from Build Games community testing on Fuji testnet.

---

## Feedback #1 — Anonymous DM (March 12, 2026)

### 1. Git identity exposure
- **Issue:** Real name visible in git commits
- **Fix:** `git config --global user.name "OlaCryto"` + `git config --global user.email "OlaCryto@users.noreply.github.com"`
- **Status:** [x] Done

### 2. Custodial wallet architecture — private key sent to browser
- **Issue:** Server generates wallet, stores encrypted key in DB, decrypts and sends raw private key to frontend on every session.
- **Fix:** Moved to server-side transaction signing. Private key NEVER leaves the server.
  - New endpoint: `POST /api/wallet/send-transaction` — frontend sends action + params, server signs & broadcasts
  - Removed: `POST /api/auth/wallet-key` — no longer exists
  - Key export: Only via explicit `POST /api/wallet/export-key` (rate limited to 3/hour, user-initiated)
  - Frontend hooks (`useTransactions`, `useForge`) now call server API instead of signing locally
  - AuthContext no longer stores or fetches private keys
- **Status:** [x] Fixed

### 3. Hardcoded API keys in frontend bundle
- **Issue:** QuikNode RPC key was hardcoded in source, baked into production JS
- **Fix:** Already fixed — moved to env vars (commit 9ac71fd). Deployed to Cloudflare + Railway.
- **Status:** [x] Fixed

### 4. Admin panel rate limiting
- **Result:** 5 attempts before blocked — they confirmed this is good
- **Status:** [x] No action needed

### 5. General API probing (25 attempts)
- **Result:** Nothing obvious or common found
- **Status:** [x] No action needed

---

## Feedback #2 — Anonymous DM (March 12, 2026)

### 1. Upgradeable proxy (UUPS) concern
- **Issue:** Using upgradeable contracts may reduce trust — users can't be sure the contract won't change under them.
- **Advice:** Renounce upgrade ability once contract is stable; use a multisig wallet as owner.
- **Plan:**
  - Keep upgradeability on testnet for rapid iteration
  - Before mainnet: transfer ownership to Gnosis Safe multisig
  - Once battle-tested: renounce ownership or remove `_authorizeUpgrade` in a final upgrade to make immutable
- **Status:** [ ] Future — mainnet preparation task

### 2. "Mnemonic recovery tool on GitHub"
- **Issue:** Concern about holding user keys alongside a mnemonic recovery tool visible on GitHub.
- **Investigation:** Searched entire repo — only mnemonic references are inside `node_modules/viem/` (library dependency, `mnemonicToAccount`). No custom mnemonic/recovery tool in source code.
- **Possible explanation:** They may be referring to a different repo on the GitHub profile, not this one.
- **Action:** It was a forked repo from a long time ago — not related to Cre8.
- **Status:** [x] Identified — unrelated fork

### 3. General advice on vibe coding
- **Summary:** Encouragement to be careful with AI-assisted development, review generated code thoroughly.
- **Status:** [x] Noted — no action needed

---

## Feedback #3 — Anonymous DM (March 12, 2026)

### Server/Backend

#### 1. Backend holds all private keys — contradicts ToS/Privacy Policy
- **Issue:** Custodial model stores encrypted keys server-side.
- **Assessment:** This is intentional architecture. Server-side signing means keys never reach the browser. Users can export keys via explicit `POST /api/wallet/export-key`. ToS/Privacy Policy should be updated to clearly state the custodial model.
- **Status:** [ ] Update ToS/Privacy Policy to reflect custodial model

#### 2. `limit=-1` on public endpoints crashes server (DoS)
- **Issue:** `Math.min(-1, 500)` returns `-1`, which causes `LIMIT -1` in SQL — crashes the server with no auth needed.
- **Affected endpoints:** `/api/prices/:addr/history`, `/api/presales`, `/api/comments/:addr`, `/api/notifications`, `/admin/applications`
- **Fix:** Added `Math.max(1, ...)` clamp to all limit parameters across all routes.
- **Status:** [x] Fixed

#### 3. Token creator spoofing — any user can claim any token
- **Issue:** `POST /api/tokens/register` accepted any authenticated user as creator with no on-chain verification. First registration wins (`ON CONFLICT DO NOTHING`).
- **Fix:** Added on-chain verification — server reads `tokenParams[tokenId].creator` from Cre8Manager and compares to the caller's wallet address. Returns 403 if mismatch.
- **Status:** [x] Fixed

#### 4. Presale creation has no creator verification
- **Issue:** Same as #3 — any authenticated user could create a presale for any launch_id.
- **Fix:** Added on-chain verification of `tokenParams[tokenId].creator` before allowing presale creation.
- **Status:** [x] Fixed

#### 5. QuikNode RPC key still in production config
- **Issue:** Key `022a54c6...` hardcoded in `frontend/app/.env.production`, baked into JS bundle.
- **Fix:** Removed from `.env.production`. Must be set as environment variable in Cloudflare Pages dashboard.
- **Action needed:** Rotate the QuikNode API key (old one is compromised) and set `VITE_FUJI_RPC_URL` + `VITE_MAINNET_RPC_URL` in Cloudflare Pages environment variables.
- **Status:** [x] Removed from source — [ ] Key rotation pending (user action)

#### 6. Admin panel — single static key header
- **Issue:** Admin auth is a single `X-Admin-Key` header. Suggestion to add 2FA (Telegram log, Google login).
- **Assessment:** Rate limiting is already in place (5 attempts). For testnet this is acceptable. For mainnet, add a second factor.
- **Status:** [ ] Future — mainnet preparation

#### 7. User enumeration on `/api/users/by-wallet`
- **Issue:** Public endpoint returns display names/avatars for any wallet address.
- **Assessment:** Low risk — only exposes public display info (Twitter handle, name, avatar). No secrets. Common pattern for social platforms.
- **Status:** [x] Acknowledged — acceptable for social platform

### Smart Contract

#### 8. `creatorFeeBps = 0` — creators get 0%, not 0.2% as advertised
- **Issue:** On-chain config has `creatorFeeBps: 0`. README said "0.8% platform + 0.2% creator".
- **Fix:** Updated README to accurately state "1% protocol fee (configurable creator share via `setFeeConfig`)".
- **Note:** Creator fee can be enabled via `setFeeConfig()` (onlyOwner) at any time.
- **Status:** [x] Docs corrected

#### 9. All 1% fee goes to owner's personal EOA wallet
- **Issue:** `protocolFeeDestination` is set to the deployer's wallet.
- **Assessment:** Standard for testnet. For mainnet, should go to a treasury multisig.
- **Status:** [ ] Future — set protocolFeeDestination to multisig for mainnet

#### 10. `emergencyWithdraw()` — owner can drain all funds
- **Issue:** `onlyOwner` function can withdraw all AVAX from Cre8Manager and LiquidityManager.
- **Assessment:** Required for testnet recovery scenarios. For mainnet, mitigated by multisig ownership + eventual renouncement.
- **Status:** [ ] Mitigated by multisig plan (see Feedback #2.1)

#### 11. UUPS single EOA, no timelock/multisig
- **Already addressed in Feedback #2.1** — multisig + renounce plan documented in README and GTM.
- **Status:** [ ] Future — mainnet preparation

#### 12. LiquidityManager and LiquidityLocker not verified on Snowtrace
- **Issue:** Only Cre8Manager is source-verified; LiquidityManager and LiquidityLocker are not.
- **Status:** [ ] Pending — need to verify on SnowScan/Snowtrace

#### 13. Bonding curve slope=0, ~$640k to graduate
- **Issue:** Original linear curve with slope=0 meant constant price — graduation was mathematically impossible.
- **Assessment:** Fixed — upgraded BondingCurveMath to virtual constant-product AMM (Pump.fun-style). Price now increases exponentially. Graduation threshold set to 420 AVAX (~87 AVAX total invested).
- **Status:** [x] Fixed — UUPS upgrade deployed, new curve config set on-chain

### Privacy

#### 14. Real name and email in git commits
- **Already fixed in Feedback #1.1** — git identity changed to OlaCryto pseudonym.
- **Status:** [x] Done

### Other

#### 15. Transparency about fees
- **Advice:** Be upfront about the 0.02 AVAX creation fee and 1% trading fee — don't bury it in ToS.
- **Assessment:** Fees are displayed in the Token Economics section of the README and visible in the UI. Good practice to keep this transparent.
- **Status:** [x] Already transparent in docs
