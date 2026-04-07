"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { supabase } from "@/lib/supabase/client";
import { markProtectionNotificationRead } from "@/app/protection/actions";
import {
  isMissingColumnOrSchemaError,
  isRelationMissingOrNotExposedError,
} from "@/lib/supabase-missing-column";

export function ProtectionNotificationBanner() {
  const { user, isReady } = useAuth();
  const [open, setOpen] = useState(false);
  const [id, setId] = useState<string | null>(null);
  const [bannerTitle, setBannerTitle] = useState<string | null>(null);
  const [bannerBody, setBannerBody] = useState<string | null>(null);
  const skipRealtimeRef = useRef(false);

  useEffect(() => {
    skipRealtimeRef.current = false;
  }, [user?.id]);

  const load = useCallback(async () => {
    try {
      if (!supabase || !user) {
        setOpen(false);
        setId(null);
        return;
      }
      const { data, error } = await supabase
        .from("user_notifications")
        .select("*")
        .eq("user_id", user.id)
        .in("kind", ["protection", "protection_activated", "safety_coverage_activated"])
        .is("read_at", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        if (
          isRelationMissingOrNotExposedError(error) ||
          isMissingColumnOrSchemaError(error)
        ) {
          skipRealtimeRef.current = true;
        }
        setOpen(false);
        setId(null);
        setBannerTitle(null);
        setBannerBody(null);
        return;
      }
      if (!data?.id) {
        setOpen(false);
        setId(null);
        setBannerTitle(null);
        setBannerBody(null);
        return;
      }
      setId(String(data.id));
      setBannerTitle(
        data.kind === "safety_coverage_activated"
          ? "Safety Coverage Activated"
          : "CashCaddies Safety Coverage Applied",
      );
      setBannerBody(
        data.kind === "safety_coverage_activated"
          ? String(data.body ?? "").trim() ||
              "Your entry received a Safety Coverage Credit. Check your email for details."
          : "Your entry has been protected by the Safety Coverage fund.",
      );
      setOpen(true);
    } catch {
      skipRealtimeRef.current = true;
      setOpen(false);
      setId(null);
      setBannerTitle(null);
      setBannerBody(null);
    }
  }, [user]);

  useEffect(() => {
    if (!isReady || !user || !supabase) return;

    let cancelled = false;
    let ch: ReturnType<typeof supabase.channel> | null = null;
    const t = window.setInterval(() => void load(), 45_000);

    void (async () => {
      await load();
      if (cancelled || skipRealtimeRef.current) return;
      try {
        ch = supabase
          .channel("protection-notifications")
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "user_notifications",
              filter: `user_id=eq.${user.id}`,
            },
            () => void load(),
          )
          .subscribe();
      } catch {
        skipRealtimeRef.current = true;
      }
    })();

    return () => {
      cancelled = true;
      window.clearInterval(t);
      if (ch && supabase) void supabase.removeChannel(ch);
    };
  }, [isReady, user, load]);

  if (!isReady || !user || !open || !id) {
    return null;
  }

  return (
    <div
      className="mb-6 rounded-xl border border-emerald-600/40 bg-emerald-950/50 px-4 py-3 text-sm text-emerald-50 shadow-sm"
      role="status"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-bold text-white">{bannerTitle ?? "CashCaddies Safety Coverage Applied"}</p>
          <p className="mt-0.5 whitespace-pre-line text-emerald-100/95">{bannerBody}</p>
        </div>
        <button
          type="button"
          className="shrink-0 rounded-lg border border-emerald-500/50 bg-emerald-900/40 px-3 py-1.5 text-xs font-semibold text-emerald-100 hover:bg-emerald-900/70"
          onClick={async () => {
            const r = await markProtectionNotificationRead(id);
            if (r.ok) {
              setOpen(false);
              setId(null);
              setBannerTitle(null);
              setBannerBody(null);
            }
          }}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
