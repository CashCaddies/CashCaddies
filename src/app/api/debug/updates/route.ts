import { getServiceClient } from "@/lib/supabase/service";

export async function GET() {
  const supabase = getServiceClient();

  const { data, error } = await supabase.from("founder_updates").select("*").limit(1);

  return new Response(JSON.stringify({ data, error }), { status: 200 });
}
