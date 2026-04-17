"use server";

import { revalidatePath } from "next/cache";
import { supabase } from "@/lib/supabase/client";
import { validateUsernameFormat } from "@/lib/username";

export type UpdateUsernameResult = { ok: true } | { ok: false; error: string };

export async function updateProfileUsername(raw: string): Promise<UpdateUsernameResult> {
  const v = validateUsernameFormat(raw);
  if (!v.ok) {
    return v;
  }

    const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "You must be signed in." };
  }

  const { data: taken } = await supabase
    .from("profiles")
    .select("id")
    .eq("username", v.username)
    .neq("id", user.id)
    .maybeSingle();

  if (taken) {
    return { ok: false, error: "That username is already taken." };
  }

  const { error } = await supabase.from("profiles").update({ username: v.username }).eq("id", user.id);

  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: "That username is already taken." };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath("/dashboard/profile");
  revalidatePath("/dashboard");
  return { ok: true };
}
