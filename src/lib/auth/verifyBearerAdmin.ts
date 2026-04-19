import { createClient } from "@supabase/supabase-js";
import { isAdminRole } from "@/lib/auth/roles";
import { getServiceClient } from "@/lib/supabase/service";

export type BearerAdminResult = { userId: string } | { error: string; status: number };

/** Validates `Authorization: Bearer <jwt>` and `profiles.role` for admin API routes. */
export async function verifyBearerAdmin(req: Request): Promise<BearerAdminResult> {
  const anon = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return { error: "No auth", status: 401 };
  }

  const { data, error } = await anon.auth.getUser(token);
  if (error || !data.user) {
    return { error: "Unauthorized", status: 401 };
  }

  const svc = getServiceClient();
  const { data: row, error: profileErr } = await svc.from("profiles").select("role").eq("id", data.user.id).single();

  if (profileErr || !row || !isAdminRole((row as { role?: string | null }).role)) {
    return { error: "Unauthorized", status: 403 };
  }

  return { userId: data.user.id };
}
