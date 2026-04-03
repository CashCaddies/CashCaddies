"use client";

import { useEffect, useState, useTransition } from "react";
import { updateProfileUsername } from "@/app/dashboard/profile/actions";
import { isPlaceholderUsername, isValidHandle } from "@/lib/username";

type Props = {
  initialUsername: string;
  onUpdated?: () => void;
};

export function ProfileUsernameForm({ initialUsername, onUpdated }: Props) {
  const [value, setValue] = useState(initialUsername);

  useEffect(() => {
    setValue(initialUsername);
  }, [initialUsername]);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage(null);
    const trimmed = value.trim();
    if (!isValidHandle(trimmed)) {
      setMessage({
        type: "err",
        text: "Handle must be 3–20 characters (letters, numbers, underscore only) and cannot start with user_.",
      });
      return;
    }
    startTransition(async () => {
      const result = await updateProfileUsername(trimmed);
      if (result.ok) {
        setMessage({ type: "ok", text: "Handle saved." });
        onUpdated?.();
      } else {
        setMessage({ type: "err", text: result.error });
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="mt-4 space-y-3">
      <label className="block space-y-2">
        <span className="text-sm font-medium text-slate-300">Username</span>
        <input
          type="text"
          name="username"
          autoComplete="username"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          minLength={3}
          maxLength={20}
          className="w-full max-w-md rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white placeholder:text-slate-500 focus:border-emerald-500/60 focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
          placeholder="your_handle"
        />
      </label>
      <p className="text-xs text-slate-500">
        3–20 characters: letters, numbers, and underscores. Must be unique. Cannot start with &quot;user_&quot;.
      </p>
      {isPlaceholderUsername(initialUsername) ? (
        <p className="text-xs font-medium text-amber-200/90">
          You still have a temporary handle. Choose your DFS handle to unlock the rest of the dashboard.
        </p>
      ) : null}
      {message ? (
        <p
          className={
            message.type === "ok"
              ? "text-sm font-medium text-emerald-400"
              : "text-sm font-medium text-amber-200"
          }
        >
          {message.text}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save Handle"}
      </button>
    </form>
  );
}
