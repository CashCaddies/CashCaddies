import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSeniorAdmin } from "@/lib/permissions";

export default async function DashboardSeniorAdminLayout({ children }: { children: React.ReactNode }) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()) {
    redirect("/dashboard");
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user) {
    redirect("/login");
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (!isSeniorAdmin(profile?.role)) {
    redirect("/dashboard");
  }

  return <div className="dashboard-senior-admin-layout">{children}</div>;
}
