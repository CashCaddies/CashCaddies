# Contest lifecycle state system

## Goal

Introduce a clear, explicit **contest state** model (backed by `contests.status`) so product behavior—who can enter, what admins can do, and what the UI shows—follows one set of rules. Start with **manual** transitions (admin buttons); no scheduling or automation in scope.

### Single source of truth (non-negotiable)

- **Lifecycle status** is **only** `contests.status` as stored in Supabase.
- **Do not** infer lifecycle from `starts_at`, `ends_at`, “now”, or any other dates.
- **Do not** derive lifecycle in the frontend from heuristics (e.g. comparing `Date.now()` to start time). The client may **read and display** `contests.status` and **disable actions** based on that value, but it must not **recompute** a different lifecycle because the clock moved.
- **Backend** (RLS, RPCs, server actions) must use **`contests.status`** (or the same column via joins)—not date math—to decide whether entry or admin transitions are allowed.
- Dates may still be used for **display** (“Starts at …”) or **non-lifecycle** features, but they **must not** replace or override `contests.status` for the state machine above.

---

## 1. Supabase table changes

**Table:** `public.contests`

**Column:** `status` (text or Postgres enum)

**Allowed values (canonical strings):**

| Value     | Meaning (product)                                      |
|-----------|--------------------------------------------------------|
| `filling` | Contest is open for entries (subject to capacity).   |
| `locked`  | No more entries; event has not started yet.          |
| `live`    | Contest / event has started.                         |
| `complete`| Event finished; scoring / results window.            |
| `settled` | Payouts completed.                                   |

**Notes:**

- If `status` already exists with overlapping semantics (e.g. legacy `open` / `full`), plan a **migration** that maps old values to this set or documents coexistence until a follow-up cleanup.
- Prefer a **CHECK constraint** or enum so only these values are stored.
- Optional later: partial indexes or RLS helpers keyed by `status` (out of scope for “keep simple”).

---

## 2. Files affected (by name / area)

| Area | Purpose |
|------|---------|
| `ContestCard.tsx` | Card / row: status badge, disable entry when not `filling`. |
| `ContestLobby.tsx` | Lobby list: same badges and entry rules per row. |
| `enterContest.ts` (or server entry path) | Enforce: **only** allow creating entries when `status === 'filling'` (plus existing wallet / capacity rules). |
| Admin UI | Buttons: **Lock** → `locked`, **Start** → `live`, **Complete** → `complete`, **Settle** → `settled`; call RPC or `update` with auth checks. |

*(In this repo, components may live under kebab-case paths such as `contest-card.tsx` and lobby table rows—align imports when implementing.)*

---

## 3. Logic flow (by state)

| State     | Entries | Typical timing |
|-----------|---------|----------------|
| **FILLING** | Allowed (if not full, within rules). | Before start; primary “open for entry” phase. |
| **LOCKED**  | Not allowed. | After admin locks or capacity workflow; before event start. |
| **LIVE**    | Not allowed (unless product later allows late swap—explicitly out of this plan). | After **Start**; event running. |
| **COMPLETE**| Not allowed. | Event over; results in progress or final. |
| **SETTLED** | Not allowed. | Prizes paid; terminal state for payouts. |

**Full contest vs status:**

- **FULL** is a **capacity** condition (`entry_count >= max_entries`), not a separate `status`.
- While full, `status` can remain **`filling`**; entry is blocked by count, not by changing lifecycle to something else.

---

## 4. Rules (authoritative)

1. **Entry (create contest entry)** is permitted only when `contests.status = 'filling'` **and** all existing business rules pass (capacity, wallet, RLS, etc.).
2. **FULL** does not change `status` by itself; it **blocks** entry at the application/DB layer when count is at max.
3. **Lock** (admin): set `status = 'locked'`.
4. **Start** (admin): set `status = 'live'`.
5. **Complete** (admin): set `status = 'complete'`.
6. **Settle** (admin): set `status = 'settled'`.

**Ordering:** Document the **intended** order (`filling` → `locked` → `live` → `complete` → `settled`). Whether to forbid skipping steps (e.g. `filling` → `live`) is a product decision—either enforce in admin UI + DB trigger, or allow flexible transitions initially and tighten later.

---

## 5. UI behavior

- Show a **status badge** on contest surfaces (lobby row, card, detail) by **mapping the string from `contests.status`** to label/copy: **FILLING**, **LOCKED**, **LIVE**, **COMPLETE**, **SETTLED** (labels can be title-cased; keep consistent with design). Same row may also show **FULL** from entry count—that is capacity, not a substitute for `status`.
- **Disable** primary entry actions when `status !== 'filling'` (in addition to full / user limits), using the **fetched** `contests.status`, not inferred phase from dates.
- Admin: show **Lock / Start / Complete / Settle** only where role allows; disable or hide transitions that are invalid for the current `status` once rules are defined.

---

## 6. Out of scope (keep simple)

- No **cron jobs** or scheduled flips of `status`.
- No **automation** of Lock / Start / Complete / Settle from wall-clock time (manual buttons only for now). That keeps **`status` authoritative**; optional future automation would **write** `contests.status`, not replace it with client-side date rules.
- No **background workers** for lifecycle.

Optional follow-ups (not in this plan): webhooks, audit log of `status` changes, Realtime subscriptions for lobby freshness.

---

## 7. Testing checklist (manual)

- `filling` + not full: user can enter; badge shows FILLING.
- `filling` + full: entry blocked by count; badge still FILLING.
- Each non-`filling` status: entry disabled; server rejects entry if called directly.
- Admin: each button updates `status` and UI reflects the new badge.
