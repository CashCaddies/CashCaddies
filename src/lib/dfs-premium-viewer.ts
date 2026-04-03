import { unstable_noStore } from "next/cache";
import {
  hasActivePaidPremium,
  hasDfsPremiumAccess,
  type DfsPremiumProfileSlice,
} from "@/lib/access-control";
import { createClient } from "@/lib/supabase/server";
import { isMissingColumnOrSchemaError } from "@/lib/supabase-missing-column";

export type DfsPremiumViewer = {
  /** Combined gate for advanced tools. */
  hasPremiumToolsAccess: boolean;
  /** Paying or admin-granted `is_premium` still within period (excludes beta-only). */
  isPremiumSubscriber: boolean;
  isDfsBetaTester: boolean;
};

/** Load current user’s premium / DFS beta flags (server). Safe when columns are missing. */
export async function getDfsPremiumViewerForRequest(): Promise<DfsPremiumViewer> {
  unstable_noStore();
  const none: DfsPremiumViewer = {
    hasPremiumToolsAccess: false,
    isPremiumSubscriber: false,
    isDfsBetaTester: false,
  };

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return none;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("is_beta_tester,is_premium,premium_expires_at")
      .eq("id", user.id)
      .maybeSingle();

    if (error) {
      if (isMissingColumnOrSchemaError(error)) {
        return none;
      }
      return none;
    }

    const row = data as DfsPremiumProfileSlice | null;
    const isDfsBetaTester = row?.is_beta_tester === true;
    const isPremiumSubscriber = hasActivePaidPremium(row);
    return {
      hasPremiumToolsAccess: hasDfsPremiumAccess(row),
      isPremiumSubscriber,
      isDfsBetaTester,
    };
  } catch {
    return none;
  }
}
