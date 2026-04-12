/** Display label for admin payout tables (email preferred, then @username). */
export function formatPayoutUserDisplay(profile: {
  username?: string | null;
  email?: string | null;
} | null): { primary: string; secondary?: string } {
  if (!profile) {
    return { primary: "—" };
  }
  const email = typeof profile.email === "string" ? profile.email.trim() : "";
  const username = typeof profile.username === "string" ? profile.username.trim() : "";
  if (email !== "" && username !== "") {
    return { primary: email, secondary: `@${username}` };
  }
  if (email !== "") {
    return { primary: email };
  }
  if (username !== "") {
    return { primary: `@${username}` };
  }
  return { primary: "—" };
}
