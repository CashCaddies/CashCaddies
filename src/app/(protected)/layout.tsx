import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

/** Never cache this segment; beta gate must run on every navigation/request. */
export const dynamic = "force-dynamic";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();

  const supabase = createServerClient(
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
            /* Server Components may have read-only cookies; root middleware refreshes session. */
          }
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("beta_access")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    redirect("/");
  }

  if (profile?.beta_access !== true) {
    redirect("/");
  }

  return <>{children}</>;
}
