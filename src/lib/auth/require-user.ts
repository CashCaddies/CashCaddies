import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function requireUser() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  const isApproved =
    profile?.beta_status === "approved" ||
    profile?.role === "admin" ||
    profile?.role === "senior_admin" ||
    profile?.founding_tester === true;

  if (!isApproved) {
    redirect("/not-approved");
  }

  return { user, profile };
}
