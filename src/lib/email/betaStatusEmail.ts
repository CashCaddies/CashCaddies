import type { SupabaseClient } from "@supabase/supabase-js";

export type BetaStatusEmailKind = "approved" | "rejected" | "waitlist";

const TEMPLATES: Record<
  BetaStatusEmailKind,
  { subject: string; text: string; html: string }
> = {
  approved: {
    subject: "CashCaddies Beta Approved",
    text: "Welcome to CashCaddies beta.\n\nYour account is now active.",
    html: `<p>Welcome to CashCaddies beta.</p><p>Your account is now active.</p>`,
  },
  rejected: {
    subject: "CashCaddies Beta Update",
    text: "Thank you for applying. Beta is currently full.",
    html: `<p>Thank you for applying. Beta is currently full.</p>`,
  },
  waitlist: {
    subject: "CashCaddies Waitlist",
    text: "You are currently on the beta waitlist.",
    html: `<p>You are currently on the beta waitlist.</p>`,
  },
};

export type SendBetaStatusEmailResult = { ok: true } | { ok: false; error: string };

/**
 * Sends a Resend transactional email when beta status changes (approved / rejected / waitlist).
 * Requires RESEND_API_KEY and RESEND_FROM (same as other app emails).
 */
export async function sendBetaStatusEmail(
  email: string,
  status: BetaStatusEmailKind,
): Promise<SendBetaStatusEmailResult> {
  const to = String(email ?? "").trim();
  if (!to) {
    return { ok: false, error: "Missing recipient email." };
  }

  const key = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM?.trim();
  if (!key || !from) {
    return { ok: false, error: "Email not configured (RESEND_API_KEY / RESEND_FROM)." };
  }

  const tpl = TEMPLATES[status];

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: tpl.subject,
        text: tpl.text,
        html: `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;line-height:1.5;color:#0f172a">${tpl.html}</body></html>`,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, error: `Resend HTTP ${res.status}${body ? `: ${body.slice(0, 500)}` : ""}` };
    }

    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return { ok: false, error: message };
  }
}

/**
 * Loads `profiles.email` and sends the beta status email. Logs on failure; never throws.
 * Used from server actions invoked by the beta queue UI.
 */
export async function sendBetaStatusEmailForUserId(
  admin: SupabaseClient,
  userId: string,
  status: BetaStatusEmailKind,
): Promise<void> {
  const { data, error } = await admin.from("profiles").select("email").eq("id", userId).maybeSingle();
  if (error) {
    console.error("[betaStatusEmail] Failed to load profile email", userId, error.message);
    return;
  }
  const email = typeof (data as { email?: string | null } | null)?.email === "string" ? (data as { email: string }).email : null;
  if (!email?.trim()) {
    console.warn("[betaStatusEmail] No email on profile; skip notification", userId);
    return;
  }

  const result = await sendBetaStatusEmail(email, status);
  if (!result.ok) {
    console.error("[betaStatusEmail] Send failed", { userId, status, error: result.error });
  }
}

/** Sends the same template to many profile ids (e.g. bulk approve/reject). Never throws. */
export async function sendBetaStatusEmailForUserIds(
  admin: SupabaseClient,
  userIds: string[],
  status: BetaStatusEmailKind,
): Promise<void> {
  const unique = [...new Set(userIds.map((id) => String(id ?? "").trim()).filter(Boolean))];
  for (const id of unique) {
    await sendBetaStatusEmailForUserId(admin, id, status);
  }
}
