import { NextResponse } from "next/server";
import { run } from "@/lib/updates/seed-founder-update";

export async function GET() {
  try {
    await run();
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
