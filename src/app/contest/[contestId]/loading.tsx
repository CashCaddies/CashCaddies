export default function ContestLeaderboardLoading() {
  return (
    <div className="space-y-0">
      <div className="border-b border-[#2a3039] bg-[#141920] px-4 py-5 sm:px-6">
        <div className="h-3 w-40 animate-pulse rounded bg-[#2a3039]" />
        <div className="mt-3 h-10 w-64 max-w-full animate-pulse rounded bg-[#2a3039]" />
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-lg border border-[#2a3039] bg-[#0f1419]" />
          ))}
        </div>
      </div>
      <div className="border-x border-b border-[#2a3039] bg-[#0f1419] px-4 py-6">
        <div className="h-64 animate-pulse rounded-lg bg-[#1a1f26]" />
      </div>
    </div>
  );
}
