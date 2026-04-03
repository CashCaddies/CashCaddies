export const INVITE_SOURCES = ["organic", "friend", "twitter", "reddit", "email", "other"] as const;

export type InviteSource = (typeof INVITE_SOURCES)[number];

export const DEFAULT_INVITE_SOURCE: InviteSource = "organic";

export function isInviteSource(v: string): v is InviteSource {
  return (INVITE_SOURCES as readonly string[]).includes(v);
}

export function parseInviteSource(raw: unknown): InviteSource {
  const s = String(raw ?? "").trim().toLowerCase();
  if (isInviteSource(s)) return s;
  return DEFAULT_INVITE_SOURCE;
}
