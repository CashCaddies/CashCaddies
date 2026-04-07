"use client";

import type { User } from "@supabase/supabase-js";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/contexts/auth-context";
import { normalizeProfileRow, type ProfileRow } from "@/lib/wallet";
import { supabase } from "@/lib/supabase/client";
import {
  isMissingColumnOrSchemaError,
  isRelationMissingOrNotExposedError,
} from "@/lib/supabase-missing-column";

/**
 * Auth user merged with `public.profiles.role` (defaults to `"user"` when missing).
 * Use `fullUser.role` for admin checks â€” never `user.role` from auth alone.
 */
export type FullUser = User & {
  role: string;
  beta_status: string | null;
};

type WalletContextValue = {
  user: User | null;
  wallet: ProfileRow | null;
  fullUser: FullUser | null;
  error: string;
  loading: boolean;
  /** Re-fetch profile in the background (no global loading flash). Shared app-wide. */
  refresh: () => Promise<void>;
};

const WalletContext = createContext<WalletContextValue | null>(null);

let refreshWalletImpl: (() => Promise<void>) | null = null;

/** Call after balance changes from any screen; updates header + all `useWallet()` consumers. */
export async function refreshWallet(): Promise<void> {
  await refreshWalletImpl?.();
}

/** Same as {@link refreshWallet} â€” refetch `profiles` row (wallet_balance / account_balance) after mutations. */
export async function fetchWallet(): Promise<void> {
  return refreshWallet();
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const { user, isReady } = useAuth();
  const [wallet, setWallet] = useState<ProfileRow | null>(null);
  const [error, setError] = useState("");
  const [profileLoading, setProfileLoading] = useState(false);

  const loading = !isReady || profileLoading;

  const fetchProfile = useCallback(
    async (background: boolean) => {
      if (!supabase) {
        setError("Missing Supabase env vars.");
        setWallet(null);
        if (!background) setProfileLoading(false);
        return;
      }

      if (!isReady) {
        return;
      }

      if (!user?.id) {
        setWallet(null);
        setError("");
        if (!background) {
          setProfileLoading(false);
        }
        return;
      }

      if (!background) {
        setProfileLoading(true);
      }
      setError("");

      try {
        const {
          data: { user: authUser },
        } = await supabase.auth.getUser();

        if (!authUser?.id) {
          setWallet(null);
          return;
        }

        const { data, error: fetchError } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", authUser.id)
          .maybeSingle();

        if (process.env.NODE_ENV === "development" && data) {
          const raw = data as { role?: unknown };
          console.log("[use-wallet] PROFILE:", data, "ROLE:", raw.role);
        }

        if (fetchError) {
          if (
            isRelationMissingOrNotExposedError(fetchError) ||
            isMissingColumnOrSchemaError(fetchError)
          ) {
            setError("");
            setWallet(null);
            return;
          }
          setError("");
          setWallet(null);
          return;
        }

        if (!data) {
          const { error: insertErr } = await supabase.from("profiles").insert({
            id: authUser.id,
            beta_status: "pending",
            beta_user: false,
            founding_tester: false,
            is_beta_tester: false,
            is_premium: false,
          });
          if (insertErr && insertErr.code !== "23505") {
            setError("");
            setWallet(null);
            return;
          }
          const second = await supabase
            .from("profiles")
            .select("*")
            .eq("id", authUser.id)
            .maybeSingle();
          if (second.error) {
            setError("");
            setWallet(null);
          } else if (second.data) {
            setWallet(normalizeProfileRow(second.data));
          } else {
            setWallet(null);
          }
          return;
        }

        setWallet(normalizeProfileRow(data));
      } finally {
        if (!background) {
          setProfileLoading(false);
        }
      }
    },
    [isReady, user?.id],
  );

  const refresh = useCallback(() => fetchProfile(true), [fetchProfile]);

  useEffect(() => {
    refreshWalletImpl = refresh;
    return () => {
      refreshWalletImpl = null;
    };
  }, [refresh]);

  useEffect(() => {
    if (!isReady) return;
    void fetchProfile(false);
  }, [isReady, user?.id, fetchProfile]);

  useEffect(() => {
    if (!isReady || !user) return;
    const id = window.setInterval(() => {
      void fetchProfile(true);
    }, 10000);
    return () => window.clearInterval(id);
  }, [isReady, user?.id, fetchProfile]);

  const fullUser: FullUser | null = useMemo(() => {
    if (!user) return null;
    const raw = wallet?.role;
    const role = typeof raw === "string" && raw.trim() !== "" ? raw.trim() : "user";
    return {
      ...user,
      role,
      beta_status: wallet?.beta_status ?? null,
    };
  }, [user, wallet?.role, wallet?.beta_status]);

  const value = useMemo<WalletContextValue>(
    () => ({
      user,
      wallet,
      fullUser,
      error,
      loading,
      refresh,
    }),
    [user, wallet, fullUser, error, loading, refresh],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet(): WalletContextValue {
  const ctx = useContext(WalletContext);
  if (!ctx) {
    throw new Error("useWallet must be used within WalletProvider");
  }
  return ctx;
}
