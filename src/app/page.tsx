"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/auth-context";

export default function HomePage() {
  const { user } = useAuth();
  const [updates, setUpdates] = useState<any[]>([]);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");

  const isAdmin = user?.email === process.env.NEXT_PUBLIC_FOUNDER_EMAIL;

  useEffect(() => {
    fetchUpdates();
  }, []);

  const fetchUpdates = async () => {
    const res = await fetch("/api/updates", { cache: "no-store" });
    const json = await res.json();
    setUpdates(json.data || []);
  };

  const postUpdate = async () => {
    if (!title || !content) return;

    setLoading(true);

    await fetch("/api/admin/post-update", {
      method: "POST",
      body: JSON.stringify({ title, content }),
    });

    setTitle("");
    setContent("");
    await fetchUpdates();
    setLoading(false);
  };

  const saveEdit = async (id: string, title: string) => {
    await fetch("/api/admin/edit-update", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id,
        title,
        content: editContent,
      }),
    });

    setEditingId(null);
    setEditContent("");
    await fetchUpdates();
  };

  return (
    <div className="mx-auto max-w-3xl px-4 pb-20 pt-4 sm:px-5">
      <div className="mt-14 border-t border-slate-500/20 pt-12 sm:mt-16 sm:pt-14">
        <div className="rounded-2xl border border-white/[0.06] bg-slate-900/40 p-6 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] backdrop-blur-sm sm:p-8">
          <div className="mb-8 text-center sm:mb-10 sm:text-left">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-500/90">News</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">CashCaddies Updates</h1>
            <p className="mt-2 text-sm text-slate-500">Latest from the team — same feed for every visitor.</p>
          </div>

          {isAdmin && (
            <div className="mb-10 rounded-xl border border-amber-500/30 bg-[#0c1526]/90 p-5 shadow-[0_0_30px_rgba(0,0,0,0.25)] backdrop-blur-sm sm:p-6">
              <h2 className="text-lg font-bold text-amber-400/95">Admin Panel</h2>

              <input
                placeholder="Update Title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-4 w-full rounded-lg border border-slate-700 bg-black/50 p-2.5 text-white placeholder:text-slate-600"
              />

              <textarea
                placeholder="Update Content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={6}
                className="mt-3 w-full rounded-lg border border-slate-700 bg-black/50 p-2.5 text-white placeholder:text-slate-600"
              />

              <button
                onClick={postUpdate}
                disabled={loading}
                className="mt-4 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-emerald-500 hover:shadow-[0_0_24px_rgba(16,185,129,0.35)] disabled:opacity-50 disabled:hover:shadow-none"
              >
                {loading ? "Posting..." : "Post Update"}
              </button>
            </div>
          )}

          <div className="space-y-6 sm:space-y-8">
            {updates
              .filter((u: any) => !u.title?.toLowerCase().includes("test"))
              .map((u: any) => (
                <div
                  key={u.id}
                  className="rounded-xl border border-slate-700/50 bg-[#080f1a]/95 p-6 shadow-[0_4px_24px_rgba(0,0,0,0.22)] backdrop-blur-[2px] sm:p-7"
                >
                  <h2 className="text-xl font-bold text-white">{u.title}</h2>

                  {editingId === u.id ? (
                    <>
                      <textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        className="mt-4 w-full rounded-lg border border-slate-700 bg-black/40 p-2.5 text-white"
                        rows={6}
                      />

                      <button
                        onClick={() => saveEdit(u.id, u.title)}
                        className="mt-3 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-all duration-200 hover:bg-blue-500 hover:shadow-[0_0_20px_rgba(59,130,246,0.35)]"
                      >
                        Save
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="mt-4 whitespace-pre-line leading-relaxed text-slate-300">{u.content}</div>

                      {isAdmin && (
                        <button
                          onClick={() => {
                            setEditingId(u.id);
                            setEditContent(u.content);
                          }}
                          className="mt-3 text-sm font-medium text-amber-400/95 transition-all duration-200 hover:text-amber-300"
                        >
                          Edit
                        </button>
                      )}
                    </>
                  )}
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}
