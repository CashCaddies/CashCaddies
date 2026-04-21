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

        <div className="mx-auto max-w-2xl mt-14 space-y-6 rounded-2xl border border-white/10 bg-[#0b1220]/80 p-6 shadow-lg">
          {/* Title */}
          <h2 className="text-xl font-semibold text-white">
            CashCaddies Update
          </h2>

          {/* Headline */}
          <p className="text-lg font-medium text-emerald-400">
            CashCaddies is now in closed beta
          </p>

          {/* What’s live */}
          <div className="space-y-2">
            <p className="text-sm font-semibold uppercase tracking-wide text-gray-400">
              What’s live
            </p>
            <ul className="list-disc space-y-1 pl-5 text-sm text-gray-300">
              <li>The full platform structure is built</li>
              <li>Users can create accounts and access core areas (when approved)</li>
              <li>FAQ and updates system are live</li>
              <li>Safety Coverage Fund is introduced (early version)</li>
            </ul>
          </div>

          {/* In progress */}
          <div className="space-y-2">
            <p className="text-sm font-semibold uppercase tracking-wide text-gray-400">
              What we’re refining
            </p>
            <ul className="list-disc space-y-1 pl-5 text-sm text-gray-300">
              <li>Contest system depth</li>
              <li>Live data and scoring reliability</li>
              <li>User onboarding and identity flow</li>
              <li>Overall experience polish</li>
            </ul>
          </div>

          {/* Story */}
          <div className="space-y-2">
            <p className="text-sm font-semibold uppercase tracking-wide text-gray-400">
              Why CashCaddies exists
            </p>
            <div className="rounded-xl border border-white/5 bg-black/30 p-4 text-sm text-gray-300 leading-relaxed space-y-3">
              <p>Golf got better. DFS didn’t.</p>
              <p>
                Players got stronger, faster, and started withdrawing more often —
                and nothing changed on the user side.
              </p>
              <p>
                If your golfer withdraws, you lose. That’s it.
              </p>
              <p>
                No protection. No accountability. No evolution.
              </p>
              <p>
                CashCaddies exists to fix that gap — to build a system where users
                aren’t left exposed, and where the platform reflects how golf works today.
              </p>
              <p className="text-white font-medium">
                This isn’t a tweak to DFS. It’s a rebuild.
              </p>
            </div>
          </div>

          {/* CTA */}
          <p className="text-sm text-emerald-400">
            Invite-only during beta — contact@cashcaddies.com
          </p>
        </div>
      </div>
    </div>
  );
}
