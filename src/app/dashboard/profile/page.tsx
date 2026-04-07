"use client";

import Link from "next/link";
import { useState } from "react";
import { DashboardShell } from "@/components/dashboard-shell";
import { formatMoney } from "@/lib/wallet";
import { FounderBadge } from "@/components/founder-badge";
import { ProfileUsernameForm } from "@/components/profile-username-form";
import { useWallet } from "@/hooks/use-wallet";
import { supabase } from "@/lib/supabase/client";

const inputClass =
  "mt-2 block w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white placeholder:text-slate-500 focus:border-emerald-500/60 focus:outline-none focus:ring-1 focus:ring-emerald-500/40";

export default function ProfilePage() {
  const { user, wallet, loading: walletLoading, error, refresh } = useWallet();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [avatarMsg, setAvatarMsg] = useState("");
  const [avatarUploading, setAvatarUploading] = useState(false);

  async function uploadAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !supabase || !user?.id || !wallet) {
      return;
    }
    setAvatarMsg("");
    setAvatarUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
      const safeExt = ext && /^[a-z0-9]+$/.test(ext) ? ext : "jpg";
      const filePath = `${user.id}/${Date.now()}.${safeExt}`;
      const { error: upErr } = await supabase.storage.from("avatars").upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
      });
      if (upErr) {
        setAvatarMsg(upErr.message);
        return;
      }
      const { data } = supabase.storage.from("avatars").getPublicUrl(filePath);
      const { error: profileErr } = await supabase
        .from("profiles")
        .update({ avatar_url: data.publicUrl })
        .eq("id", user.id);
      if (profileErr) {
        setAvatarMsg(profileErr.message);
        return;
      }
      await refresh();
    } finally {
      setAvatarUploading(false);
    }
  }

  async function changePassword() {
    setMsg("");
    if (!user?.id) {
      setMsg("Sign in required.");
      return;
    }
    if (password.length < 8) {
      setMsg("Password must be at least 8 characters");
      return;
    }
    if (password !== confirm) {
      setMsg("Passwords do not match");
      return;
    }
    if (!supabase) {
      setMsg("Unable to connect. Try again.");
      return;
    }
    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });
      if (updateError) {
        setMsg("Error updating password");
      } else {
        setMsg("Password updated successfully");
        setPassword("");
        setConfirm("");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <DashboardShell
      title="Profile"
      description="Your account and beta wallet during the closed beta."
    >
      {walletLoading && <p className="text-slate-400">Loadingâ€¦</p>}
      {error && (
        <p className="rounded-lg border border-amber-700/50 bg-amber-950/40 px-4 py-3 text-amber-200">{error}</p>
      )}
      {!walletLoading && !user && (
        <p className="rounded-lg border border-slate-700 bg-slate-900/80 px-4 py-3 text-slate-300">
          <Link href="/login" className="font-semibold text-emerald-400 underline hover:text-emerald-300">
            Sign in
          </Link>{" "}
          to view your profile.
        </p>
      )}

      {user && !walletLoading && (
        <div className="space-y-8">
          <div className="accountSettings">
            <h2 className="mb-4 text-lg font-bold text-white">Account Settings</h2>
            <div className="settingsGrid">
              <div className="settingsCard goldCard">
                <h3>Username</h3>
                {wallet ? (
                  <>
                    <div className="profileAvatarRow">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={wallet.avatar_url?.trim() || "/default-avatar.svg"}
                        alt=""
                        className="profileAvatarPreview"
                        width={72}
                        height={72}
                      />
                      <div>
                        <p className="text-sm font-medium text-slate-300">Profile photo</p>
                        <label className="mt-1 inline-block cursor-pointer text-sm text-emerald-400 underline hover:text-emerald-300">
                          {avatarUploading ? "Uploadingâ€¦" : "Choose image"}
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp,image/gif"
                            className="sr-only"
                            disabled={avatarUploading}
                            onChange={(ev) => void uploadAvatar(ev)}
                          />
                        </label>
                        <p className="mt-1 text-xs text-slate-500">JPEG, PNG, WebP, or GIF Â· max 5 MB</p>
                        {avatarMsg ? (
                          <p className="mt-2 text-sm text-amber-200" role="status">
                            {avatarMsg}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <p className="text-sm text-slate-400">
                      Signed in as <span className="text-slate-200">{user.email}</span>
                    </p>
                    <div className="profileEmailSecurityNotice" role="note">
                      <p>
                        Email changes require contacting support for security reasons.{" "}
                        <a href="mailto:contact@cashcaddies.com">contact@cashcaddies.com</a>
                      </p>
                    </div>
                    <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-400">
                      <span>
                        Current handle:{" "}
                        <span className="font-medium text-slate-200">@{wallet.username}</span>
                      </span>
                      {wallet.founding_tester === true ? <FounderBadge /> : null}
                    </p>
                    <ProfileUsernameForm initialUsername={wallet.username} onUpdated={() => void refresh()} />
                  </>
                ) : (
                  <p className="text-sm text-slate-400">Loading profileâ€¦</p>
                )}
              </div>

              <div className="settingsCard">
                <h3>Password</h3>
                <label className="block text-sm font-medium text-slate-300">
                  New password
                  <input
                    type="password"
                    autoComplete="new-password"
                    placeholder="New password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={inputClass}
                  />
                </label>
                <label className="mt-3 block text-sm font-medium text-slate-300">
                  Confirm password
                  <input
                    type="password"
                    autoComplete="new-password"
                    placeholder="Confirm password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    className={inputClass}
                  />
                </label>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => void changePassword()}
                  className="ccButton mt-4 text-sm disabled:opacity-50"
                >
                  {loading ? "Updating..." : "Update Password"}
                </button>
                {msg ? (
                  <p
                    className={`mt-2 text-sm ${msg === "Password updated successfully" ? "text-emerald-400" : "text-amber-200"}`}
                    role="status"
                  >
                    {msg}
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          {wallet ? (
            <section className="goldCard p-6">
              <h2 className="mb-4 text-lg font-bold text-white">Wallet</h2>
              <p className="mb-4 text-sm text-slate-400">Beta testing funds</p>
              <div className="goldBorder rounded-xl bg-slate-950/80 p-6">
                <p className="text-sm font-medium text-slate-400">Wallet balance</p>
                <p className="mt-1 text-3xl font-bold tabular-nums text-white">{formatMoney(wallet.account_balance)}</p>
              </div>
              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                <div className="rounded-lg border border-emerald-900/40 bg-slate-950/60 px-4 py-3">
                  <dt className="text-slate-500">Safety Coverage credit</dt>
                  <dd className="mt-0.5 font-semibold tabular-nums text-emerald-200">
                    {formatMoney(wallet.protection_credit_balance ?? 0)}
                  </dd>
                </div>
                <div className="rounded-lg border border-slate-800 bg-slate-950/60 px-4 py-3">
                  <dt className="text-slate-500">Site credits</dt>
                  <dd className="mt-0.5 font-semibold tabular-nums text-emerald-300">{formatMoney(wallet.site_credits)}</dd>
                </div>
              </dl>
            </section>
          ) : null}

          <section className="goldCard p-6">
            <h2 className="mb-4 text-lg font-bold text-white">Basic profile info</h2>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-slate-500">Email</dt>
                <dd className="mt-0.5 text-slate-200">{user.email ?? "â€”"}</dd>
              </div>
              <div>
                <dt className="text-slate-500">DFS handle</dt>
                <dd className="mt-0.5 font-medium text-slate-200">
                  {wallet ? `@${wallet.username}` : "â€”"}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">User ID</dt>
                <dd className="mt-0.5 break-all font-mono text-xs text-slate-400">{user.id}</dd>
              </div>
              {wallet ? (
                <div>
                  <dt className="text-slate-500">Beta access</dt>
                  <dd className="mt-0.5 text-slate-200">{wallet.beta_user ? "Yes" : "No"}</dd>
                </div>
              ) : null}
            </dl>
          </section>

          <p className="text-center text-sm text-slate-500">
            <Link href="/lobby" className="font-semibold text-emerald-400 underline hover:text-emerald-300">
              Browse contests
            </Link>
          </p>
        </div>
      )}
    </DashboardShell>
  );
}
