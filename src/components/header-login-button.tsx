import Link from "next/link";
import UserMenu from "@/components/UserMenu";
import { createClient } from "@/lib/supabase/server";
import { hasClosedBetaAppAccess } from "@/lib/closed-beta-access";

const buttonClass =
  "rounded-md bg-emerald-500 px-4 py-2 text-base font-semibold text-slate-950";

/**
 * Header control: "Login" when signed out; signed-in users get the avatar user menu.
 */
export async function HeaderLoginButton() {
  let supabase;
  try {
    supabase = await createClient();
  } catch {
    return (
      <Link href="/login" className={buttonClass}>
        Login
      </Link>
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <Link href="/login" className={buttonClass}>
        Login
      </Link>
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, avatar_url, role, beta_user, beta_status, founding_tester")
    .eq("id", user.id)
    .maybeSingle();

  const handle =
    typeof profile?.username === "string" && profile.username.trim() !== "" ? profile.username.trim() : null;
  const label = handle != null ? `@${handle}` : "Account";
  const hasBetaAccess = hasClosedBetaAppAccess(
    { beta_user: profile?.beta_user, beta_status: profile?.beta_status },
    profile?.role,
  );

  return (
    <UserMenu
      profile={{
        avatar_url: profile?.avatar_url ?? null,
        role: profile?.role ?? null,
        username: typeof profile?.username === "string" ? profile.username : null,
        founding_tester: profile?.founding_tester === true,
      }}
      label={label}
      locked={!hasBetaAccess}
    />
  );
}
