# Supabase migrations — repeatable workflow

CashCaddies keeps **one migration per change** under `supabase/migrations/`. The Supabase CLI applies **only pending** files, in **filename order**, and records them in the remote database so nothing runs twice.

**Do not** merge many files into a single `apply_missing_migrations.sql` in this repo: you would duplicate logic, lose version history, and risk drift from the files the CLI uses. The repeatable process is **`supabase db push`** (or CI running the same command).

---

## 1) Simplest command (after link — see below)

From the project root:

```bash
npm run db:migrate
```

This runs `supabase db push` and applies every migration that is not yet recorded on the linked project (including `060_*` through `087_*` and any newer files), in order.

Check what the CLI thinks is applied:

```bash
npm run db:migration-list
```

(`migration list` shows local vs remote state depending on CLI version; `db push` is the apply step.)

---

## 2) Install Supabase CLI

**Option A — use the project devDependency (recommended, no global install)**

```bash
cd /path/to/cashcaddies
npx supabase --version
```

The `supabase` package is listed in `package.json` `devDependencies`, so `npx supabase …` always uses a pinned version.

**Option B — global install**

- **Windows (Scoop):** `scoop install supabase`
- **macOS (Homebrew):** `brew install supabase/tap/supabase`
- **npm global:** `npm install -g supabase`

Official reference: [Supabase CLI](https://supabase.com/docs/guides/cli).

---

## 3) Login (hosted Supabase)

```bash
npx supabase login
```

Opens a browser to create a **personal access token**. Paste it when prompted.

---

## 4) Link this repo to your hosted project

You need your **project ref** (Dashboard → Project Settings → General → Reference ID).

```bash
cd /path/to/cashcaddies
npx supabase link --project-ref YOUR_PROJECT_REF
```

This writes/updates `supabase/.temp/project-ref` (and related link state). Commit **only** what your team agrees on; some teams gitignore `.temp` and re-link locally.

For a **new machine**, repeat `login` + `link`, then `db push`.

---

## 5) Push migrations (apply all pending)

```bash
npx supabase db push
```

Or:

```bash
npm run db:migrate
```

- Applies pending SQL from `supabase/migrations/` in **lexicographic order** (your `060_…` before `087_…`).
- Safe against double-apply: already-applied versions are skipped.
- Individual migrations already use `IF NOT EXISTS` / `DROP … IF EXISTS` / idempotent patterns where appropriate; **do not** rely on a mega-file for that.

**Dry run / inspect:** use `supabase db diff` or Dashboard SQL logs after push if you need to verify.

---

## 6) Protection & Contest Lab migrations (082–087)

These files live in-repo and are included whenever you `db push` (if not already applied):

| Order | File |
|------|------|
| 082 | `082_lobby_contests_protected_entry_count.sql` |
| 083 | `083_automatic_lineup_protection.sql` |
| 084 | `084_lobby_contests_protection_triggered_count.sql` |
| 085 | `085_safety_coverage_tokens.sql` |
| 086 | `086_contest_lab_simulations.sql` |
| 087 | `087_contest_lab_text_columns_and_risk.sql` |

Earlier migrations (e.g. `060_*`–`081_*`) are applied first if they are still pending.

---

## 7) If you cannot use the CLI

1. **Preferred:** Install Node, then use **`npx supabase db push`** after `login` + `link` — no global CLI required.
2. **Not recommended:** Pasting combined SQL in the Dashboard bypasses migration tracking and is error-prone.
3. **Last resort:** Supabase Dashboard → SQL Editor — run **individual** migration files **in order**, then use `supabase migration repair` (see CLI docs) to align history — only if you know what you’re doing.

There is **no** checked-in `apply_missing_migrations.sql` by design: it would duplicate `supabase/migrations/` and violate single source of truth.

---

## 8) Simplest future workflow (automatic deploy)

1. **Develop:** add a new file under `supabase/migrations/NNN_description.sql` (increment `NNN`).
2. **Apply to staging/production:** run `npm run db:migrate` from CI or locally against the linked project.
3. **CI (example):** on merge to `main`, a job with Node checks out the repo, runs `npx supabase link` (non-interactive using `SUPABASE_ACCESS_TOKEN` + project ref env vars), then `npx supabase db push`. Store secrets in GitHub Actions / your CI vault.

Supabase documents GitHub integration here: [GitHub integration](https://supabase.com/docs/guides/cli/github-action).

**Rule of thumb:** the **only** authoritative migration set is the `supabase/migrations/*.sql` files; deployment is **always** `db push` (or equivalent managed pipeline), not copy-paste.

---

## 9) Local Supabase (optional)

If you use `supabase start` for a local stack, migrations apply to the local DB when you start or reset; `db push` is mainly for **remote** linked projects. See [Local development](https://supabase.com/docs/guides/cli/local-development).
