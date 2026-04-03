/**
 * Detects PostgREST / Postgres errors caused by selecting a column that does not exist
 * on the remote schema (e.g. migrations not applied yet).
 */
export function isMissingColumnOrSchemaError(err: {
  message?: string;
  code?: string;
} | null | undefined): boolean {
  const c = String(err?.code ?? "");
  if (c === "PGRST204" || c === "42703") return true;
  const m = (err?.message ?? "").toLowerCase();
  if (!m) return false;
  if (m.includes("does not exist")) return true;
  if (m.includes("could not find") && m.includes("column")) return true;
  if (m.includes("column") && m.includes("schema cache")) return true;
  if (m.includes("undefined column")) return true;
  return false;
}

/**
 * Table not in schema cache, not exposed, or relation missing (optional tables / REST 404).
 */
export function isRelationMissingOrNotExposedError(
  err: { message?: string; code?: string; details?: string; status?: number } | null | undefined,
): boolean {
  if (!err) return false;
  const m = (err.message ?? "").toLowerCase();
  const d = (err.details ?? "").toLowerCase();
  const c = String(err.code ?? "");
  if (typeof err.status === "number" && err.status === 404) return true;
  if (c === "404" || c === "PGRST205" || c === "42P01") return true;
  if (m.includes("schema cache") && (m.includes("could not find") || m.includes("not find"))) return true;
  if ((m.includes("relation") || m.includes("table")) && m.includes("does not exist")) return true;
  if (m.includes("could not find the table")) return true;
  if (m.includes("404") && (m.includes("not found") || m.includes("relation") || m.includes("resource"))) return true;
  if (m.includes("requested resource was not found")) return true;
  if (d.includes("could not find") && d.includes("schema cache")) return true;
  return false;
}

/**
 * PostgREST 400 / ambiguous embed / missing relationship (e.g. `profiles(...)` without FK).
 */
export function isPostgrestRelationshipOrEmbedError(err: {
  message?: string;
  code?: string;
  status?: number;
} | null | undefined): boolean {
  if (!err) return false;
  const c = String(err.code ?? "");
  if (c === "PGRST200" || c === "PGRST201") return true;
  if (typeof err.status === "number" && err.status === 400) {
    const m = (err.message ?? "").toLowerCase();
    if (
      m.includes("relationship") ||
      m.includes("could not embed") ||
      m.includes("more than one relationship") ||
      m.includes("no matches") ||
      m.includes("foreign key")
    ) {
      return true;
    }
  }
  const m = (err.message ?? "").toLowerCase();
  if (m.includes("more than one relationship")) return true;
  if (m.includes("could not embed")) return true;
  return false;
}
