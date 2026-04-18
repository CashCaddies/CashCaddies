"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { parseUpdate } from "@/utils/parseUpdate";

export default function HomePage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [raw, setRaw] = useState("");
  const [updates, setUpdates] = useState<any[]>([]);
  const [reply, setReply] = useState("");
  const [activeUpdate, setActiveUpdate] = useState<string | null>(null);

  useEffect(() => {
    const check = async () => {
      const { data } = await supabase.auth.getUser();
      setUser(data?.user ?? null);
      setLoading(false);
    };

    check();
  }, []);

  useEffect(() => {
    const load = async () => {
      const res = await fetch("/api/updates");
      const data = await res.json();
      setUpdates(data.updates || []);
    };

    load();
  }, []);

  if (loading) {
    return <div className="p-4">Loading...</div>;
  }

  if (user) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 p-4">
        <h2 className="text-xl font-semibold text-green-400">CashCaddies Updates</h2>

        <div className="mb-6">
          <textarea
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            placeholder={`Title: ...
Tag: ...
Time: ...

Your update here...`}
            className="w-full rounded border border-gray-700 bg-black p-3 text-sm"
          />

          <button
            type="button"
            onClick={async () => {
              const formData = parseUpdate(raw);

              const res = await fetch("/api/updates", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData),
              });

              const json = await res.json();

              if (!res.ok) {
                console.error("Update failed:", json);
                alert("ERROR: " + json.error);
                return;
              }

              alert("Update posted successfully");

              setRaw("");

              const res2 = await fetch("/api/updates");
              const data = await res2.json();
              setUpdates(data.updates || []);
            }}
            className="mt-2 rounded bg-green-600 px-4 py-2"
          >
            Post Update
          </button>
        </div>

        {updates.map((a) => (
          <div
            key={a.id}
            className="rounded-xl border border-gray-700 bg-[#020617]/80 p-5 shadow-lg"
          >
            <div className="mb-1 flex items-center justify-between">
              <span className="text-xs font-semibold tracking-wide text-green-300 md:text-sm">{a.tag}</span>
              <span className="text-xs text-gray-400 md:text-sm">{a.time}</span>
            </div>

            <div className="mb-2 text-lg font-semibold text-white md:text-xl">{a.title}</div>

            <div className="whitespace-pre-line text-base leading-relaxed text-gray-200 md:text-lg">{a.content}</div>

            <button
              type="button"
              onClick={() => {
                setActiveUpdate(a.id);
                setReply("");
              }}
              className="mt-3 text-sm text-green-400 hover:underline"
            >
              Respond
            </button>

            {activeUpdate === a.id && (
              <div className="mt-3">
                <textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder="Share feedback or suggestions..."
                  className="w-full rounded border border-gray-700 bg-black p-2 text-sm"
                />

                <button
                  type="button"
                  onClick={async () => {
                    await fetch("/api/respond", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        update_id: a.id,
                        user_id: user?.id,
                        message: reply,
                      }),
                    });

                    setReply("");
                    setActiveUpdate(null);
                  }}
                  className="mt-2 rounded bg-green-600 px-3 py-1 text-sm"
                >
                  Send
                </button>
              </div>
            )}
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
