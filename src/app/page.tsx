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

type RawUpdateRow = {
  id?: unknown;
  title?: unknown;
  content?: unknown;
  created_at?: unknown;
};

function normalizeUpdateRow(row: RawUpdateRow, index: number): UpdateRow {
  const rawId = row.id;
  const id = typeof rawId === "string" && rawId.trim().length > 0 ? rawId : `legacy-${index}`;

  const rawTitle = row.title;
  const title = typeof rawTitle === "string" && rawTitle.trim().length > 0
    ? rawTitle
    : "Untitled update";

  const rawContent = row.content;
  const content = typeof rawContent === "string" ? rawContent : String(rawContent ?? "");

  const rawCreatedAt = row.created_at;
  const createdAt = typeof rawCreatedAt === "string" ? rawCreatedAt : "";

  return {
    id,
    title,
    content,
    created_at: createdAt,
  };
}

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

    const rows = Array.isArray(json.data)
      ? json.data.map((row: RawUpdateRow, index: number) => normalizeUpdateRow(row, index))
      : [];

    setUpdates(rows);
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

  const saveEdit = async (id: string, cardTitle: string) => {
    await fetch("/api/admin/edit-update", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id,
        title: cardTitle,
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
    <div className="mx-auto w-full max-w-3xl px-4 pb-14 pt-1 sm:px-5 sm:pb-20 lg:max-w-[52rem]">
      <div className="mt-4 border-t border-white/[0.08] pt-4 sm:mt-6 sm:pt-6">
        <div className="space-y-5 sm:space-y-6">
          {isAdmin && (
            <section className="relative overflow-hidden rounded-2xl border border-amber-400/25 bg-[#0d1729]/90 p-5 shadow-[0_14px_42px_-16px_rgba(0,0,0,0.62),0_0_0_1px_rgba(245,158,11,0.12)] ring-1 ring-white/[0.04] backdrop-blur-sm sm:p-6">
              <div className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full bg-amber-500/10 blur-3xl" />
              <div className="relative">
                <h2 className="text-base font-bold tracking-wide text-amber-300 sm:text-lg">Admin Panel</h2>

                <div className="mt-4 space-y-3 sm:mt-5 sm:space-y-3.5">
                  <input
                    placeholder="Update Title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full rounded-xl border border-slate-600/85 bg-black/40 px-3 py-2.5 text-sm text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] outline-none transition-colors placeholder:text-slate-500 focus:border-emerald-400/55 focus:ring-2 focus:ring-emerald-400/20 sm:text-[15px]"
                  />

                  <textarea
                    placeholder="Update Content"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    rows={6}
                    className="w-full rounded-xl border border-slate-600/85 bg-black/40 px-3 py-2.5 text-sm leading-relaxed text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] outline-none transition-colors placeholder:text-slate-500 focus:border-emerald-400/55 focus:ring-2 focus:ring-emerald-400/20 sm:text-[15px]"
                  />
                </div>

                <button
                  onClick={postUpdate}
                  disabled={loading}
                  className="mt-4 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_8px_18px_-10px_rgba(16,185,129,0.8)] transition-all duration-200 hover:bg-emerald-500 hover:shadow-[0_10px_24px_-10px_rgba(16,185,129,0.9)] disabled:opacity-50 disabled:hover:shadow-none"
                >
                  {loading ? "Posting..." : "Post Update"}
                </button>
              </div>
            </section>
          )}

          {updates.length > 0 ? (
            <section className="space-y-3.5 sm:space-y-4">
              <div className="flex items-center justify-between border-b border-white/[0.06] pb-2">
                <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500 sm:text-xs">
                  Latest posts
                </h2>
              </div>

              <ul className="space-y-4 sm:space-y-5">
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
                      className="relative overflow-hidden rounded-2xl border border-white/[0.14] bg-[#0b1220]/92 p-4 shadow-[0_18px_45px_-22px_rgba(0,0,0,0.72),0_0_0_1px_rgba(16,185,129,0.08)] ring-1 ring-white/[0.04] transition-[border-color,box-shadow] duration-300 hover:border-emerald-400/20 hover:shadow-[0_20px_52px_-22px_rgba(0,0,0,0.78),0_0_0_1px_rgba(16,185,129,0.12)] sm:p-5"
                    >
                      <div className="pointer-events-none absolute -right-12 top-2 h-28 w-28 rounded-full bg-emerald-500/10 blur-3xl" />

                      <div className="relative flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                        <div className="min-w-0 flex-1">
                          <h3 className="text-base font-semibold tracking-tight text-white sm:text-lg">{u.title}</h3>
                          {dateLabel && <p className="mt-1 text-xs text-slate-500">{dateLabel}</p>}
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
                                  {busyDelete ? "Deleting..." : "Delete"}
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
                          className="relative mt-4 w-full rounded-xl border border-slate-600 bg-black/35 px-3 py-2.5 text-sm leading-relaxed text-slate-100 outline-none placeholder:text-slate-600 focus:border-emerald-400/55 focus:ring-2 focus:ring-emerald-400/20 sm:text-[15px]"
                        />
                      ) : (
                        <div className="relative mt-4 rounded-xl border border-white/[0.07] border-l-[3px] border-l-emerald-500/55 bg-gradient-to-br from-[#070d16] via-[#0a131f] to-[#0e1726] px-4 py-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03),0_10px_24px_-18px_rgba(16,185,129,0.5)] sm:px-5 sm:py-4">
                          <div className="whitespace-pre-wrap text-sm leading-relaxed text-slate-300 sm:text-[15px] sm:leading-[1.7]">
                            {u.content}
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : (
            <section className="rounded-2xl border border-white/[0.14] bg-[#0b1220]/92 p-6 shadow-[0_16px_46px_-20px_rgba(0,0,0,0.68)] ring-1 ring-white/[0.04] sm:p-8">
              <p className="text-lg font-semibold leading-snug text-emerald-400 sm:text-xl">
                CashCaddies is now in closed beta.
              </p>
              <p className="mt-3 text-sm leading-relaxed text-slate-300 sm:text-[15px]">
                Invite-only during beta. contact@cashcaddies.com
              </p>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
