import { getLiveLeaderboard } from "@/lib/contest/get-live-leaderboard";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const data = await getLiveLeaderboard(id);
  return Response.json(data);
}
