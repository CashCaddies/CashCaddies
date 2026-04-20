"use client";

import { useEffect, useState } from "react";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";

export default function UpdatePassword() {
  const [pw, setPw] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    void supabase.auth.getSession().then(({ data }: { data: { session: Session | null } }) => {
      if (data.session) setSessionReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
      if (session && (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN" || event === "TOKEN_REFRESHED")) {
        setSessionReady(true);
      }
    });
    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  async function update() {
    setMsg("");
    if (pw.length < 8) {
      setMsg("Password must be at least 8 characters");
      return;
    }
    if (!supabase) {
      setMsg("Unable to connect. Try again.");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pw });
      if (error) {
        setMsg(error.message || "Error");
      } else {
        setMsg("Password updated");
        setPw("");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[50vh] max-w-md flex-col justify-center px-4">
      <div className="updatePasswordCard rounded-xl border border-slate-800 bg-slate-900 p-6 shadow-lg">
        <h2 className="text-xl font-bold text-white">Set New Password</h2>
        <p className="mt-2 text-sm text-slate-400">
          After you open the link from your email, choose a new password below. If this page does not load your session,
          try the link again or request a new reset from{" "}
          <Link href="/login" className="font-medium text-emerald-400 underline hover:text-emerald-300">
            Log in
          </Link>
          .
        </p>
        {!sessionReady && (
          <p className="mt-3 text-sm text-amber-200/90" role="status">
            Waiting for your sessionâ€¦ If you opened this page directly, use the link from your reset email.
          </p>
        )}
        <label className="mt-4 block space-y-2">
          <span className="text-sm text-slate-300">New password</span>
          <input
            className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder="New password"
            autoComplete="new-password"
            minLength={8}
          />
        </label>
        <button
          type="button"
          disabled={loading}
          className="mt-4 w-full rounded-md bg-emerald-500 px-4 py-2 font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
          onClick={() => void update()}
        >
          {loading ? "Updatingâ€¦" : "Update"}
        </button>
        {msg ? (
          <p
            className={`mt-3 text-sm ${msg === "Password updated" ? "text-emerald-300" : "text-amber-200"}`}
            role="status"
          >
            {msg}
          </p>
        ) : null}
        {msg === "Password updated" ? (
          <p className="mt-3 text-sm text-slate-400">
            <Link href="/login" className="font-semibold text-emerald-400 underline hover:text-emerald-300">
              Continue to log in
            </Link>
          </p>
        ) : null}
      </div>
    </div>
  );
}
