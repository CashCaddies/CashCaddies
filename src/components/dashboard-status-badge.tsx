export function DashboardStatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  const cls =
    normalized === "live"
      ? "bg-amber-500/20 text-amber-300 ring-amber-500/30"
      : normalized === "open"
        ? "bg-emerald-500/20 text-emerald-300 ring-emerald-500/30"
        : normalized === "locked"
          ? "bg-slate-600/50 text-slate-200 ring-slate-500/30"
          : normalized === "ended"
            ? "bg-slate-800/90 text-slate-400 ring-slate-600/40"
            : "bg-slate-700/80 text-slate-300 ring-slate-600/40";
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${cls}`}>{status}</span>
  );
}
