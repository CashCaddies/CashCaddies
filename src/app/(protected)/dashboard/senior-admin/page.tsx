import Link from "next/link";
import { requireUser } from "@/lib/auth/require-user";
import { MaxBetaUsersForm } from "./max-beta-users-form";

export default async function SeniorAdminHomePage() {
  await requireUser();
  return (
    <div className="pageWrap space-y-8 py-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">Senior Admin Panel</h1>
        <p className="mt-2 text-sm text-slate-400">
          Full system control: roles, beta policy, and operational tools. Regular admins do not see this area.
        </p>
      </header>

      <MaxBetaUsersForm />

      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/dashboard/senior-admin/admins"
          className="goldCard block p-5 transition hover:border-amber-500/40 focus-visible:outline focus-visible:ring-2 focus-visible:ring-amber-500/50"
        >
          <h2 className="text-lg font-semibold text-white">Admin Manager</h2>
          <p className="mt-2 text-sm text-slate-400">Grant or revoke admin roles (senior only).</p>
        </Link>
        <Link
          href="/dashboard/admin/beta-queue"
          className="goldCard block p-5 transition hover:border-amber-500/40 focus-visible:outline focus-visible:ring-2 focus-visible:ring-amber-500/50"
        >
          <h2 className="text-lg font-semibold text-white">Beta Queue</h2>
          <p className="mt-2 text-sm text-slate-400">Review pending beta access (approve or reject with audit trail).</p>
        </Link>
        <Link
          href="/admin/settlement"
          className="goldCard block p-5 transition hover:border-amber-500/40 focus-visible:outline focus-visible:ring-2 focus-visible:ring-amber-500/50"
        >
          <h2 className="text-lg font-semibold text-white">System Controls</h2>
          <p className="mt-2 text-sm text-slate-400">Settlement, insurance, and protection engine tools.</p>
        </Link>
        <Link
          href="/dashboard/admin"
          className="goldCard block p-5 transition hover:border-emerald-500/35 focus-visible:outline focus-visible:ring-2 focus-visible:ring-emerald-500/50"
        >
          <h2 className="text-lg font-semibold text-white">Staff Command Center</h2>
          <p className="mt-2 text-sm text-slate-400">Shared metrics hub (admin + senior).</p>
        </Link>
      </div>
    </div>
  );
}
