/** Normalized DFS handle for storage (lowercase, trimmed). */
export function normalizeUsername(input: string): string {
  return input.trim().toLowerCase();
}

/** System placeholder handles assigned before the user picks a real DFS handle. */
export function isPlaceholderUsername(username: string): boolean {
  return username.startsWith("user_");
}

/** Client-side shape check: 3–20 alnum/underscore, not reserved `user_` prefix. */
export function isValidHandle(username: string): boolean {
  return /^[a-zA-Z0-9_]{3,20}$/.test(username) && !username.startsWith("user_");
}

/** @deprecated Use {@link isPlaceholderUsername} */
export const isPlaceholderUsernameHandle = isPlaceholderUsername;

export function validateUsernameFormat(raw: string): { ok: true; username: string } | { ok: false; error: string } {
  const normalized = normalizeUsername(raw);
  if (normalized.length < 3 || normalized.length > 20) {
    return { ok: false, error: "Handle must be 3–20 characters." };
  }
  if (!/^[a-z0-9_]{3,20}$/.test(normalized)) {
    return { ok: false, error: "Use only letters, numbers, and underscores." };
  }
  if (isPlaceholderUsername(normalized)) {
    return {
      ok: false,
      error: 'Handles cannot start with "user_" — that prefix is reserved for temporary accounts.',
    };
  }
  return { ok: true, username: normalized };
}
