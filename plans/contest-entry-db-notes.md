# Contest entry — DB & code path baseline (Phase A)

Inventory for MVP stabilization. Source of truth for migrations: `supabase/migrations/` (not `migrations_archive/`).

## 1. `contest_entries` / `lineups` mutating paths (application)

- **Insert `contest_entries` (atomic):** `create_contest_entry_atomic` via `chargeContestEntry` (`src/lib/contest-entry-payment.ts`) and direct RPC in `src/app/lineup/actions.ts`, `src/app/lobby/actions.ts`.
- **Insert/update `lineups`:** `src/app/lineup/actions.ts` (`submitLineup`, drafts), `src/app/lobby/actions.ts` (link paid entry).
- **Delete `contest_entries`:** `refundContestEntryCharge` (`contest-entry-payment.ts`), rollbacks in `lineup/actions.ts`, failure paths in `lobby/actions.ts`.
- **Other:** Search `from("contest_entries")` for admin/lab (`src/app/contest-lab/actions.ts`, etc.) — review before schema changes.

## 2. `create_contest_entry_atomic`

Defined in baseline `supabase/migrations/00000000000000_baseline.sql`; production may include later replacements from archived migrations. **App contract:** parameters include `p_entry_fee`, `p_protection_fee`, `p_total_paid`, `p_protection_enabled`, `p_lineup_id`, `p_contest_name`. MVP billing sets `p_protection_fee` to `0` and `p_total_paid` to entry fee only.

## 3. `apply_contest_entry_fee_allocation` (trigger `contest_entries_fee_allocation`)

Migration: `supabase/migrations/20260409143000_entry_fee_split_90_5_5.sql`.

- **INSERT:** `entry_fee` delta positive → +5% to `insurance_pool`, +5% to `app_config.platform_revenue_usd` (rounded).
- **DELETE:** delta negative → reverses same amounts.
- **UPDATE `entry_fee`:** adjusts by difference.

## 4. `settle_contest_prizes`

Same migration replaces function: prize pool `round(entry_fee_usd * entry_count * 0.90, 2)` after eligibility (`starts_at + 3 days`, not already settled, at least one entry).

## 5. Frontend alignment

- Entry fee split display: `src/lib/contest-fee-split.ts` (`splitEntryFeeUsd`).
- Aggregates must use **`total_paid`** when set; do not add legacy `protection_fee` to `entry_fee` for “amount paid.”
