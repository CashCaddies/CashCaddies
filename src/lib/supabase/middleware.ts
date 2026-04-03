import { NextResponse, type NextRequest } from "next/server";

/**
 * TEMP STABILIZATION MODE:
 * SSR auth disabled to stabilize development.
 * Browser auth only.
 * Will re-enable server auth after beta stability.
 */
export async function updateSession(_request: NextRequest) {
  return NextResponse.next();
}
