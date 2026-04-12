import { getPayoutHistory } from "@/lib/admin/get-payout-history";
import { formatPayoutUserDisplay } from "@/lib/admin/payout-profile-display";
import { isAdmin } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function csvEscapeCell(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  if (/[\r\n",]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function csvRow(cells: unknown[]): string {
  return cells.map(csvEscapeCell).join(",");
}

function userCsvCell(profile: Parameters<typeof formatPayoutUserDisplay>[0]): string {
  const f = formatPayoutUserDisplay(profile);
  if (f.secondary) {
    return `${f.primary} ${f.secondary}`;
  }
  return f.primary;
}

function safeFilenameSegment(contestId: string): string {
  return contestId.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120) || "contest";
}

export async function GET(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (!isAdmin(profile?.role)) {
    return new Response("Forbidden", { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const contestId = searchParams.get("contestId")?.trim() ?? "";
  if (!contestId) {
    return new Response("Missing contestId", { status: 400 });
  }

  const paidParam = searchParams.get("paid");
  const paidOpt = paidParam === "true" ? true : paidParam === "false" ? false : undefined;

  const result = await getPayoutHistory(contestId, { paid: paidOpt });
  if (!result.ok) {
    return new Response(result.error, { status: 500 });
  }

  const headerRow = csvRow(["Rank", "User", "Winnings USD", "Paid", "Paid At", "User ID"]);

  const bodyLines = result.rows.map((r) =>
    csvRow([
      r.rank,
      userCsvCell(r.profiles),
      Number(r.winnings_usd),
      r.paid ? "yes" : "no",
      r.paid_at ?? "",
      r.user_id,
    ]),
  );

  const csv = [headerRow, ...bodyLines].join("\r\n");

  const filename = `payouts-${safeFilenameSegment(contestId)}.csv`;

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
