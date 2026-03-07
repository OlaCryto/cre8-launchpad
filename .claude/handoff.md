# Session Handoff
> Last updated: 2026-03-07

## Current Status: Production fixes deployed, Cloudflare rebuild needed

### What was done (2026-03-07):

1. **Image upload fix** — Stored in PostgreSQL BYTEA instead of filesystem (Railway ephemeral FS wiped images)
2. **Token creator tracking** — `token_creators` table + `/api/tokens/register` endpoint + frontend registration
3. **Comment/reply notifications** — Token creators notified on comments, comment authors on replies
4. **Follow notifications + self-follow prevention** — Backend rejects + frontend hides button
5. **Trade history fixes** — Exact creation block from API, Factory→creator address mapping
6. **Send AVAX/tokens from profile** — `useSendAVAX()` and `useSendToken()` hooks + UI
7. **Anti-bot contract fix** — Disabled broken anti-bot in BondingCurveV2, deployed new implementation
8. **Google OAuth** — Switched from Twitter to Google login (previous session)

### Production Architecture:
- Frontend: https://cre8app.net (Cloudflare Pages)
- Backend: https://api.cre8app.net (Railway, auto-deploys from master)
- Database: Railway PostgreSQL
- Auth: Google OAuth 2.0

### Contract Addresses (Fuji 43113):
- Factory: `0x0926707Dc7a64d63f37390d7C616352b180E807a`
- Router: `0xecE29f311363b3689C838a7e12db20ddc32E9896`
- LaunchManager: `0x85B7572Fd253549dB38A638ddcDae1Cc40E2eF73`
- BondingCurveV2 impl (NEW): `0x16F2f3F20c4d59CD3D3251745628632D6B1e403D`

### Cloudflare Pages Deploy:
- Project: cre8, Env: VITE_API_URL=https://api.cre8app.net

### Railway env vars:
DATABASE_URL, ENCRYPTION_KEY, FACTORY_ADDRESS, FRONTEND_URL, FUJI_RPC_URL, GOOGLE_CALLBACK_URL, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET

### Key notes:
- Existing tokens use old BondingCurve (anti-bot broken). New tokens work.
- Foundry path: `/c/Users/HP/.foundry/bin/forge` (not in PATH)
- Backend auto-deploys from master. Frontend needs Cloudflare Pages rebuild.
