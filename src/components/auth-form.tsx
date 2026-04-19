"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { CLOSED_BETA_ACCESS_MESSAGE } from "@/lib/supabase/beta-access";

type Props = {
  mode: "login" | "signup";
};

/** Maps DB trigger / Auth API text to closed-beta product copy. */
function formatAuthErrorMessage(
  raw: string,
  mode: "login" | "signup",
  errorCode?: string,
): string {
  if (raw.includes("CLOSED_BETA:") || raw.includes("CashCaddies is currently in a closed beta")) {
    return CLOSED_BETA_ACCESS_MESSAGE;
  }
  if (mode === "login") {
    const code = String(errorCode ?? "").toLowerCase();
    const lower = raw.toLowerCase();
    if (
      code === "email_not_confirmed" ||
      lower.includes("email not confirmed") ||
      (lower.includes("not confirmed") && lower.includes("email"))
    ) {
      return "Please confirm your email before logging in. Check your inbox.";
    }
    return raw;
  }
  if (mode !== "signup") {
    return raw;
  }
  const lower = raw.toLowerCase();
  if (
    lower.includes("invite-only beta") ||
    raw.includes("CashCaddies is currently invite-only beta")
  ) {
    return CLOSED_BETA_ACCESS_MESSAGE;
  }
  return raw;
}

export function AuthForm({ mode }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextParam = searchParams.get("next");

  const next =
    nextParam &&
    nextParam.startsWith("/") &&
    !nextParam.startsWith("//")
      ? nextParam
      : "/";

  async function persistLastSourceUpdate(
    userId: string,
    options?: { recordSignupConversion?: boolean },
  ) {
    if (typeof window === "undefined" || !supabase) return;
    try {
      const params = new URLSearchParams(window.location.search);
      const sourceUpdate = params.get("source_update");
      if (!sourceUpdate) return;

      const { error } = await supabase
        .from("profiles")
        .update({ last_source_update: sourceUpdate })
        .eq("id", userId);
      if (error) return;

      if (options?.recordSignupConversion) {
        try {
          const { error: convError } = await supabase.from("update_conversions").insert({
            update_id: sourceUpdate,
            user_id: userId,
            type: "signup",
          });
          if (convError) return;
        } catch {
          /* non-blocking attribution */
        }
      }
    } catch {
      /* non-blocking attribution */
    }
  }

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState<string>("");
  const [statusIsError, setStatusIsError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resetMode, setResetMode] = useState(false);
  const [resetMsg, setResetMsg] = useState("");
  const [resetSending, setResetSending] = useState(false);
  const [signupSuccess, setSignupSuccess] = useState(false);
  const [resendMsg, setResendMsg] = useState("");
  const [resendSending, setResendSending] = useState(false);
  const title = useMemo(() => (mode === "login" ? "Login" : "Create account"), [mode]);
  const submitLabel = useMemo(() => (mode === "login" ? "Log in" : title), [mode, title]);

  function resetPasswordRedirectUrl(): string {
    const envBase = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
    if (envBase) return `${envBase}/update-password`;
    if (typeof window !== "undefined") return `${window.location.origin}/update-password`;
    return "https://cashcaddies.com/update-password";
  }

  async function sendReset() {
    setResetMsg("");
    if (!supabase) {
      setResetMsg("Unable to connect. Try again.");
      return;
    }
    const trimmed = email.trim();
    if (!trimmed) {
      setResetMsg("Enter your email address.");
      return;
    }
    setResetSending(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(trimmed, {
        redirectTo: resetPasswordRedirectUrl(),
      });
      if (error) {
        setResetMsg("Error sending email");
      } else {
        setResetMsg("Reset email sent");
      }
    } finally {
      setResetSending(false);
    }
  }

  const handleLogin = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    setLoading(true);

    if (!supabase) {
      setStatusIsError(true);
      setStatus("Missing Supabase env vars. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      console.error(error);
      setLoading(false);
      return;
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session) {
      await persistLastSourceUpdate(session.user.id);
      router.push(next);
    } else {
      setLoading(false);
    }
  };

  async function resendConfirmation() {
    setResendMsg("");
    if (!supabase) {
      setResendMsg("Error: Unable to connect. Try again.");
      return;
    }
    const trimmed = email.trim();
    if (!trimmed) {
      setResendMsg("Error: Email missing.");
      return;
    }
    setResendSending(true);
    try {
      const { error } = await supabase.auth.resend({ type: "signup", email: trimmed });
      if (error) {
        setResendMsg(`Error: ${error.message}`);
      } else {
        setResendMsg("Confirmation email sent.");
      }
    } finally {
      setResendSending(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setStatus("");
    setStatusIsError(false);

    if (mode === "signup" && password !== confirmPassword) {
      setStatusIsError(true);
      setStatus("Passwords do not match");
      setLoading(false);
      return;
    }

    if (!supabase) {
      setStatusIsError(true);
      setStatus("Missing Supabase env vars. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
      setLoading(false);
      return;
    }

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });

    if (authError) {
      setStatusIsError(true);
      const errCode =
        authError && typeof authError === "object" && "code" in authError
          ? String((authError as { code?: string }).code ?? "")
          : undefined;
      setStatus(formatAuthErrorMessage(authError.message, mode, errCode));
      setLoading(false);
      return;
    }

    if (authData.user) {
      if (!authData.session) {
        setSignupSuccess(true);
        setLoading(false);
        return;
      }
      const { error: profileError } = await supabase.from("profiles").upsert(
        { id: authData.user.id },
        { onConflict: "id", ignoreDuplicates: true },
      );
      if (profileError) {
        setStatusIsError(true);
        setStatus(
          `Account was created, but we could not finish your profile setup: ${profileError.message}. Try signing in from the login page.`,
        );
        setLoading(false);
        return;
      }
    }

    setStatus("Welcome! Redirecting…");
    if (authData.user) {
      await persistLastSourceUpdate(authData.user.id, { recordSignupConversion: true });
    }
    router.push(next);
    setLoading(false);
  }

  const showSignupConfirmation = mode === "signup" && signupSuccess;

  const signupPasswordMismatch =
    mode === "signup" && confirmPassword.length > 0 && password !== confirmPassword;
  const signupPasswordsReady =
    mode !== "signup" || (confirmPassword.length > 0 && password === confirmPassword);

  return (
    <div className="mx-auto w-full max-w-md rounded-xl border border-slate-800 bg-slate-900 p-6 shadow-lg">
      <h1 className="text-2xl font-bold">{showSignupConfirmation ? "Check your email" : title}</h1>
      {!showSignupConfirmation ? (
        <p className="mt-1 text-sm text-slate-300">Use your account to enter fantasy golf contests.</p>
      ) : null}

      {showSignupConfirmation ? (
        <div className="mt-6 text-center">
          <div
            className="rounded-xl border border-emerald-500/45 bg-emerald-950/55 px-4 py-5 shadow-[inset_0_1px_0_0_rgba(52,211,153,0.12)]"
            role="status"
            aria-live="polite"
          >
            <p className="text-base font-semibold leading-snug text-emerald-100">
              Account created. Please check your email to confirm your account before logging in.
            </p>
            <p className="mt-3 text-sm text-emerald-200/90">
              If you don&apos;t see it, check your spam folder.
            </p>
            <button
              type="button"
              className="mt-5 w-full rounded-md border border-emerald-500/50 bg-emerald-600/25 px-4 py-2.5 text-sm font-semibold text-emerald-50 transition hover:bg-emerald-600/35 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={resendSending}
              onClick={() => void resendConfirmation()}
            >
              {resendSending ? "Sendingâ€¦" : "Resend confirmation email"}
            </button>
            {resendMsg ? (
              <p
                className={`mt-3 text-sm ${resendMsg.startsWith("Error") ? "text-amber-200" : "text-emerald-300"}`}
                role="status"
              >
                {resendMsg}
              </p>
            ) : null}
          </div>
        </div>
      ) : (
        <>
          <form
            className="mt-6 space-y-4"
            onSubmit={mode === "login" ? handleLogin : handleSubmit}
          >
            <label className="block space-y-2">
              <span className="text-sm text-slate-300">Email</span>
              <input
                className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm text-slate-300">Password</span>
              <input
                className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2"
                type="password"
                required
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                minLength={mode === "signup" ? 6 : undefined}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>

            {mode === "signup" ? (
              <div className="block space-y-2">
                <label className="block space-y-2">
                  <span className="text-sm text-slate-300">Confirm Password</span>
                  <input
                    className={`w-full rounded-md border bg-slate-950 px-3 py-2 ${
                      signupPasswordMismatch ? "border-amber-600" : "border-slate-700"
                    }`}
                    type="password"
                    required
                    autoComplete="new-password"
                    minLength={6}
                    placeholder="Re-enter password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    aria-invalid={signupPasswordMismatch}
                    aria-describedby="signup-confirm-password-hint"
                  />
                </label>
                <p id="signup-confirm-password-hint" className="text-sm text-slate-400">
                  Must match password above
                </p>
                {signupPasswordMismatch ? (
                  <p className="text-sm text-amber-200" role="alert">
                    Passwords do not match
                  </p>
                ) : null}
              </div>
            ) : null}

            <button
              className="w-full rounded-md bg-emerald-500 px-4 py-2 font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={loading || !signupPasswordsReady}
              type="submit"
            >
              {loading ? "Please wait..." : submitLabel}
            </button>
          </form>

          {mode === "login" && (
            <>
              <button
                type="button"
                className="forgotLink"
                onClick={() => {
                  setResetMode(true);
                  setResetMsg("");
                }}
              >
                Forgot password?
              </button>

              {resetMode && (
                <div className="resetBox" role="region" aria-label="Password reset">
                  <h3 className="text-base font-semibold text-white">Reset Password</h3>
                  <input
                    type="email"
                    placeholder="Enter email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                  <button type="button" disabled={resetSending} onClick={() => void sendReset()}>
                    {resetSending ? "Sendingâ€¦" : "Send Reset Email"}
                  </button>
                  {resetMsg ? (
                    <p
                      className={`mt-2 text-sm ${resetMsg === "Reset email sent" ? "text-emerald-300" : "text-amber-200"}`}
                      role="status"
                    >
                      {resetMsg}
                    </p>
                  ) : null}
                </div>
              )}
            </>
          )}
        </>
      )}

      {!showSignupConfirmation && status ? (
        <p
          className={`mt-4 text-sm ${statusIsError ? "text-amber-200" : "text-emerald-300"}`}
          role={statusIsError ? "alert" : "status"}
        >
          {status}
        </p>
      ) : null}
    </div>
  );
}
