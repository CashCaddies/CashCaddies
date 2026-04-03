import Stripe from "stripe";

let stripeClient: Stripe | null = null;

/** Server-only Stripe SDK (requires STRIPE_SECRET_KEY). */
export function getStripe(): Stripe {
  if (!stripeClient) {
    const key = process.env.STRIPE_SECRET_KEY?.trim();
    if (!key) {
      throw new Error("STRIPE_SECRET_KEY is not configured");
    }
    stripeClient = new Stripe(key);
  }
  return stripeClient;
}

/** Recurring price id for "CashCaddies Premium" (e.g. price_...). */
export function getPremiumPriceId(): string | null {
  const id = process.env.STRIPE_PREMIUM_PRICE_ID?.trim();
  return id || null;
}

/** Public label for marketing (e.g. $9.99/month). */
export function getPremiumPriceDisplayLabel(): string {
  return process.env.NEXT_PUBLIC_PREMIUM_PRICE_LABEL?.trim() || "$9.99/month";
}

/** Absolute site URL for Stripe redirects (no trailing slash). */
export function getAppBaseUrl(): string | null {
  const u = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  if (u) {
    return u;
  }
  const v = process.env.VERCEL_URL?.trim();
  if (v) {
    return `https://${v.replace(/\/$/, "")}`;
  }
  return null;
}
