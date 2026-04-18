"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

export default function ResponsesTable() {
  const [responses, setResponses] = useState<any[]>([]);
  const [reply, setReply] = useState("");
  const [active, setActive] = useState<string | null>(null);

  const getAuthHeaders = async (): Promise<HeadersInit> => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const headers: HeadersInit = { "Content-Type": "application/json" };
    if (session?.access_token) {
      (headers as Record<string, string>).Authorization = `Bearer ${session.access_token}`;
    }
    return headers;
  };

  const load = async () => {
    const headers = await getAuthHeaders();
    const res = await fetch("/api/admin/responses", { headers });
    const data = await res.json();
    setResponses(data.responses || []);
  };

  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="p-4">
      <h2 className="mb-4 text-lg font-semibold text-green-400">Update Responses</h2>

      <div className="space-y-3">
        {responses.map((r) => (
          <div
            key={r.id}
            className={`rounded-lg border p-4 ${
              r.is_read ? "border-gray-800" : "border-green-500"
            } bg-[#020617]`}
          >
            <div className="mb-1 text-xs text-gray-400">User: {r.user_id}</div>

            <div className="mb-2 text-xs text-gray-500">Update: {r.update_id}</div>

            <div className="mb-2 text-sm text-gray-200">{r.message}</div>

            {r.admin_reply && (
              <div className="mb-2 text-sm text-green-300">Reply: {r.admin_reply}</div>
            )}

            <div className="mt-2 flex gap-3 text-xs">
              <button
                type="button"
                onClick={async () => {
                  const headers = await getAuthHeaders();
                  await fetch("/api/admin/responses", {
                    method: "PATCH",
                    headers,
                    body: JSON.stringify({
                      id: r.id,
                      is_read: true,
                    }),
                  });
                  void load();
                }}
                className="text-green-400 hover:underline"
              >
                Mark Read
              </button>

              <button
                type="button"
                onClick={async () => {
                  const headers = await getAuthHeaders();
                  await fetch("/api/admin/responses", {
                    method: "DELETE",
                    headers,
                    body: JSON.stringify({ id: r.id }),
                  });
                  void load();
                }}
                className="text-red-400 hover:underline"
              >
                Delete
              </button>

              <button
                type="button"
                onClick={() => {
                  setActive(r.id);
                  setReply(r.admin_reply ?? "");
                }}
                className="text-yellow-400 hover:underline"
              >
                Reply
              </button>
            </div>

            {active === r.id && (
              <div className="mt-2">
                <textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  className="w-full rounded border border-gray-700 bg-black p-2 text-sm"
                  placeholder="Write reply..."
                />

                <button
                  type="button"
                  onClick={async () => {
                    const headers = await getAuthHeaders();
                    await fetch("/api/admin/responses", {
                      method: "PATCH",
                      headers,
                      body: JSON.stringify({
                        id: r.id,
                        admin_reply: reply,
                        is_read: true,
                      }),
                    });

                    setReply("");
                    setActive(null);
                    void load();
                  }}
                  className="mt-2 rounded bg-green-600 px-3 py-1 text-sm"
                >
                  Send Reply
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
