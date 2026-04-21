import { requireUser } from "@/lib/auth/require-user";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ contest?: string; edit?: string }>;
};

/** Alias URL for marketing / UX; lineup UI lives at `/lineup`. */
export default async function LineupBuilderAliasPage(props: Props) {
  await requireUser();
  const { contest, edit } = await props.searchParams;
  const parts: string[] = [];
  if (contest) parts.push(`contest=${encodeURIComponent(contest)}`);
  if (edit?.trim()) parts.push(`edit=${encodeURIComponent(edit.trim())}`);
  const q = parts.length > 0 ? `?${parts.join("&")}` : "";
  redirect(`/lineup${q}`);
}
