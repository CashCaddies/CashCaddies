"use client";

import { useAuth } from "@/contexts/auth-context";
import { DashboardHandleGate } from "@/components/dashboard-handle-gate";

export function DashboardShell({
  children,
  title,
  description,
}: {
  children: React.ReactNode;
  title: string;
  description?: string;
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
      </header>
      <DashboardHandleGate>{children}</DashboardHandleGate>
    </div>
  );
}
