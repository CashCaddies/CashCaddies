import { supabase } from "@/lib/supabase/client";

/** Current session profile slice (auth user â†’ `profiles` by id). */
export type CurrentProfile = {
  role: string | null;
  beta_status: string | null;
};

export type AppProfile = {
  id: string;
  email: string | null;
  role: string | null;
  beta_status: string | null;
};

export async function getProfile(): Promise<CurrentProfile | null> {
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("role,beta_status")
    .eq("id", user.id)
    .maybeSingle();
  if (error || !data) return null;
  return {
    role: typeof data.role === "string" ? data.role : null,
    beta_status: typeof data.beta_status === "string" ? data.beta_status : null,
  };
}

/** Fetch profile for a known user id (e.g. admin tools). */
export async function getProfileByUserId(userId: string): Promise<AppProfile | null> {
  const uid = String(userId ?? "").trim();
  if (!uid || !supabase) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("id,email,role,beta_status")
    .eq("id", uid)
    .maybeSingle();
  if (error || !data) return null;
  return {
    id: String(data.id ?? ""),
    email: typeof data.email === "string" ? data.email : null,
    role: typeof data.role === "string" ? data.role : null,
    beta_status: typeof data.beta_status === "string" ? data.beta_status : null,
  };
}
