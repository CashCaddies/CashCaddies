import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";

/**
 * Verifies Stripe webhook signatures (Stripe-Signature header + raw body).
 * Use the raw request body string; do not parse JSON first.
 */
export function constructStripeWebhookEvent(rawBody: string | Buffer, signature: string | null): Stripe.Event {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!secret) {
    throw new Error("STRIPE_WEBHOOK_SECRET is not configured");
  }
  if (!signature) {
    throw new Error("Missing Stripe-Signature header");
  }
  return getStripe().webhooks.constructEvent(rawBody, signature, secret);
}
