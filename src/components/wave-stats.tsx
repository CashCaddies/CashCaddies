import type { WavePerformanceStats } from "@/lib/golf-tee-times";

type Props = {
  stats: WavePerformanceStats;
  advantageLine: string | null;
};

/** Wave AM/PM averages and advantage line (used inside {@link PremiumGate} on non-premium views). */
export function WavePerformanceStatsPanel({ stats, advantageLine }: Props) {
  return (
    <div className="rounded-lg border border-[#2a3039] bg-[#0f1419] px-4 py-3 text-xs sm:min-w-[16rem]">
      <p className="font-bold uppercase tracking-wide text-[#8b98a5]">Wave performance</p>
      <dl className="mt-2 space-y-1 tabular-nums text-[#c5cdd5]">
        <div className="flex justify-between gap-4">
          <dt className="text-sky-200/90">AM avg (vs par)</dt>
          <dd className="font-semibold text-white">
            {stats.amAverageVsPar != null ? stats.amAverageVsPar.toFixed(1) : "—"}{" "}
            <span className="text-[10px] font-normal text-[#6b7684]">({stats.amCount} plyrs)</span>
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-orange-200/90">PM avg (vs par)</dt>
          <dd className="font-semibold text-white">
            {stats.pmAverageVsPar != null ? stats.pmAverageVsPar.toFixed(1) : "—"}{" "}
            <span className="text-[10px] font-normal text-[#6b7684]">({stats.pmCount} plyrs)</span>
          </dd>
        </div>
        {advantageLine ? (
          <p className="mt-2 border-t border-[#2a3039] pt-2 font-semibold text-[#e8ecf0]">{advantageLine}</p>
        ) : (
          <p className="mt-2 border-t border-[#2a3039] pt-2 text-[#6b7684]">
            Add tee times and tee-round vs par to compare waves.
          </p>
        )}
      </dl>
    </div>
  );
}
