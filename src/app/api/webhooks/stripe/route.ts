import { NextResponse } from "next/server";
import { applyStripeBillingEvent } from "@/lib/stripe-subscription-sync";
import { constructStripeWebhookEvent } from "@/lib/webhooks";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature");

  let event;
  try {
    event = constructStripeWebhookEvent(rawBody, signature);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "invalid webhook";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  try {
    await applyStripeBillingEvent(event);
  } catch (e) {
    console.error("[stripe] webhook handler", e);
    return NextResponse.json({ received: false }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
