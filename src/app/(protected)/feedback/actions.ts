"use server";

import { supabase } from "@/lib/supabase/client";

const MAX_LEN = 2000;
const TITLE_MAX = 200;
const PAGE_MAX = 500;

export type FeedbackIntakeType = "bug" | "idea";

export type SubmitBetaFeedbackResult = { ok: true } | { ok: false; error: string };

function clipOptional(raw: string | undefined, max: number): string | null {
  const t = typeof raw === "string" ? raw.trim() : "";
  if (!t) return null;
  const clipped = t.length > max ? t.slice(0, max) : t;
  return clipped;
}

function clipTitle(raw: string | undefined): string | null {
  return clipOptional(raw, TITLE_MAX);
}

function clipMessage(raw: string | undefined): string | null {
  return clipOptional(raw, MAX_LEN);
}

export async function submitBetaFeedback(payload: {
  feedback_type: FeedbackIntakeType;
  title: string;
  message: string;
  issue_page?: string;
}): Promise<SubmitBetaFeedbackResult> {
  const ft = payload.feedback_type;
  if (ft !== "bug" && ft !== "idea") {
    return { ok: false, error: "Invalid feedback type." };
  }

  const title = clipTitle(payload.title);
  const message = clipMessage(payload.message);
  if (!title) {
    return { ok: false, error: "Please add a title." };
  }
  if (!message) {
    return { ok: false, error: "Please add a description." };
  }

  const issue_page = clipOptional(payload.issue_page, PAGE_MAX);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "You must be signed in to submit feedback." };
  }

  const { error } = await supabase.from("beta_feedback").insert({
    user_id: user.id,
    feedback_type: ft,
    title,
    message,
    issue_page,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}
