"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

export default function HomeLoggedIn() {
  const [loading, setLoading] = useState(true);
  const [articles, setArticles] = useState<any[]>([]);

  useEffect(() => {
    const load = async () => {
      // TEMP mock data (replace later with API)
      setArticles([
        {
          title: "Scottie Scheffler dominates again",
          source: "PGA Tour",
        },
        {
          title: "DFS edge: Ownership trends this week",
          source: "CashCaddies",
        },
        {
          title: "Injury update: Key golfers to watch",
          source: "Industry News",
        },
      ]);
      setLoading(false);
    };

    load();
  }, []);

  if (loading) {
    return <div className="p-4">Loading feed...</div>;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4">
      <h2 className="text-xl font-semibold text-green-400">Latest Golf & DFS News</h2>

      {articles.map((a, i) => (
        <div key={i} className="rounded-lg border border-gray-800 bg-[#020617] p-4">
          <div className="text-sm text-gray-400">{a.source}</div>
          <div className="font-medium text-white">{a.title}</div>
        </div>
      ))}
    </div>
  );
}
