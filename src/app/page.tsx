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
    <div className="mx-auto max-w-3xl px-4 mt-10">
      <h1 className="mb-4 text-xl font-semibold text-white md:text-2xl">
        CashCaddies Updates
      </h1>

      {updates.length === 0 ? (
        <p className="text-gray-400">No updates yet.</p>
      ) : (
        updates.map((u: any) => (
          <div key={u.id} className="mb-4 border-b border-gray-700 pb-4">
            <h2 className="text-lg font-semibold text-white">{u.title}</h2>
            <p className="text-gray-300">{u.content}</p>
          </div>
        ))
      )}
    </div>
  );
}