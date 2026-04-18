import { getServiceClient } from "@/lib/supabase/service";

export async function POST() {
  try {
    const supabase = getServiceClient();

    const { error } = await supabase.rpc("create_updates_table");

    if (error) {
      return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500 });
    }

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500 });
  }
}
