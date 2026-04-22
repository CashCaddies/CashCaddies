import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

type UpdateApiRow = {
  id: string;
  title: string;
  content: string;
  created_at: string;
};

type RawUpdateRow = {
  id?: unknown;
  title?: unknown;
  content?: unknown;
  created_at?: unknown;
};

function normalizeUpdateRow(row: RawUpdateRow, index: number): UpdateApiRow {
  const rawId = row.id;
  const id = typeof rawId === "string" && rawId.trim().length > 0
    ? rawId
    : `legacy-${index}`;

  const rawTitle = row.title;
  const title = typeof rawTitle === "string" && rawTitle.trim().length > 0
    ? rawTitle
    : "Untitled update";

  const rawContent = row.content;
  const content = typeof rawContent === "string"
    ? rawContent
    : String(rawContent ?? "");

  const rawCreatedAt = row.created_at;
  const createdAt = typeof rawCreatedAt === "string" ? rawCreatedAt : "";

  return {
    id,
    title,
    content,
    created_at: createdAt,
  };
}

export async function GET() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("updates")
    .select("id,title,content,created_at")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const normalized = Array.isArray(data)
    ? data.map((row, index) => normalizeUpdateRow((row ?? {}) as RawUpdateRow, index))
    : [];

  return NextResponse.json({ data: normalized });
}
