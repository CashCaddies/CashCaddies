"use client";

import { useAuth } from "@/contexts/auth-context";
import { DashboardHandleGate } from "@/components/dashboard-handle-gate";
import { DashboardHandleOnboardingBanner } from "@/components/dashboard-handle-onboarding-banner";
import { DashboardNav, type DashboardNavMode } from "./dashboard-nav";

export function DashboardShell({
  children,
  title,
  description,
  /**
   * `dashboard` = full sub-nav (Lobby … Feedback Inbox). Use only on `/dashboard` overview.
   * `single` = one highlighted tab for the current page (default).
   */
  dashboardNavMode = "single",
}: {
  children: React.ReactNode;
  title: string;
  description?: string;
  dashboardNavMode?: DashboardNavMode;
}) {
  const { user, isReady } = useAuth();

  return (
    <div className="space-y-6">
      <header className="goldCard p-6">
        <div>
          <h1 className="text-4xl font-black tracking-tight sm:text-5xl">{title}</h1>
          {description ? <p className="mt-2 max-w-2xl text-lg text-slate-300">{description}</p> : null}
          <p className="mt-3 text-base text-emerald-300">
            {!isReady
              ? "Checking session…"
              : user
                ? `Logged in as ${user.email}`
                : "Not logged in — sign in to sync lineups."}
          </p>
        </div>
        <div className="mt-6">
          <DashboardNav mode={dashboardNavMode} />
        </div>
      </header>
      <DashboardHandleOnboardingBanner />
      <DashboardHandleGate>{children}</DashboardHandleGate>
    </div>
  );
}
