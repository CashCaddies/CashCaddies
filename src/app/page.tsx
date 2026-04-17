import PortalEntry from "@/components/portal-entry";
import { ClosedBetaClient } from "@/app/closed-beta/closed-beta-client";

export default function Page() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
      <PortalEntry />
      <ClosedBetaClient />
    </main>
  );
}
