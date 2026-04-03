import type { LineupEntryStatusKind } from "@/lib/dashboard-lineups";

const BADGE_CLASS: Record<LineupEntryStatusKind, string> = {
  draft: "bg-slate-700/85 text-slate-200 ring-slate-600/55",
  protected: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/40",
  standard: "bg-sky-600/20 text-sky-300 ring-sky-500/35",
  locked: "bg-slate-950 text-slate-200 ring-slate-700/90 ring-offset-1 ring-offset-slate-900",
};

type Props = {
  kind: LineupEntryStatusKind;
  label: string;
};

/** Entry status on My Lineups cards: Draft / Protected / Standard / Locked. */
export function LineupEntryStatusBadge({ kind, label }: Props) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold leading-tight tracking-tight ring-1 ${BADGE_CLASS[kind]}`}
    >
      {label}
    </span>
  );
}
