import { createServerClient } from "@supabase/auth-helpers-nextjs";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { ADMIN_ROLES, SENIOR_ADMIN_ROLES, normalizeRole } from "@/lib/auth/roles";

async function createSupabaseServerClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            /* Server Component / Server Action — cookie writes may be no-op */
          }
        },
      },
    },
  );
}

async function readProfileRole(userId: string): Promise<string | null> {
  const admin = createServiceRoleClient();
  if (!admin) return null;
  const { data, error } = await admin.from("profiles").select("role").eq("id", userId).single();
  if (error || !data) return null;
  return typeof (data as { role?: string | null }).role === "string"
    ? (data as { role: string }).role
    : null;
}

function roleAllowed(roleRaw: string | null | undefined, allowed: readonly string[]): boolean {
  const r = normalizeRole(roleRaw);
  return (allowed as readonly string[]).includes(r);
}

/**
 * Ensures the session user has an admin-class profile role. Uses the service role only to read `profiles.role`
 * (server-only). Redirects when unauthenticated or unauthorized.
 */
export async function requireAdmin() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/admin");
  }

  const role = await readProfileRole(user.id);
  if (!roleAllowed(role, ADMIN_ROLES)) {
    redirect("/");
  }

  return { userId: user.id, role: normalizeRole(role) };
}

/** Same as `requireAdmin` but only `senior_admin` and `founder` may proceed. */
export async function requireSeniorAdmin() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/admin");
  }

  const role = await readProfileRole(user.id);
  if (!roleAllowed(role, SENIOR_ADMIN_ROLES)) {
    redirect("/");
  }

  return { userId: user.id, role: normalizeRole(role) };
}

export type AdminClientContext =
  | { ok: true; userId: string; role: string; supabase: SupabaseClient }
  | { ok: false; error: string };

/** For server actions that must return `{ ok: false, error }` instead of redirecting. */
export async function getAdminClientContext(): Promise<AdminClientContext> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Not signed in." };
  }

  const roleRaw = await readProfileRole(user.id);
  if (!roleAllowed(roleRaw, ADMIN_ROLES)) {
    return { ok: false, error: "Admin access required." };
  }

  return { ok: true, userId: user.id, role: normalizeRole(roleRaw), supabase };
}

export async function getSeniorAdminClientContext(): Promise<AdminClientContext> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Not signed in." };
  }

  const roleRaw = await readProfileRole(user.id);
  if (!roleAllowed(roleRaw, SENIOR_ADMIN_ROLES)) {
    return { ok: false, error: "Senior admin access required." };
  }

  return { ok: true, userId: user.id, role: normalizeRole(roleRaw), supabase };
}
