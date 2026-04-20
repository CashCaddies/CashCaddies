import { ClosedBetaClient } from "./closed-beta-client";

/** Shell renders immediately; stats + account state load on the client (no blocking server fetch). */
export default function ClosedBetaPage() {
  return <ClosedBetaClient />;
}
