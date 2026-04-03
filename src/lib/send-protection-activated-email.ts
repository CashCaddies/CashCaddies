import { createServiceRoleClient } from "@/lib/supabase/admin";

type NotificationRow = {
  id: string;
  user_id: string;
  kind: string;
  title: string | null;
  body: string | null;
  metadata: Record<string, unknown> | null;
};

function formatUsd(n: unknown): string {
  const v = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(v)) return "$0.00";
  return `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function buildSafetyCoverageEmailBody(meta: Record<string, unknown> | null): string {
  const name = typeof meta?.golfer_name === "string" ? meta.golfer_name : "—";
  const token = formatUsd(meta?.token_amount);
  return [
    "Your lineup received protection.",
    "",
    `Golfer:`,
    name,
    "",
    "Reason:",
    "Withdrawn before Round 1 lock.",
    "",
    "Safety Coverage Credit:",
    token,
    "",
    "Use in future contests.",
  ].join("\n");
}

/**
 * Sends Resend email for Safety Coverage / legacy protection notifications (best-effort).
 * Set RESEND_API_KEY and RESEND_FROM (e.g. CashCaddies <onboarding@domain.com>).
 */
export async function sendPendingProtectionActivatedEmails(): Promise<{ sent: number; skipped: number }> {
  const key = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM?.trim();
  if (!key || !from) {
    return { sent: 0, skipped: 0 };
  }

  const admin = createServiceRoleClient();
  if (!admin) {
    return { sent: 0, skipped: 0 };
  }

  const { data: pending, error } = await admin
    .from("user_notifications")
    .select("id, user_id, kind, title, body, metadata")
    .in("kind", ["protection_activated", "safety_coverage_activated"])
    .is("email_sent_at", null)
    .order("created_at", { ascending: true })
    .limit(25);

  if (error || !pending?.length) {
    return { sent: 0, skipped: pending?.length ?? 0 };
  }

  let sent = 0;
  for (const n of pending as NotificationRow[]) {
    const uid = n.user_id as string;
    const { data: userData, error: userErr } = await admin.auth.admin.getUserById(uid);
    const email = userData?.user?.email?.trim();
    if (userErr || !email) {
      continue;
    }

    const isSafetyToken = n.kind === "safety_coverage_activated";
    const subject = isSafetyToken ? "Safety Coverage Credit Issued" : String(n.title ?? "Protection Activated");
    const text = isSafetyToken
      ? buildSafetyCoverageEmailBody(n.metadata as Record<string, unknown> | null)
      : String(n.body ?? "");

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [email],
        subject,
        text,
      }),
    });

    if (!res.ok) {
      continue;
    }

    await admin.from("user_notifications").update({ email_sent_at: new Date().toISOString() }).eq("id", n.id);
    sent += 1;
  }

  return { sent, skipped: pending.length - sent };
}
