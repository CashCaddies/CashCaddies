import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { WinningsView, type WinningsRow } from "./winnings-view";

export default async function WinningsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent("/dashboard/winnings")}`);
  }

  const { data, error } = await supabase
    .from("contest_entry_results")
    .select("id, contest_id, rank, winnings_usd, paid, paid_at, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const rows = (data ?? []) as WinningsRow[];

  const paidTotal = rows
    .filter((d) => d.paid)
    .reduce((s: number, d) => s + Number(d.winnings_usd || 0), 0);

  return <WinningsView rows={rows} paidTotal={paidTotal} loadError={error?.message ?? null} />;
}
