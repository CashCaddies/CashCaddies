"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { parseUpdate } from "@/utils/parseUpdate";

const FOUNDER_UPDATES_EMAIL = "cashcaddies@outlook.com";

export default function HomePage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [raw, setRaw] = useState("");
  const [updates, setUpdates] = useState<any[]>([]);
  const [reply, setReply] = useState("");
  const [activeUpdate, setActiveUpdate] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

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
      <div className="mx-auto max-w-3xl px-4">
        <h1 className="mb-4 text-xl font-semibold text-white md:text-2xl">CashCaddies Updates</h1>
        <div className="mb-4 h-px bg-gray-800" />

        {user?.email === FOUNDER_UPDATES_EMAIL ? (
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

                console.log("🚀 Sending update request", formData);

                try {
                  const {
                    data: { session },
                  } = await supabase.auth.getSession();

                  const res = await fetch("/api/updates", {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      Authorization: `Bearer ${session?.access_token}`,
                    },
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
                } catch (err) {
                  console.error("FETCH CRASH:", err);
                  alert("FETCH FAILED");
                }
              }}
              className="mt-2 rounded bg-green-600 px-4 py-2"
            >
              Post Update
            </button>
          </div>
        ) : null}

        {updates.length === 0 ? (
          <div className="mt-16 text-center text-gray-500">
            <p>No updates yet.</p>
            <p className="mt-1 text-sm">We&apos;ll keep you posted here.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4 md:gap-6">
            {updates.map((a, i) => (
              <div
                key={a.id}
                className={`rounded-xl border bg-black/60 p-5 backdrop-blur-sm transition-all hover:border-green-500/40 hover:shadow-lg hover:shadow-green-500/10 ${
                  i === 0 ? "border-green-500/60 shadow-md shadow-green-500/10" : "border-gray-800"
                }`}
              >
                {i === 0 ? (
                  <span className="mb-2 block text-xs font-semibold text-green-400">NEW</span>
                ) : null}

                <div className="mb-2 flex items-start justify-between gap-2">
                  <div className="text-lg font-semibold text-white md:text-xl">{a.title}</div>
                  {user?.email === FOUNDER_UPDATES_EMAIL ? (
                    <div className="flex shrink-0 items-center">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(a.id);
                          setEditText(a.content);
                        }}
                        className="text-sm text-yellow-400"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          const confirmDelete = confirm("Delete this update?");
                          if (!confirmDelete) return;

                          const {
                            data: { session },
                          } = await supabase.auth.getSession();

                          const res = await fetch("/api/updates", {
                            method: "DELETE",
                            headers: {
                              "Content-Type": "application/json",
                              Authorization: `Bearer ${session?.access_token}`,
                            },
                            body: JSON.stringify({ id: a.id }),
                          });

                          const json = await res.json();

                          if (!res.ok) {
                            alert("ERROR: " + (json.error ?? "Request failed"));
                            return;
                          }

                          setUpdates((prev) => prev.filter((u) => u.id !== a.id));
                        }}
                        className="ml-3 text-sm text-red-400"
                      >
                        Delete
                      </button>
                    </div>
                  ) : null}
                </div>

                <div className="mt-2 text-xs text-gray-500">{new Date(a.created_at).toLocaleString()}</div>

                {editingId === a.id ? (
                  <>
                    <textarea
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      className="w-full rounded border border-gray-700 bg-black p-2 text-white"
                    />

                    <button
                      type="button"
                      onClick={async () => {
                        const {
                          data: { session },
                        } = await supabase.auth.getSession();

                        const res = await fetch("/api/updates", {
                          method: "PATCH",
                          headers: {
                            "Content-Type": "application/json",
                            Authorization: `Bearer ${session?.access_token}`,
                          },
                          body: JSON.stringify({
                            id: a.id,
                            message: editText,
                          }),
                        });

                        const json = await res.json();

                        if (!res.ok) {
                          alert("ERROR: " + json.error);
                          return;
                        }

                        setEditingId(null);
                        location.reload();
                      }}
                      className="mt-2 text-sm text-green-400"
                    >
                      Save
                    </button>
                  </>
                ) : (
                  <p className="whitespace-pre-line text-sm leading-relaxed text-gray-200 md:text-base">{a.content}</p>
                )}

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
        )}

        {user && user.email !== FOUNDER_UPDATES_EMAIL ? (
          <p className="mt-4 text-sm text-gray-500">Updates are managed by the CashCaddies team.</p>
        ) : null}
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
