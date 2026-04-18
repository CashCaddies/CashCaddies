"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { updates } from "@/data/updates";

export default function HomePage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const check = async () => {
      const { data } = await supabase.auth.getUser();
      setUser(data?.user ?? null);
      setLoading(false);
    };

    check();
  }, []);

  if (loading) {
    return <div className="p-4">Loading...</div>;
  }

  if (user) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 p-4">
        <h2 className="text-xl font-semibold text-green-400">CashCaddies Updates</h2>

        {updates.map((a) => (
          <div key={a.id} className="rounded-lg border border-gray-800 bg-[#020617] p-4">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-xs font-semibold text-green-400">{a.tag}</span>
              <span className="text-xs text-gray-500">{a.time}</span>
            </div>

            <div className="mb-1 font-medium text-white">{a.title}</div>

            <div className="text-sm text-gray-400 whitespace-pre-line">{a.content}</div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="p-6 text-center">
      <h1 className="text-3xl font-semibold text-green-400">CashCaddies</h1>
      <p className="mt-2 text-gray-400">Premium Daily Fantasy Golf</p>
    </div>
  );
}
