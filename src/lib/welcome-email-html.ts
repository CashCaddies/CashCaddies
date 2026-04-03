function escapeHtmlAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

/** Transactional welcome email HTML (Resend). Inline styles for client compatibility. */
export function buildWelcomeEmailHtml(dashboardUrl: string): string {
  const safeUrl = escapeHtmlAttr(dashboardUrl);
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<meta http-equiv="X-UA-Compatible" content="IE=edge"/>
<title>Welcome to CashCaddies</title>
</head>
<body style="margin:0;padding:0;width:100%!important;-webkit-text-size-adjust:100%;background-color:#eef1f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#eef1f4;padding:24px 16px;">
<tr><td align="center">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:500px;width:100%;">
<tr><td style="padding:0 0 20px;text-align:center;">
<p style="margin:0 0 4px;font-size:22px;font-weight:700;color:#0f172a;letter-spacing:-0.02em;">CashCaddies</p>
<p style="margin:0;font-size:13px;color:#64748b;line-height:1.4;">Daily Fantasy Sports Platform</p>
</td></tr>
<tr><td style="background-color:#ffffff;border-radius:12px;border:1px solid #e2e8f0;box-shadow:0 1px 3px rgba(15,23,42,0.06);padding:32px 28px;">
<h1 style="margin:0 0 16px;font-size:20px;font-weight:700;color:#0f172a;line-height:1.3;">Welcome to CashCaddies</h1>
<p style="margin:0 0 16px;font-size:15px;line-height:1.55;color:#334155;">Your account is now active.</p>
<p style="margin:0 0 24px;font-size:15px;line-height:1.65;color:#334155;">You can now:<br/>
• Enter contests<br/>
• Build lineups<br/>
• Track performance<br/>
• Compete safely with our Safety Fund protection</p>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td align="center" style="padding:0 0 28px;">
<a href="${safeUrl}" style="display:inline-block;background-color:#d4af37;color:#ffffff!important;text-decoration:none;font-size:15px;font-weight:600;padding:12px 20px;border-radius:8px;line-height:1.25;">Go to Dashboard</a>
</td></tr></table>
<p style="margin:0 0 12px;font-size:14px;font-weight:700;color:#0f172a;">Getting Started:</p>
<ol style="margin:0 0 24px;padding:0 0 0 22px;font-size:15px;line-height:1.65;color:#334155;">
<li style="margin:0 0 8px;">Enter your first contest</li>
<li style="margin:0 0 8px;">Build your lineup</li>
<li style="margin:0;">Track results</li>
</ol>
<p style="margin:0;padding-top:20px;border-top:1px solid #e2e8f0;font-size:12px;line-height:1.5;color:#64748b;">
CashCaddies Closed Beta<br/>
Questions? <a href="mailto:contact@cashcaddies.com" style="color:#b8960f;text-decoration:none;">contact@cashcaddies.com</a>
</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

export function welcomeEmailDashboardUrl(): string {
  const envBase = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (envBase) return `${envBase}/dashboard`;
  return "https://cashcaddies.com/dashboard";
}
