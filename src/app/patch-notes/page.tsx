"use client";

import Card from "@/components/ui/Card";
import { useEffect, useMemo, useState } from "react";
import { useWallet } from "@/hooks/use-wallet";
import { hasPermission } from "@/lib/permissions";
import { PATCHES } from "@/lib/patch-notes";
import { supabase } from "@/lib/supabase/client";

type FounderUpdate = {
  id: string;
  message: string | null;
};

export default function PatchNotesPage() {
  const { wallet, fullUser } = useWallet();
  const [founder, setFounder] = useState<FounderUpdate | null>(null);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const canEditFounderMessage = useMemo(
    () => hasPermission(fullUser?.role, "system_settings"),
    [fullUser?.role],
  );

  async function loadFounderMessage() {
    if (!supabase) return;
    const { data } = await supabase
      .from("founder_updates")
      .select("id,message")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!data) return;
    const row = { id: String(data.id ?? ""), message: typeof data.message === "string" ? data.message : "" };
    setFounder(row);
    setMessage(row.message ?? "");
  }

  useEffect(() => {
    void loadFounderMessage();
  }, []);

  async function updateFounderMessage() {
    if (!supabase || !founder?.id || !canEditFounderMessage) return;
    setSaving(true);
    setSaveMsg(null);
    const { error } = await supabase
      .from("founder_updates")
      .update({ message, updated_at: new Date().toISOString() })
      .eq("id", founder.id);
    setSaving(false);
    if (error) {
      setSaveMsg(error.message);
      return;
    }
    setSaveMsg("Founder message updated.");
    await loadFounderMessage();
  }

  return (
    <div className="pageWrap">
      <h1 className="goldText text-2xl font-semibold">CashCaddies Patch Notes</h1>
      <div className="founderMessage">
        <h2 className="text-lg font-semibold text-white">Message From Your Founder</h2>
        <p className="mt-2 whitespace-pre-wrap text-slate-200">
          {founder?.message?.trim() || "Welcome to the CashCaddies founding beta group."}
        </p>
        {canEditFounderMessage ? (
          <div className="mt-4 space-y-2">
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="min-h-[110px] w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
            />
            <button
              type="button"
              onClick={() => void updateFounderMessage()}
              disabled={saving}
              className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-60"
            >
              {saving ? "Updating..." : "Update Message"}
            </button>
            {saveMsg ? <p className="text-xs text-slate-300">{saveMsg}</p> : null}
          </div>
        ) : null}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "18px", marginTop: "20px" }}>
        {PATCHES.map((patch, i) => (
          <Card key={i}>
            <h2 style={{ fontSize: "18px", fontWeight: 600 }}>{patch.title}</h2>

            <div style={{ color: "#9CA3AF", fontSize: "13px", marginBottom: "10px" }}>{patch.date}</div>

            <ul>
              {patch.notes.map((n, j) => (
                <li key={j} style={{ marginBottom: "6px" }}>
                  {n}
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </div>
  );
}

