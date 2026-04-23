import { requireAdmin } from "@/lib/auth/requireAdmin";
import PageClient from "./page-client";

export default async function WaitlistPage() {
  await requireAdmin();
  return (
    <div className="min-h-[60vh] bg-gradient-to-b from-[#020617] via-[#061018] to-[#020617]">
      <PageClient />
    </div>
  );
}
