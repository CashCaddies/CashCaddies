import { calculateSurplus, getOverlayAmount, getUnlockedTiers } from "@/lib/portal-logic";

function formatMoney(value: number | string | null | undefined): string {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "$0";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function portalFundTestMode(): 0 | 1 | 2 {
  // Change return value to test different states — remove when Supabase supplies fund data
  return 2;
}

export default function PortalPage() {
  const TEST_MODE = portalFundTestMode();

  let totalFund = 0;
  let requiredBuffer = 3000;

  if (TEST_MODE === 0) {
    totalFund = 3000; // surplus = 0
  }

  if (TEST_MODE === 1) {
    totalFund = 3500; // small surplus → weekly only ($500+)
  }

  if (TEST_MODE === 2) {
    totalFund = 13000; // surplus ≥ $10k for monthly (with $3k buffer)
  }

  const surplus = calculateSurplus(totalFund, requiredBuffer);
  const unlocked = getUnlockedTiers(surplus);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 px-4 py-8 sm:px-6">
      <header className="rounded-2xl border border-violet-500/30 bg-gradient-to-br from-[#140b2a] via-[#141a33] to-[#0d1524] p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-violet-200/90">Special Access</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">Portal Contests</h1>
        <p className="mt-2 text-sm text-violet-100/80">
          Premium portal contest drops, organized by cadence.
        </p>
      </header>

      <div className="space-y-6">
        {/* Fund Display */}
        <div className="rounded-xl border border-white/10 bg-[#0b1220] p-5 text-center">
          <p className="text-xs tracking-widest text-gray-400">CURRENT FUND SURPLUS</p>
          <p className="mt-1 text-2xl font-bold text-white">{formatMoney(surplus)}</p>
        </div>

        {/* WEEKLY */}
        <div>
          <h2 className="mb-2 text-xs tracking-widest text-gray-400">WEEKLY PORTAL</h2>

          <div className="rounded-xl border border-emerald-500/10 bg-[#0b1220] p-5">
            {unlocked.includes("weekly") ? (
              <>
                <p className="text-lg font-semibold text-emerald-400">
                  +{formatMoney(getOverlayAmount(surplus, "weekly"))}
                </p>
                <p className="mt-1 text-sm text-gray-400">Added to prize pool</p>
              </>
            ) : (
              <p className="italic text-gray-500">Locked — awaiting sufficient fund surplus</p>
            )}
          </div>
        </div>

        {/* BI-WEEKLY */}
        <div>
          <h2 className="mb-2 text-xs tracking-widest text-gray-400">BI-WEEKLY PORTAL</h2>

          <div className="rounded-xl border border-blue-500/10 bg-[#0b1220] p-5">
            {unlocked.includes("biweekly") ? (
              <>
                <p className="text-lg font-semibold text-blue-400">
                  +{formatMoney(getOverlayAmount(surplus, "biweekly"))}
                </p>
                <p className="mt-1 text-sm text-gray-400">Added to prize pool</p>
              </>
            ) : (
              <p className="italic text-gray-500">Locked — awaiting sufficient fund surplus</p>
            )}
          </div>
        </div>

        {/* MONTHLY */}
        <div>
          <h2 className="mb-2 text-xs tracking-widest text-gray-400">MONTHLY PORTAL</h2>

          <div className="rounded-xl border border-yellow-500/20 bg-[#0b1220] p-5">
            {unlocked.includes("monthly") ? (
              <>
                <p className="text-lg font-semibold text-yellow-400">
                  +{formatMoney(getOverlayAmount(surplus, "monthly"))}
                </p>
                <p className="mt-1 text-sm text-gray-400">Premium added prize pool</p>
              </>
            ) : (
              <p className="italic text-gray-500">Locked — premium tier requires strong fund surplus</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
