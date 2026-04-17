import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "FAQ · CashCaddies",
  description: "Frequently asked questions about the Portal, Safety Coverage Fund, and contests.",
};

export default function FAQPage() {
  return (
    <div className="min-h-screen bg-[#020617] px-6 py-16 text-white">
      <div className="mx-auto max-w-3xl">
        <h1 className="mb-8 text-3xl font-bold">Frequently Asked Questions</h1>

        <div className="space-y-6">
          <div>
            <h2 className="mb-2 text-lg font-semibold">What is the Portal?</h2>
            <p className="text-gray-400">
              The Portal is the gateway to CashCaddies’ most competitive and rewarding contests. Contests are divided
              into tiers based on contribution to the Safety Coverage Fund. As the fund grows, money-added tournaments
              are introduced for added value.
            </p>
          </div>

          <div>
            <h2 className="mb-2 text-lg font-semibold">What is the Safety Coverage Fund?</h2>
            <p className="text-gray-400">
              The Safety Coverage Fund protects entries when golfers withdraw, are disqualified, or do not start.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
