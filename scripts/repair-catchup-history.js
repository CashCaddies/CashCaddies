/**
 * After running supabase/migrations/090_apply_missing_migrations.sql in the
 * SQL Editor, run this once (linked project) so migration history matches:
 * marks 060–087 and 090 as applied without re-executing them.
 *
 * Usage: npm run db:repair-catchup
 */

const { readdirSync } = require("fs");
const { join } = require("path");
const { spawnSync } = require("child_process");

const dir = join(process.cwd(), "supabase", "migrations");
const versions = readdirSync(dir)
  .filter((f) => f.endsWith(".sql"))
  .filter((f) => {
    const m = f.match(/^(\d{3})_/);
    if (!m) return false;
    const n = parseInt(m[1], 10);
    return (n >= 60 && n <= 87) || f.startsWith("090_");
  })
  .sort()
  .map((f) => f.replace(/\.sql$/, ""));

if (versions.length === 0) {
  console.error("No migration files found for catch-up repair.");
  process.exit(1);
}

console.log(
  "Marking as applied (linked):",
  versions.length,
  "version(s), from",
  versions[0],
  "to",
  versions[versions.length - 1]
);

const r = spawnSync(
  "npx",
  ["supabase", "migration", "repair", "--status", "applied", "--linked", ...versions],
  { stdio: "inherit", shell: true, cwd: process.cwd() }
);

process.exit(r.status !== 0 ? r.status : 0);
