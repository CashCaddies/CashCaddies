import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(req: NextRequest) {
  console.log("PROXY RUNNING HIT:", req.nextUrl.pathname);

  return NextResponse.next();
}

export const config = {
  matcher: ["/:path*"],
};
