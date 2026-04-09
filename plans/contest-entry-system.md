# Contest entry system — MVP stabilization plan

This document describes a coordinated plan to stabilize the CashCaddies contest entry flow end-to-end: billing, database integrity, aggregation/display, refunds, and settlement. It reflects the current architecture (atomic RPC `create_contest_entry_atomic`, fee split 90% / 5% / 5%, embedded `contest_entries` counts, legacy columns like `protection_fee` on `lineups` / `contest_entries`).

**Scope:** Contest entry creation, wallet debits, fee allocation (prize pool / protection fund / platform), lineup linkage, dashboard and lobby UX, admin settlement.  
**Out of scope for this plan:** Non–contest-entry features unless they directly read inconsistent entry totals.

---

## 1. Stabilization goals

1. **Single charge model:** Users pay exactly the contest entry fee; no additive “protection” line item on invoices or UI.
2. **Consistent math:** Application-layer `splitEntryFeeUsd` (`src/lib/contest-fee-split.ts`) and database rules (`apply_contest_entry_fee_allocation`, `settle_contest_prizes` prize pool) agree on rounding and percentages.
3. **Reversible allocations:** Inserts/updates/deletes on `contest_entries` keep `insurance_pool` and `app_config.platform_revenue_usd` correct (including refunds and edge cases).
4. **Honest aggregates:** Dashboard and “my contests” totals match `total_paid` / entry fee semantics and do not double-count legacy `entry_fee + protection_fee` when protection is no longer an extra charge.
5. **Operational clarity:** Triggers, RPCs, and server actions are ordered and documented so future changes do not break RLS embeds or rollback paths.

---

## 2. Files likely to change

Grouped by responsibility. Some items are **verify-only** if already correct after recent work; they remain listed because they are common drift points.

### 2.1 Server actions (entry orchestration)

| File | Role |
|------|------|
| `src/app/lineup/actions.ts` | `submitLineup`, `enterContestWithSavedLineup`, `editContestEntryLineup`, rollback via `refundContestEntryCharge` |
| `src/app/lobby/actions.ts` | `confirmLobbyContestEntry`, lineup update + refund on failure |
| `src/app/contest-entry/actions.ts` | `createContestEntry` → `chargeContestEntry` |

### 2.2 Billing, eligibility, and wallet helpers

| File | Role |
|------|------|
| `src/lib/contest-entry-payment.ts` | `chargeContestEntry`, legacy split path, `refundContestEntryCharge`, contest entry row lifecycle |
| `src/lib/contest-entry-eligibility.ts` | `assertContestEntryEligible`, error normalization |
| `src/lib/contest-fee-split.ts` | Canonical 90/5/5 split for UI and optional server-side display |
| `src/lib/wallet-contest-cost.ts` | Client/server “total due” for entry |
| `src/lib/contest-entry-billing.ts` | High-level billing notes / re-exports |
| `src/lib/wallet-transaction.ts` | Transaction row helpers for debits |
| `src/lib/dashboard-lineups.ts` | Maps DB rows → `DashboardLineup`, `protection_fee` / `total_paid` semantics |
| `src/lib/dashboard-aggregates.ts` | `lineupAmountPaidUsd`, `aggregateEnteredContests`, `totalEntryFeesUsd` — **risk of `entry_fee + protection_fee` double-count** |
| `src/lib/my-contests-fetch.ts` | `MyEnteredContestRow`, `protectionFeeUsd` and related fields |

### 2.3 Contest discovery, lobby, and counts

| File | Role |
|------|------|
| `src/lib/contest-lobby-fetch.ts` | Contest list with `contest_entries ( id )` embed |
| `src/lib/contest-lobby-shared.ts` | Lifecycle phases, entry count helpers |
| `src/lib/contest-lobby-data.ts` | Display labels, legacy constants |
| `src/lib/contest-entries-read-columns.ts` | Minimal `contest_entries` select list (RLS / schema drift) |
| `src/lib/safety-pool-stats.ts` | Safety pool card; entry totals |
| `src/lib/getContestEntries.ts` | Admin / contest page entry lists |

### 2.4 Settlement and payouts

| File | Role |
|------|------|
| `src/lib/contest-payout-engine.ts` | Calls `settle_contest_prizes` |
| `src/lib/contest-settlement.ts` | Types / constants tied to settlement |
| `src/components/admin-trigger-settlement.tsx` | Admin UI |
| `src/app/admin/settlement/page.tsx` | Copy around settlement |

### 2.5 UI components and pages

| File | Role |
|------|------|
| `src/components/lineup-builder.tsx` | Entry fee breakdown, submit/enter |
| `src/components/enter-contest-saved.tsx` | Saved-lineup entry modal, fee copy |
| `src/components/lobby-enter-button.tsx` | Client checks / navigation to enter flow |
| `src/app/lobby/[contestId]/enter/page.tsx` | Enter flow intro copy |
| `src/app/lineup/page.tsx` | Props into `LineupBuilder` |
| `src/app/dashboard/lineups/page.tsx` | Protection fund allocation display (`protection_fee` vs split from `entry_fee`) |
| `src/app/dashboard/page.tsx` | Uses `dashboard-aggregates` |
| `src/app/dashboard/contests/page.tsx` | **Review** if it shows fees or protection |
| `src/components/contest-entry.tsx` | Admin/user entry cards (protection badges — behavioral, not fee) |
| `src/hooks/use-my-contest-entries.ts` | Consumes `my-contests-fetch` |

### 2.6 Database

| Location | Role |
|----------|------|
| `supabase/migrations/20260409143000_entry_fee_split_90_5_5.sql` | Fee allocation trigger, `settle_contest_prizes`, `app_config` |
| `supabase/migrations/00000000000000_baseline.sql` | Baseline `create_contest_entry_atomic`; later migrations override in archive |
| New migrations (as needed) | Fixes to refund/reversal, RPC signature cleanup, data backfills |

---

## 3. Database tables and objects affected

### 3.1 Tables

| Table | How it participates |
|-------|---------------------|
| **`contest_entries`** | Canonical row per entry; `entry_fee`, `protection_fee`, `total_paid`, `lineup_id`, `user_id`, `contest_id`. Inserts/updates/deletes drive **`contest_entries_fee_allocation`** trigger. |
| **`lineups`** | Draft/paid lineups; stores mirrored fee columns (`entry_fee`, `protection_fee`, `total_paid`) for display and history. |
| **`contests`** | `entry_fee_usd`, capacity, `starts_at`; settlement uses `entry_fee_usd` × entry count × 0.9 for prize pool. |
| **`profiles`** | `account_balance`, `site_credits`, `loyalty_points`, `protection_credit_balance` (legacy paths). |
| **`transactions`** | Ledger lines for debits/refunds (atomic vs manual paths). |
| **`insurance_pool`** | Protection fund balance updated by fee allocation trigger. |
| **`app_config`** | `platform_revenue_usd` (and other keys); updated by fee allocation trigger. |
| **`contest_settlements`** / **`contest_payouts`** | Written by `settle_contest_prizes`. |

### 3.2 Functions and triggers (non-exhaustive)

| Object | Purpose |
|--------|---------|
| **`create_contest_entry_atomic`** | Single transaction: eligibility, wallet debit, `contest_entries` insert. |
| **`apply_contest_entry_fee_allocation`** | On `contest_entries` INSERT/UPDATE/DELETE: adjust `insurance_pool` and `platform_revenue_usd` by ±5% of entry fee delta. |
| **`settle_contest_prizes`** | Prize pool = `round(entry_fee_usd * entry_count * 0.90, 2)`; payouts after 3-day window. |
| **Lock / capacity triggers** | e.g. `trg_enforce_contest_entries_lock`, max-entries-per-user — must remain compatible with atomic RPC. |

### 3.3 Migration discipline

- Ordering: baseline → incremental migrations; **never** assume production skipped archived migration files—treat `supabase/migrations/` as source of truth for deployed history.
- Any change to `create_contest_entry_atomic` or triggers requires **rollback tests** (delete entry → allocation reverses).

---

## 4. UI components and routes affected

| Area | Components / routes |
|------|---------------------|
| **Lineup → pay** | `LineupBuilder`, `src/app/lineup/page.tsx`, `submitLineup` / `enterContestWithSavedLineup` |
| **Lobby → pay** | `src/app/lobby/[contestId]/enter/page.tsx`, `lobby-enter-button`, `confirmLobbyContestEntry` |
| **Saved entry modal** | `enter-contest-saved.tsx` |
| **Dashboard** | `dashboard/page.tsx` (aggregates), `dashboard/lineups/page.tsx` (per-lineup fees), optional `dashboard/contests/page.tsx` |
| **Contest detail / admin** | Entry lists, `getContestEntries`, `contest-entry.tsx`, settlement admin pages |
| **Hooks** | `use-my-contest-entries.ts` |

UX principles for stabilization:

- Copy emphasizes **one entry fee** and optional **breakdown** (90/5/5), not “+ protection.”
- Anywhere `protection_fee` is shown as dollars, prefer **derived** “protection fund share” from `entry_fee` via `splitEntryFeeUsd` if DB column is zeroed for legacy reasons.

---

## 5. Edge cases

### 5.1 Money and rounding

- **Cent rounding:** Three-way split (90/5/5) on a decimal entry fee can leave off-by-one-cent drift if different layers round independently. Plan: define one rule (e.g. derive prize pool as remainder after protection + platform, or always round each leg to 2 decimals and document acceptable drift).
- **Zero entry fee:** No wallet debit; allocation trigger should no-op on zero delta; settlement should reject or handle zero prize pool explicitly.

### 5.2 Concurrency and failure

- **Double submit:** Two rapid “Enter” clicks — RPC/transactions should enforce uniqueness (per user per contest) and return stable errors; UI should disable button while pending.
- **Pay then lineup failure:** `submitLineup` creates entry first then inserts `lineups` / `lineup_players`; failures must call **`rollbackContestEntry` / `refundContestEntryCharge`** and delete orphan rows.
- **Lobby path failure after atomic RPC:** `confirmLobbyContestEntry` updates `lineups`; failure triggers refund — verify admin client availability and snapshot fields (`balance_restored`, etc.).

### 5.3 Data model legacy

- **`protection_fee` column:** May remain `0` while product still shows “protection fund” as 5% of entry. UI and aggregates must not assume `protection_fee > 0` means an extra charge.
- **`dashboard-aggregates` `fromParts`:** `entry_fee + protection_fee` can overstate if legacy rows had both populated; stabilization should treat **`total_paid`** as authoritative when present.

### 5.4 Database triggers vs application deletes

- **Refund deletes `contest_entries`:** `DELETE` should fire allocation trigger and reverse insurance/platform deltas. Verify **UPDATE of `entry_fee`** (if ever used) and **partial refunds** if introduced later.
- **Missing `insurance_pool` row:** Trigger uses `order by created_at limit 1`; ensure a row exists in all environments.

### 5.5 RLS and reads

- **`CONTEST_ENTRIES_READ_BASE`:** Omitting columns avoids 400s; adding new required displays may need column allowlists updated in Supabase or select strings.
- **Embedded counts:** `contest_entries ( id )` length for entry counts relies on RLS — admins vs users may see different counts; document expected behavior.

### 5.6 Settlement

- **Time gate:** Settlement only after `starts_at + 3 days` — clock skew and timezone handling are server-side.
- **Prize pool formula** must match business rule (90% of gross entry fees collected) and not include platform/protection slices in the distributable pool.

### 5.7 Legacy payment path

- **`chargeContestEntry` non-atomic branch:** If `accountBalanceOnly === false` and total > 0, manual `transactions` + `profiles` updates still exist. Stabilization includes either **removing** this path for MVP or **testing** it end-to-end so it cannot charge “protection” separately.

---

## 6. Order of implementation

Recommended sequence minimizes financial inconsistency and avoids UI/backend mismatch.

### Phase A — Inventory and correctness baseline

1. Trace all code paths that insert/update/delete **`contest_entries`** and **`lineups`** (including admin and lab).
2. Document the exact behavior of **`create_contest_entry_atomic`** in the latest applied migration vs baseline.
3. Verify **`apply_contest_entry_fee_allocation`** on INSERT and DELETE matches product intent (5% + 5% of `entry_fee` delta).
4. Verify **`settle_contest_prizes`** prize pool matches 90% rule and matches frontend copy.

### Phase B — Single source of truth for “amount paid”

1. Normalize **`total_paid`** / **`entry_fee`** usage in **`dashboard-lineups`**, **`dashboard-aggregates`**, and **`my-contests-fetch`** so totals never double-count.
2. Align **`protection_fee` display** on dashboard: show **allocated** protection from `splitEntryFeeUsd(entry_fee)` when DB `protection_fee` is zero.
3. Re-scan **`src/lib`** for `protection_fee`, `total_paid`, and `computeProtectionFeeUsd` remnants.

### Phase C — Payment module hardening

1. **`contest-entry-payment.ts`:** Confirm atomic path is default; document or remove legacy split path for MVP.
2. **`refundContestEntryCharge`:** Ensure refunds reverse wallet state consistently with DB trigger reversals on row delete.
3. **`assertContestEntryEligible`:** Keep balance checks aligned with **entry fee only**.

### Phase D — UI pass (copy and numbers)

1. **`lineup-builder`**, **`enter-contest-saved`**, lobby enter page: consistent breakdown labels.
2. **Dashboard** lineups and contests: fee summaries match aggregates.
3. **Admin settlement** copy: references correct RPC and business rules.

### Phase E — Verification

1. **Typecheck:** `npx tsc --noEmit`.
2. **Manual test matrix:** free entry, paid entry, insufficient balance, duplicate entry attempt, failure after RPC (simulate), refund/delete entry.
3. **DB checks:** After entry and after delete, `insurance_pool` / `app_config` values match expected deltas for test amounts.

---

## 7. Exit criteria (MVP “stable”)

- [ ] No user-facing text implies a separate protection **purchase**; optional breakdown shows 90/5/5 from the single fee.
- [ ] Dashboard and my-contests monetary totals match **`total_paid`** (or `entry_fee` for unpaid drafts) without summing obsolete `protection_fee` as an add-on.
- [ ] Database allocation trigger and **`settle_contest_prizes`** agree with the documented fee model.
- [ ] Refund and failure paths restore wallet state and do not leave incorrect insurance/platform totals.
- [ ] Entry counts in lobby/detail use **`contest_entries` embed length**, not `contests.current_entries`, where applicable.

---

## 8. Open decisions (to resolve during implementation)

1. Whether to **backfill** historical `lineups.protection_fee` / display-only fields for analytics, or rely purely on `entry_fee` + `splitEntryFeeUsd`.
2. Whether to **deprecate** legacy RPC parameters (`p_protection_fee`) in a future migration or keep them as always-zero for compatibility.
3. Exact **rounding policy** when splitting odd-cent entry fees across three buckets.

---

*This plan is documentation only; no implementation changes are implied until work items are executed.*
