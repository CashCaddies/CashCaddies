"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { fantasyPointsFromCounts } from "@/lib/scoring";
import { createServiceRoleClient } from "@/lib/supabase/admin";

function parseNonNegInt(value: FormDataEntryValue | null, fallback = 0): number {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n) || n < 0) return fallback;
  return n;
}

export type SaveGolferScoreResult =
  | { ok: true; fantasyPoints: number }
  | { ok: false; error: string };

export async function saveGolferFantasyScore(formData: FormData): Promise<SaveGolferScoreResult> {
  await requireAdmin();
  const secret = process.env.ADMIN_SCORING_SECRET;
  if (!secret || formData.get("adminSecret") !== secret) {
    return { ok: false, error: "Invalid or missing admin secret." };
  }

  const golferId = String(formData.get("golferId") ?? "").trim();
  if (!golferId) {
    return { ok: false, error: "Select a golfer." };
  }

  const birdies = parseNonNegInt(formData.get("birdies"));
  const pars = parseNonNegInt(formData.get("pars"));
  const bogeys = parseNonNegInt(formData.get("bogeys"));
  const fantasyPoints = fantasyPointsFromCounts(birdies, pars, bogeys);

  const admin = createServiceRoleClient();
  if (!admin) {
    return { ok: false, error: "Server missing SUPABASE_SERVICE_ROLE_KEY." };
  }

  const { error } = await admin.from("golfers").update({ fantasy_points: fantasyPoints }).eq("id", golferId);

  if (error) {
    return { ok: false, error: error.message };
  }

  const { error: refreshErr } = await admin.rpc("refresh_lineup_total_scores_from_golfers");
  if (refreshErr) {
    return { ok: false, error: refreshErr.message };
  }

  revalidatePath("/dashboard");
  revalidatePath("/lobby", "layout");

  return { ok: true, fantasyPoints };
}
