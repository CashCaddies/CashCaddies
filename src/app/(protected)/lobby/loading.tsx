export default function LobbyLoading() {
  return (
    <div className="space-y-0">
      <div className="border-b border-[#2a3039] bg-[#141920] px-4 py-5 sm:px-6">
        <div className="h-4 w-24 animate-pulse rounded bg-[#2a3039]" />
        <div className="mt-3 h-9 w-48 max-w-full animate-pulse rounded bg-[#2a3039]" />
        <div className="mt-2 h-4 w-72 max-w-full animate-pulse rounded bg-[#1a1f26]" />
      </div>
      <div className="border-x border-b border-[#2a3039] bg-[#0f1419] px-4 py-8">
        <div className="space-y-3">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded bg-[#1a1f26]" />
          ))}
        </div>
      </div>
    </div>
  );
}
