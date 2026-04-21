import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("updates")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.log("UPDATES DATA ERROR:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  console.log("UPDATES DATA:", data);

  return NextResponse.json({ data });
}