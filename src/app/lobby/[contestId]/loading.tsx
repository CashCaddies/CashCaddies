export default function LobbyContestDetailLoading() {
  return (
    <div className="space-y-0">
      <div className="border-b border-[#2a3039] bg-[#141920] px-4 py-5 sm:px-6">
        <div className="h-3 w-20 animate-pulse rounded bg-[#2a3039]" />
        <div className="mt-3 h-10 w-2/3 max-w-md animate-pulse rounded bg-[#2a3039]" />
      </div>
      <div className="border-x border-b border-[#2a3039] bg-[#0f1419] px-4 py-8">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-lg bg-[#1a1f26]" />
          ))}
        </div>
      </div>
    </div>
  );
}
