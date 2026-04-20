"use server";

import { createServiceRoleClient } from "@/lib/supabase/admin";
import { validateUsernameFormat } from "@/lib/username";

export type EarlyAccessSignupResult = { ok: true } | { ok: false; error: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

/**
 * Public prelaunch signup — inserts into `waitlist_signups` (service role).
 */
export async function submitEarlyAccessSignup(
  emailRaw: string,
  usernameRaw: string,
  sourceRaw?: string,
): Promise<EarlyAccessSignupResult> {
  const email = String(emailRaw ?? "").trim().toLowerCase();
  if (!email || !EMAIL_RE.test(email)) {
    return { ok: false, error: "Enter a valid email address." };
  }

  const u = validateUsernameFormat(usernameRaw);
  if (!u.ok) {
    return { ok: false, error: u.error };
  }

  const source = String(sourceRaw ?? "early_access").trim().slice(0, 120) || "early_access";

  const admin = createServiceRoleClient();
  if (!admin) {
    return { ok: false, error: "Sign up is temporarily unavailable." };
  }

  const { data: existing } = await admin.from("waitlist_signups").select("id,status").eq("email", email).maybeSingle();

  if (existing) {
    const st = String((existing as { status?: string }).status ?? "").toLowerCase();
    if (st === "removed") {
      /* allow a fresh signup after removal */
    } else {
      return { ok: false, error: "This email is already on the waitlist." };
    }
  }

  const { error: insErr } = await admin.from("waitlist_signups").insert({
    email,
    username: u.username,
    source,
    status: "pending",
  });

  if (insErr) {
    if (insErr.code === "23505") {
      return { ok: false, error: "This email is already on the waitlist." };
    }
    return { ok: false, error: insErr.message };
  }

  return { ok: true };
}
