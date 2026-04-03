import Link from "next/link";

export default function SeniorAdminManagersPage() {
  return (
    <div className="pageWrap space-y-6 py-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">Admin Manager</h1>
        <p className="mt-2 text-sm text-slate-400">
          Promote users to <span className="text-slate-200">admin</span> or remove admin access from the beta management
          console. Only senior admins can change roles; the app enforces this on the server.
        </p>
      </header>
      <div className="goldCard p-6">
        <p className="text-slate-300">
          Open{" "}
          <Link href="/dashboard/beta-management" className="font-semibold text-emerald-400 underline hover:text-emerald-300">
            Beta User Management
          </Link>{" "}
          to view all profiles, notes, and the <strong className="text-white">Make Admin</strong> / role actions (visible
          only when signed in as senior admin).
        </p>
        <p className="mt-4">
          <Link
            href="/dashboard/senior-admin"
            className="text-sm font-semibold text-slate-400 underline hover:text-slate-200"
          >
            ← Back to Senior Admin Panel
          </Link>
        </p>
      </div>
    </div>
  );
}
