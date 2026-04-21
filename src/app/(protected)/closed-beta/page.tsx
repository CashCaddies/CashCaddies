import { requireUser } from "@/lib/auth/require-user";
import { ClosedBetaClient } from "./closed-beta-client";

/** Shell renders immediately; stats + account state load on the client (no blocking server fetch). */
export default async function ClosedBetaPage() {
  await requireUser();
  return <ClosedBetaClient />;
}
