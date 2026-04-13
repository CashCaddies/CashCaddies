"use client";

import { useMemo, useState } from "react";
import { saveGolferFantasyScore } from "@/app/admin/scoring/actions";
import { fantasyPointsFromCounts, POINTS_BIRDIE, POINTS_BOGEY, POINTS_PAR } from "@/lib/scoring";

type GolferOption = { id: string; name: string; fantasy_points: number };

export function AdminScoringForm({ golfers }: { golfers: GolferOption[] }) {
  const [golferId, setGolferId] = useState(golfers[0]?.id ?? "");
  const [birdies, setBirdies] = useState(0);
  const [pars, setPars] = useState(0);
  const [bogeys, setBogeys] = useState(0);
  const [adminSecret, setAdminSecret] = useState("");
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [pending, setPending] = useState(false);

  const computed = useMemo(
    () => fantasyPointsFromCounts(birdies, pars, bogeys),
    [birdies, pars, bogeys],
  );

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage(null);
    setPending(true);
    const fd = new FormData(e.currentTarget);
    const result = await saveGolferFantasyScore(fd);
    setPending(false);
    if (result.ok) {
      setMessage({ type: "ok", text: `Saved. Fantasy points: ${result.fantasyPoints.toFixed(2)}` });
    } else {
      setMessage({ type: "err", text: result.error });
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="space-y-2">
        <label htmlFor="golferId" className="block text-sm font-semibold text-[#c5cdd5]">
          Golfer
        </label>
        <div className="relative z-0">
          <select
            id="golferId"
            name="golferId"
            required
            value={golferId}
            onChange={(e) => setGolferId(e.target.value)}
            className="w-full max-w-md relative z-0 rounded border border-[#2a3039] bg-[#0f1419] px-3 py-2.5 text-[#e8ecf0]"
          >
            {golfers.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name} (current: {Number(g.fantasy_points).toFixed(1)} pts)
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid max-w-md gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="birdies" className="block text-sm font-semibold text-[#c5cdd5]">
            Birdies
          </label>
          <input
            id="birdies"
            name="birdies"
            type="number"
            min={0}
            step={1}
            value={birdies}
            onChange={(e) => setBirdies(Number(e.target.value))}
            className="mt-1 w-full rounded border border-[#2a3039] bg-[#0f1419] px-3 py-2 tabular-nums text-[#e8ecf0]"
          />
          <p className="mt-1 text-xs text-[#6b7684]">{POINTS_BIRDIE} pts each</p>
        </div>
        <div>
          <label htmlFor="pars" className="block text-sm font-semibold text-[#c5cdd5]">
            Pars
          </label>
          <input
            id="pars"
            name="pars"
            type="number"
            min={0}
            step={1}
            value={pars}
            onChange={(e) => setPars(Number(e.target.value))}
            className="mt-1 w-full rounded border border-[#2a3039] bg-[#0f1419] px-3 py-2 tabular-nums text-[#e8ecf0]"
          />
          <p className="mt-1 text-xs text-[#6b7684]">{POINTS_PAR} pts each</p>
        </div>
        <div>
          <label htmlFor="bogeys" className="block text-sm font-semibold text-[#c5cdd5]">
            Bogeys
          </label>
          <input
            id="bogeys"
            name="bogeys"
            type="number"
            min={0}
            step={1}
            value={bogeys}
            onChange={(e) => setBogeys(Number(e.target.value))}
            className="mt-1 w-full rounded border border-[#2a3039] bg-[#0f1419] px-3 py-2 tabular-nums text-[#e8ecf0]"
          />
          <p className="mt-1 text-xs text-[#6b7684]">{POINTS_BOGEY} pts each</p>
        </div>
      </div>

      <div className="rounded-lg border border-[#2a3039] bg-[#141920] px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#8b98a5]">Score (stored)</p>
        <p className="mt-1 text-2xl font-bold tabular-nums text-[#53d769]">{computed.toFixed(2)}</p>
        <p className="mt-1 text-sm text-[#6b7684]">Saved as fantasy_points on the golfer row.</p>
      </div>

      <div className="space-y-2">
        <label htmlFor="adminSecret" className="block text-sm font-semibold text-[#c5cdd5]">
          Admin secret
        </label>
        <input
          id="adminSecret"
          name="adminSecret"
          type="password"
          autoComplete="off"
          value={adminSecret}
          onChange={(e) => setAdminSecret(e.target.value)}
          className="w-full max-w-md rounded border border-[#2a3039] bg-[#0f1419] px-3 py-2.5 text-[#e8ecf0]"
          placeholder="ADMIN_SCORING_SECRET"
        />
      </div>

      <button
        type="submit"
        disabled={pending || golfers.length === 0}
        className="rounded border border-[#2d7a3a] bg-[#1f8a3b] px-6 py-2.5 text-sm font-bold uppercase tracking-wide text-white hover:bg-[#249544] disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save score"}
      </button>

      {message && (
        <p className={message.type === "ok" ? "text-[#53d769]" : "text-amber-400"}>{message.text}</p>
      )}
    </form>
  );
}
