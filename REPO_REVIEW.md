# Repository Review (Automated + Manual Spot Check)

Date: 2026-03-12
Scope reviewed:
- Smart contracts under `contracts/`
- Existing documentation and test scaffolding

## Executive Summary

This repository is well-structured and strongly documented, with a clear protocol architecture and thoughtful anti-bot/whitelist design. The most important issue found is a **fee/accounting mismatch in capped buys** that can overcharge users and inflate whitelist spend accounting when purchases hit max supply.

## Findings

### 1) High — Fee overcharge on capped buys near max supply

When a buy request would exceed remaining bonding-curve supply, `_buy()` caps `tokensOut` and computes `actualCost`, then refunds only `excess = buyAmount - actualCost`. However, protocol/creator fees were computed from the **original `avaxAmount`** before the cap, and they are still distributed unchanged.

Impact:
- Buyers can pay fees on AVAX that was not actually used to buy tokens.
- Effective fee rate can spike sharply in the final curve phase.
- Economic behavior becomes inconsistent with quote expectations.

Code references:
- Fees computed up front from full amount in `_buy()`.  
- Cap/refund logic adjusts `buyAmount`, but not `fees`.

Recommendation:
- Recalculate fees after capping based on `actualCost` (or redesign so gross input is decomposed into `actualCost + excess` first, then fee only on executed notional).

### 2) Medium — Whitelist spend accounting can overcount when refunds occur

Whitelist enforcement tracks `walletSpentDuringWL += avaxAmount` before execution. If `_buy()` later refunds due to supply cap, the tracked whitelist spend remains based on the original `msg.value`, not net executed amount.

Impact:
- Wallets can be blocked early from additional whitelist participation despite receiving refunds.
- User-facing allowance (`getWhitelistAllowance`) may under-report remaining capacity.

Recommendation:
- Move whitelist spending accounting to post-trade execution and increment using actual executed AVAX (excluding refunded excess and ideally excluding protocol fee if the intended policy is "buy notional" limits).

### 3) Low — Inconsistent fee-transfer gas strategy to creator

`_distributeFees()` uses a 2300-gas limited call to creator fee recipient and reroutes to protocol on failure. This is safe from reentrancy and DoS, but can unexpectedly route creator fees away from creator contracts with non-trivial receive logic.

Impact:
- Creator fees may silently divert to protocol if creator wallet is a smart contract requiring >2300 gas.

Recommendation:
- Decide policy explicitly and document it. If creator payout reliability is desired, remove strict gas stipend and rely on `nonReentrant` + CEI, or add explicit pull-payment claims.

## Positive Notes

- Upgradeable architecture appears clean and explicit (`initialize`, `_authorizeUpgrade`, storage gap).
- Slippage/deadline checks are present on buy/sell.
- Whitelist and blacklist controls are clear and operationally useful for Creator mode.
- Existing docs (`README`, audits) are unusually thorough for an MVP-stage project.

## Suggested Next Actions

1. Patch capped-buy fee/allowance accounting in `Cre8Manager._buy()` + whitelist tracking.
2. Add tests for near-max-supply purchases validating:
   - fees are proportional to executed amount,
   - refunds are correct,
   - whitelist spend reflects executed amount.
3. Clarify fee-transfer behavior for contract-based creator wallets in docs.
