# Community Feedback Tracker

Feedback from Build Games community testing on Fuji testnet.

---

## Feedback #1 — Anonymous DM (March 12, 2026)

### 1. Git identity exposure
- **Issue:** Real name visible in git commits
- **Fix:** `git config --global user.name "OlaCryto"` + `git config --global user.email "OlaCryto@users.noreply.github.com"`
- **Status:** [ ] Pending (user action)

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
