"use client";

import { useCallback, useEffect, useState } from "react";
import { updateMaxBetaUsersCap } from "@/app/admin/user-actions";
import { APP_CONFIG_DEFAULT_MAX_BETA_USERS, APP_CONFIG_KEY_MAX_BETA_USERS, parseConfigNumber } from "@/lib/config";
import { supabase } from "@/lib/supabase";

export function MaxBetaUsersForm() {
  const [draft, setDraft] = useState(String(APP_CONFIG_DEFAULT_MAX_BETA_USERS));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error: qErr } = await supabase
      .from("app_config")
      .select("value")
      .eq("key", APP_CONFIG_KEY_MAX_BETA_USERS)
      .maybeSingle();
    setLoading(false);
    if (qErr) {
      setError(qErr.message);
      return;
    }
    const raw = data && typeof (data as { value?: unknown }).value === "string" ? (data as { value: string }).value : null;
    const n = parseConfigNumber(raw, APP_CONFIG_DEFAULT_MAX_BETA_USERS);
    setDraft(String(n));
    setError(null);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setError(null);
    setSaving(true);
    const res = await updateMaxBetaUsersCap(draft);
    setSaving(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setMessage(`Saved: cap is now ${res.maxBetaUsers}.`);
    setDraft(String(res.maxBetaUsers));
    await load();
  }

  return (
    <div className="goldCard p-5">
      <h2 className="text-lg font-semibold text-white">Max Beta Users</h2>
      <p className="mt-2 text-sm text-slate-400">
        Upper bound for users with approved beta status. Admins cannot approve beyond this limit.
      </p>
      <form className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={onSave}>
        <label className="block flex-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Limit (whole number, ≥ 0)</span>
          <input
            type="text"
            inputMode="numeric"
            name="maxBetaUsers"
            value={draft}
            onChange={(ev) => setDraft(ev.target.value)}
            disabled={loading || saving}
            className="mt-1 w-full max-w-xs rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/30 disabled:opacity-50"
            autoComplete="off"
          />
        </label>
        <button
          type="submit"
          disabled={loading || saving}
          className="rounded-md border border-amber-600/50 bg-amber-950/40 px-4 py-2 text-sm font-bold uppercase tracking-wide text-amber-100 hover:bg-amber-950/60 disabled:pointer-events-none disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </form>
      {loading ? <p className="mt-3 text-sm text-slate-500">Loading current value…</p> : null}
      {message ? <p className="mt-3 text-sm font-medium text-emerald-300">{message}</p> : null}
      {error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}
    </div>
  );
}
