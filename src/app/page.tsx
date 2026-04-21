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
    <div className="mx-auto max-w-3xl px-4 mt-10 space-y-10">
      <h1 className="text-2xl font-semibold text-white">
        CashCaddies Updates
      </h1>

      {/* ADMIN PANEL */}
      {isAdmin && (
        <div className="border border-yellow-500 p-6 rounded-lg bg-[#111827] space-y-4">
          <h2 className="text-lg font-bold text-yellow-400">
            Admin Panel
          </h2>

          <input
            placeholder="Update Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full p-2 rounded bg-black border border-gray-700 text-white"
          />

          <textarea
            placeholder="Update Content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={6}
            className="w-full p-2 rounded bg-black border border-gray-700 text-white"
          />

          <button
            onClick={postUpdate}
            disabled={loading}
            className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded text-white"
          >
            {loading ? "Posting..." : "Post Update"}
          </button>
        </div>
      )}

      {/* UPDATES */}
      {updates
        .filter((u: any) => !u.title?.toLowerCase().includes("test"))
        .map((u: any) => (
          <div
            key={u.id}
            className="rounded-lg border border-gray-700 p-6 bg-[#0b1220] space-y-4"
          >
            <h2 className="text-xl font-bold text-white">{u.title}</h2>

            {editingId === u.id ? (
              <>
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="w-full p-2 rounded bg-black border border-gray-700 text-white"
                  rows={6}
                />

                <button
                  onClick={() => saveEdit(u.id, u.title)}
                  className="bg-blue-600 px-3 py-1 rounded text-white"
                >
                  Save
                </button>
              </>
            ) : (
              <>
                <div className="text-gray-300 whitespace-pre-line leading-relaxed">
                  {u.content}
                </div>

                {isAdmin && (
                  <button
                    onClick={() => {
                      setEditingId(u.id);
                      setEditContent(u.content);
                    }}
                    className="text-sm text-yellow-400"
                  >
                    Edit
                  </button>
                )}
              </>
            )}
          </div>
        ))}
    </div>
  );
}