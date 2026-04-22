"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { getUserRole } from "@/lib/getUserRole";
import { isAdmin as hasAdminRole } from "@/lib/permissions";

type UpdateRow = {
  id: string;
  title: string;
  content: string;
  created_at: string;
};

export default function HomePage() {
  const { user } = useAuth();
  const [updates, setUpdates] = useState<UpdateRow[]>([]);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [profileRole, setProfileRole] = useState<string>("user");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const isAdmin = hasAdminRole(profileRole);

  useEffect(() => {
    void fetchUpdates();
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (!user?.id) {
      setProfileRole("user");
      return () => {
        cancelled = true;
      };
    }

    void getUserRole(user.id)
      .then((role) => {
        if (!cancelled) setProfileRole(role);
      })
      .catch(() => {
        if (!cancelled) setProfileRole("user");
      });

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

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

  const cancelEdit = () => {
    setEditingId(null);
    setEditContent("");
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

    cancelEdit();
    await fetchUpdates();
  };

  const deleteUpdate = async (id: string) => {
    if (!confirm("Delete this update permanently?")) return;

    setDeletingId(id);
    try {
      const res = await fetch("/api/admin/delete-update", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(typeof json.error === "string" ? json.error : "Failed to delete");
        return;
      }
      if (editingId === id) cancelEdit();
      await fetchUpdates();
    } finally {
      setDeletingId(null);
    }
  };

  const startEdit = (row: UpdateRow) => {
    setEditingId(row.id);
    setEditContent(row.content);
  };

  return (
    <div className="mx-auto max-w-3xl px-4 pb-16 pt-1 sm:px-5 sm:pb-20">
      <div className="mt-6 border-t border-slate-500/20 pt-6 sm:mt-8 sm:pt-7">
        {isAdmin && (
          <div className="mb-6 rounded-xl border border-amber-500/30 bg-[#0c1526]/90 p-5 shadow-[0_0_30px_rgba(0,0,0,0.25)] backdrop-blur-sm sm:p-6">
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

        {updates.length > 0 && (
          <div className="mb-8 space-y-4">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500 sm:text-xs">
              Latest posts
            </h2>
            <ul className="space-y-4">
              {updates.map((u) => {
                const dateLabel = u.created_at
                  ? new Date(u.created_at).toLocaleString(undefined, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })
                  : null;
                const isEditing = editingId === u.id;
                const busyDelete = deletingId === u.id;

                return (
                  <li
                    key={u.id}
                    className="rounded-xl border border-white/[0.12] bg-[#0b1220]/95 p-4 shadow-[0_8px_32px_-12px_rgba(0,0,0,0.45)] sm:p-5"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                      <div className="min-w-0 flex-1">
                        <h3 className="text-base font-semibold tracking-tight text-white sm:text-lg">
                          {u.title}
                        </h3>
                        {dateLabel && (
                          <p className="mt-1 text-xs text-slate-500">{dateLabel}</p>
                        )}
                      </div>
                      {isAdmin && (
                        <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
                          {isEditing ? (
                            <>
                              <button
                                type="button"
                                onClick={() => void saveEdit(u.id, u.title)}
                                className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-emerald-500 sm:text-sm"
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={cancelEdit}
                                className="rounded-lg border border-slate-600 bg-slate-800/80 px-3 py-2 text-xs font-semibold text-slate-200 transition-colors hover:bg-slate-700 sm:text-sm"
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => startEdit(u)}
                                className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-200 transition-colors hover:bg-amber-500/20 sm:text-sm"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => void deleteUpdate(u.id)}
                                disabled={busyDelete}
                                className="rounded-lg border border-rose-500/35 bg-rose-950/40 px-3 py-2 text-xs font-semibold text-rose-200 transition-colors hover:bg-rose-950/70 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
                              >
                                {busyDelete ? "Deleting…" : "Delete"}
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>

                    {isEditing ? (
                      <textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        rows={8}
                        className="mt-4 w-full rounded-lg border border-slate-600 bg-black/40 p-3 text-sm leading-relaxed text-slate-100 placeholder:text-slate-600 sm:text-[15px]"
                      />
                    ) : (
                      <div className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-slate-300 sm:text-[15px]">
                        {u.content}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <div
          className="group mx-auto max-w-3xl space-y-8 rounded-2xl border border-white/[0.14] bg-[#0b1220]/90 p-6 shadow-[0_10px_50px_-12px_rgba(0,0,0,0.55),0_0_0_1px_rgba(16,185,129,0.06)] ring-1 ring-white/[0.05] transition-[border-color,box-shadow] duration-300 hover:border-emerald-400/25 hover:shadow-[0_14px_56px_-10px_rgba(0,0,0,0.5),0_0_0_1px_rgba(16,185,129,0.12),0_0_40px_-6px_rgba(16,185,129,0.14)] sm:space-y-10 sm:p-8"
        >
          {/* Title */}
          <h2 className="text-xl font-semibold tracking-tight text-white sm:text-[1.35rem]">
            CashCaddies Update
          </h2>

          {/* Headline */}
          <p className="text-lg font-semibold leading-snug text-emerald-400 sm:text-xl">
            CashCaddies is now in closed beta
          </p>

          {/* What’s live */}
          <div className="space-y-3 pt-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500 sm:text-xs">
              What’s live
            </p>
            <ul className="list-disc space-y-2.5 pl-5 text-sm leading-relaxed text-slate-300 sm:text-[15px] sm:leading-relaxed">
              <li>The full platform structure is built</li>
              <li>Users can create accounts and access core areas (when approved)</li>
              <li>FAQ and updates system are live</li>
              <li>Safety Coverage Fund is introduced (early version)</li>
            </ul>
          </div>

          {/* In progress */}
          <div className="space-y-3 pt-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500 sm:text-xs">
              What we’re refining
            </p>
            <ul className="list-disc space-y-2.5 pl-5 text-sm leading-relaxed text-slate-300 sm:text-[15px] sm:leading-relaxed">
              <li>Contest system depth</li>
              <li>Live data and scoring reliability</li>
              <li>User onboarding and identity flow</li>
              <li>Overall experience polish</li>
            </ul>
          </div>

          {/* Story */}
          <div className="space-y-4 pt-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500 sm:text-xs">
              Why CashCaddies exists
            </p>
            <div className="rounded-xl border border-white/[0.08] border-l-[3px] border-l-emerald-500/55 bg-gradient-to-br from-[#05080e] via-[#070d14] to-[#0c1520] p-5 pl-5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05),0_0_24px_-8px_rgba(16,185,129,0.08)] sm:border-l-4 sm:p-6 sm:pl-7">
              <div className="space-y-4 text-sm leading-[1.7] text-slate-300 sm:text-[15px] sm:leading-[1.75]">
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
                <p className="text-[15px] font-semibold leading-snug text-white sm:text-base">
                  This isn’t a tweak to DFS. It’s a rebuild.
                </p>
              </div>
            </div>
          </div>

          {/* CTA */}
          <p className="border-t border-white/[0.06] pt-2 text-sm leading-relaxed text-emerald-400/95 sm:pt-3">
            Invite-only during beta — contact@cashcaddies.com
          </p>
        </div>
      </div>
    </div>
  );
}
