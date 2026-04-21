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
    <div className="mx-auto max-w-3xl px-4 pb-16 pt-2 sm:px-5">
      {/* Admin + updates: premium section spacing */}
      <div className="mt-6 border-t border-slate-800/80 pt-10 sm:mt-8 sm:pt-12">
        <div className="mb-8 text-center sm:mb-10 sm:text-left">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-500/90">News</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">CashCaddies Updates</h1>
          <p className="mt-2 text-sm text-slate-500">Latest from the team — same feed for every visitor.</p>
        </div>

        {isAdmin && (
          <div className="mb-10 rounded-xl border border-amber-500/35 bg-[#0f172a]/80 p-5 shadow-[0_0_30px_rgba(0,0,0,0.25)] backdrop-blur-sm sm:p-6">
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
              className="mt-4 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500 disabled:opacity-50"
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
                className="rounded-xl border border-slate-800/90 bg-[#0b1220]/90 p-6 shadow-[0_4px_24px_rgba(0,0,0,0.2)] backdrop-blur-[2px] sm:p-7"
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
                      className="mt-3 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500"
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
                        className="mt-3 text-sm font-medium text-amber-400/95 hover:text-amber-300"
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
  );
}
