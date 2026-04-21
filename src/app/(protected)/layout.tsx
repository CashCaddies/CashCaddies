import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  console.log("PROTECTED LAYOUT HIT");

  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  console.log("USER:", user);
  console.log("USER ERROR:", userError);

  if (!user || userError) {
    console.log("REDIRECT: NO USER");
    redirect("/");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  console.log("PROFILE:", profile);
  console.log("PROFILE ERROR:", profileError);

  const isApproved =
    profile?.beta_status === "approved" ||
    profile?.beta_access === true;

  if (profileError || !profile || !isApproved) {
    console.log("REDIRECT: NOT APPROVED");
    redirect("/");
  }

  return <>{children}</>;
}
