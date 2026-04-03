import { createServiceRoleClient } from "@/lib/supabase/admin";
import { buildWelcomeEmailHtml, welcomeEmailDashboardUrl } from "@/lib/welcome-email-html";

const SUBJECT = "Welcome to CashCaddies";

/**
 * Sends the post-confirmation welcome email once per user (profiles.welcome_email_sent).
 * Uses Resend when RESEND_API_KEY and RESEND_FROM are set.
 * On send failure, leaves welcome_email_sent false so a later session can retry.
 */
export async function sendWelcomeEmailForUserIfNeeded(userId: string, email: string): Promise<void> {
  const to = email.trim();
  if (!to) return;

  const key = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM?.trim();
  if (!key || !from) {
    return;
  }

  const admin = createServiceRoleClient();
  if (!admin) return;

  const { data: claimed, error: claimErr } = await admin
    .from("profiles")
    .update({ welcome_email_sent: true })
    .eq("id", userId)
    .eq("welcome_email_sent", false)
    .select("id");

  if (claimErr || !claimed?.length) {
    return;
  }

  const dashboardUrl = welcomeEmailDashboardUrl();
  const html = buildWelcomeEmailHtml(dashboardUrl);

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
        subject: SUBJECT,
        html,
      }),
    });

    if (!res.ok) {
      await admin.from("profiles").update({ welcome_email_sent: false }).eq("id", userId);
    }
  } catch {
    await admin.from("profiles").update({ welcome_email_sent: false }).eq("id", userId);
  }
}
