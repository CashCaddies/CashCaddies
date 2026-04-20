"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@/contexts/auth-context";
import { supabase } from "@/lib/supabase/client";
import { parseUpdate } from "@/utils/parseUpdate";

const FOUNDER_UPDATES_EMAIL = "cashcaddies@outlook.com";

const SIGNUP_CTA_SENTENCE = "Click here to create your account and request beta access.";

function renderUpdateBodyWithSignupLink(content: string, updateId: string): ReactNode {
  if (!content.includes(SIGNUP_CTA_SENTENCE)) {
    return content;
  }
  const parts = content.split(SIGNUP_CTA_SENTENCE);
  return (
    <>
      {parts.map((part, i) => (
        <span key={i}>
          {part}
          {i < parts.length - 1 ? (
            <button
              type="button"
              onClick={async () => {
                const payload = JSON.stringify({ updateId });

                try {
                  if (navigator.sendBeacon) {
                    const blob = new Blob([payload], { type: "application/json" });
                    navigator.sendBeacon("/api/track-update-click", blob);
                  } else {
                    await fetch("/api/track-update-click", {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                      },
                      body: payload,
                    });
                  }
                } catch (e) {}

                window.location.href = `/signup?next=/&source_update=${updateId}`;
              }}
              className="mt-3 inline-block px-4 py-2 rounded-lg bg-green-500/10 border border-green-500/40 text-green-300 hover:bg-green-500/20 transition font-medium"
            >
              Create Account / Request Beta Access
            </button>
          ) : null}
        </span>
      ))}
    </>
  );
}

export default function HomePage() {
  const { user, loading } = useAuth();
  const [raw, setRaw] = useState("");
  const [updates, setUpdates] = useState<any[]>([]);
  const [reply, setReply] = useState("");
  const [activeUpdate, setActiveUpdate] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  const getSessionId = () => {
    let sessionId = localStorage.getItem("cc_session_id");
    if (!sessionId) {
      sessionId = crypto.randomUUID();
      localStorage.setItem("cc_session_id", sessionId);
    }
    return sessionId;
  };

  useEffect(() => {
    if (!loading) {
      const fetchUpdates = async () => {
        const res = await fetch("/api/updates");
        const data = await res.json();
        setUpdates(data.updates || []);
      };

      void fetchUpdates();
    }
  }, [loading]);

  useEffect(() => {
    if (!loading && updates.length > 0 && typeof navigator !== "undefined") {
      void (async () => {
        const sessionId = getSessionId();

        for (const update of updates) {
          const id = update?.id;
          if (!id) continue;

          const key = `cc_seen_update_${id}`;
          const stored = localStorage.getItem(key);

          if (stored) {
            try {
              const parsed = JSON.parse(stored);
              const seenAt = parsed?.seenAt;

              const ONE_DAY = 24 * 60 * 60 * 1000;

              if (seenAt && Date.now() - seenAt < ONE_DAY) {
                continue;
              }
            } catch (e) {}
          }

          const payload = JSON.stringify({ updateId: id, sessionId });

          let sent = false;

          if (navigator.sendBeacon) {
            const blob = new Blob([payload], { type: "application/json" });
            sent = navigator.sendBeacon("/api/track-update-impression", blob);
          }

          if (!sent) {
            try {
              const res = await fetch("/api/track-update-impression", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: payload,
              });
              sent = res.ok;
            } catch (e) {}
          }

          if (sent) {
            localStorage.setItem(key, JSON.stringify({ seenAt: Date.now() }));
          }
        }
      })();
    }
  }, [loading, updates]);

  if (loading) {
    return null;
  }

  return (
    <>
      {!user ? (
        <div className="p-6 text-center">
          <h1 className="text-3xl font-semibold text-green-400">CashCaddies</h1>
          <p className="mt-2 text-gray-400">Premium Daily Fantasy Golf</p>
        </div>
      ) : null}

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
                className={`relative z-0 rounded-xl border bg-black/60 p-5 backdrop-blur-sm transition-all hover:border-green-500/40 hover:shadow-lg hover:shadow-green-500/10 ${
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
                      <div className="relative z-[9999] pointer-events-auto">
                        <button
                          type="button"
                          onClick={async () => {
                            console.log("SEND EMAIL CLICKED", a.id);

                            try {
                              const res = await fetch("/api/send-update-email", {
                                method: "POST",
                                headers: {
                                  "Content-Type": "application/json",
                                },
                                body: JSON.stringify({
                                  updateId: a.id,
                                }),
                              });

                              const data = await res.json();
                              console.log("EMAIL RESPONSE:", data);

                              if (!res.ok) {
                                alert(typeof data.error === "string" ? data.error : "Email failed");
                                return;
                              }

                              alert("Email sent");
                            } catch (err) {
                              console.error("EMAIL ERROR:", err);
                              alert("Email failed");
                            }
                          }}
                          className="ml-3 text-blue-400 hover:text-blue-300 cursor-pointer"
                        >
                          Send Email
                        </button>
                      </div>
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
                  <p className="whitespace-pre-line text-sm leading-relaxed text-gray-200 md:text-base">
                    {renderUpdateBodyWithSignupLink(a.content, a.id)}
                  </p>
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
    </>
  );
}
