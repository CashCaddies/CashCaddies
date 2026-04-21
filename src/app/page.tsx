"use client";

import { useEffect, useState } from "react";

export default function HomePage() {
  const [updates, setUpdates] = useState<any[]>([]);

  useEffect(() => {
    const fetchUpdates = async () => {
      const res = await fetch("/api/updates", { cache: "no-store" });
      const json = await res.json();
      setUpdates(json.data || []);
    };

    fetchUpdates();
  }, []);

  return (
    <div className="mx-auto max-w-3xl px-4 mt-10 space-y-8">
      <h1 className="text-2xl font-semibold text-white">
        CashCaddies Updates
      </h1>

      {updates.length === 0 ? (
        <p className="text-gray-400">No updates yet.</p>
      ) : (
        updates
          .filter((u: any) => u.title !== "Test Update")
          .map((u: any) => (
            <div
              key={u.id}
              className="rounded-lg border border-gray-700 p-6 bg-[#0b1220] space-y-4"
            >
              <h2 className="text-xl font-bold text-white">{u.title}</h2>
              <div className="text-gray-300 whitespace-pre-line leading-relaxed">
                {u.content}
              </div>
            </div>
          ))
      )}
    </div>
  );
}