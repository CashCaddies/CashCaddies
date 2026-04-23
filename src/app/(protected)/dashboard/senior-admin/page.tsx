import Link from "next/link";

export default function AdminPage() {
  return (
    <div className="p-6 text-white">
      <h1 className="mb-6 text-2xl font-bold">Admin</h1>

      <Link
        href="/dashboard/admin/waitlist"
        className="block rounded-lg border border-gray-700 p-6 hover:bg-gray-800"
      >
        <h2 className="text-lg font-semibold">Access requests</h2>
        <p className="text-gray-400">Review and approve in-app waitlist requests (admin)</p>
      </Link>
    </div>
  );
}
