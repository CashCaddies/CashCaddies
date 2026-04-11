# Contest locking when full

## Objective

Treat a contest as **full** when its entry count reaches `max_entries`, then reflect that in the UI (no Enter) and enforce the same rule on the backend for safety.

**Lifecycle vs full:** Whether the contest is open for entries by **phase** (filling, locked, live, …) is defined only by `contests.status`—see `contest-lifecycle.md`. **Full** is strictly **capacity** (`COUNT(entries) >= max_entries`) and must not be inferred from dates; do not use dates to infer lifecycle either.

## 1. Supabase tables involved

| Table | Role |
|-------|------|
| `public.contests` | Holds `max_entries` (capacity) and contest metadata. |
| `public.contest_entries` | One row per entry; used to compute `COUNT(*)` per contest (referred to as “entries” below). |

Relationship: each entry row references a contest; counting rows grouped by `contest_id` gives current occupancy.

## 2. Files that will change

| File | Purpose |
|------|---------|
| `ContestCard.tsx` | Card-level display: show full state, swap Enter for FULL / disabled control. |
| `ContestLobby.tsx` | Lobby-level layout: consistent full messaging and disabled entry affordances. |
| `enterContest.ts` | Shared entry / error mapping or server-side guard so attempts when full fail cleanly (align messages with UI). |

*(Adjust paths to match your repo’s actual locations under `src/` or `components/`.)*

## 3. Logic flow

### When is a contest full?

- **Definition:** `COUNT(entries for this contest) >= max_entries` (using `contests.max_entries` and rows in `contest_entries` for that `contest_id`).

### Backend

- Before completing an entry (RPC, server action, or insert path): **reject** if the contest is already full.
- This is **extra safety**; the UI should already block, but the server must not rely on the client.

### Frontend

- If full: show **“FULL”** (badge or label) and **do not** allow Enter (disabled control or replacement with non-actionable FULL affordance).

## 4. UI behavior

- Replace the primary **Enter** action when full with either:
  - A **“FULL”** badge (read-only), or
  - A **disabled** button whose label is **FULL** (or equivalent), with no navigation or submit.
- Keep non-full behavior unchanged: normal Enter for contests that still have capacity.

## 5. Edge cases

| Scenario | Approach (simple stack) |
|----------|-------------------------|
| Contest becomes full while the user is still on the page | No realtime: user sees updated state on **next navigation**, **refresh**, or **explicit refetch** after actions (e.g. after someone else enters). Document that lobby may be briefly stale. |
| Two users compete for the **last** spot | Backend enforcement wins: one insert succeeds; the other gets a clear “full” or conflict error. Optionally refresh UI after failed attempt. |
| Stale UI showing Enter when already full | Rely on **backend rejection** + user messaging; reduce staleness via **refetch on focus**, **router refresh**, or **polling only if you add it later** (out of scope for “no realtime”). |

## 6. Constraints (keep it simple)

- **No** Supabase Realtime subscriptions for capacity.
- **No** cron jobs or scheduled jobs to flip a “locked” flag.
- **No** background workers.

Optional later (not in this plan): periodic refetch, optimistic UI, or a denormalized `entry_count` on `contests` updated by triggers—only if product needs fresher numbers without polling.

## 7. Testing checklist (manual)

- Contest at `max_entries - 1`: Enter still available; after one more entry, full state appears on next load/refetch.
- Direct API / double-submit against full contest: rejected with expected message.
- Lobby with multiple contests: only the full contest shows FULL; others unchanged.
