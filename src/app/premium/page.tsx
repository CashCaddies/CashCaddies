import Link from "next/link";
import { PremiumSubscribeButton } from "@/components/premium-subscribe-button";
import { getDfsPremiumViewerForRequest } from "@/lib/dfs-premium-viewer";
import { getPremiumPriceDisplayLabel } from "@/lib/stripe";

export const metadata = {
  title: "Premium | CashCaddies",
  description: "CashCaddies Premium — advanced DFS golf tools and monthly membership.",
};

export default async function PremiumPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>;
}) {
  const sp = await searchParams;
  const checkout = sp.checkout;
  const viewer = await getDfsPremiumViewerForRequest();
  const priceLabel = getPremiumPriceDisplayLabel();

  return (
    <div className="mx-auto max-w-lg space-y-8 px-4 py-12">
      <div>
        <h1 className="text-2xl font-bold text-white">CashCaddies Premium</h1>
        <p className="mt-2 text-sm leading-relaxed text-[#9fb0bf]">
          Monthly membership unlocks the same advanced tools used in pro DFS golf: tee-time waves, ownership
          projections, wave advantage, and more.
        </p>
        <p className="mt-2 text-xs text-[#6b7684]">
          Beta testers receive these tools at no charge (admin-assigned). Everyone else can subscribe here.
        </p>
      </div>

      {checkout === "success" ? (
        <p
          className="rounded-lg border border-emerald-500/40 bg-emerald-950/35 px-4 py-3 text-sm text-emerald-100"
          role="status"
        >
          Payment received — your account will update in a few seconds. Refresh the page if Premium does not appear
          right away.
        </p>
      ) : null}
      {checkout === "canceled" ? (
        <p className="rounded-lg border border-amber-500/35 bg-amber-950/25 px-4 py-3 text-sm text-amber-100" role="status">
          Checkout canceled. You can try again whenever you are ready.
        </p>
      ) : null}

      <section className="rounded-xl border border-[#2a3039] bg-[#141920] p-5">
        <h2 className="text-sm font-bold uppercase tracking-wide text-[#c5cdd5]">Included with Premium</h2>
        <ul className="mt-3 list-inside list-disc space-y-2 text-sm text-[#c5cdd5]">
          <li>Advanced golf tools on contest leaderboards</li>
          <li>Ownership projections (field popularity)</li>
          <li>Tee times and AM/PM wave filters</li>
          <li>Wave performance and advantage stats</li>
          <li>More analytics coming soon</li>
        </ul>
        <div className="mt-6 border-t border-[#2a3039] pt-6">
          <PremiumSubscribeButton subscribed={viewer.isPremiumSubscriber} priceLabel={priceLabel} />
        </div>
      </section>

      <Link
        href="/lobby"
        className="inline-flex rounded-lg border border-[#3d4550] bg-[#1c2128] px-4 py-2.5 text-sm font-semibold text-[#e8ecf0] hover:bg-[#232a33]"
      >
        Back to lobby
      </Link>
    </div>
  );
}
