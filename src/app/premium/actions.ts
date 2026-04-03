"use server";

import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { getAppBaseUrl, getPremiumPriceId, getStripe } from "@/lib/stripe";

export type PremiumCheckoutResult = { ok: true; url: string } | { ok: false; error: string };

/**
 * Creates a Stripe Checkout Session for CashCaddies Premium (monthly).
 * Caller redirects the browser to the returned URL.
 */
export async function createPremiumCheckoutSession(): Promise<PremiumCheckoutResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    return { ok: false, error: "You need to be signed in to subscribe." };
  }

  const priceId = getPremiumPriceId();
  if (!priceId) {
    return { ok: false, error: "Premium billing is not configured yet." };
  }

  const base = getAppBaseUrl();
  if (!base) {
    return { ok: false, error: "Site URL is not configured (NEXT_PUBLIC_SITE_URL)." };
  }

  const admin = createServiceRoleClient();
  if (!admin) {
    return { ok: false, error: "Server configuration error." };
  }

  try {
    const stripe = getStripe();

    const { data: profile } = await admin
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", user.id)
      .maybeSingle();

    let customerId =
      typeof (profile as { stripe_customer_id?: string } | null)?.stripe_customer_id === "string"
        ? (profile as { stripe_customer_id: string }).stripe_customer_id.trim()
        : null;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email ?? undefined,
        metadata: { supabase_user_id: user.id },
      });
      customerId = customer.id;
      await admin
        .from("profiles")
        .update({ stripe_customer_id: customerId, updated_at: new Date().toISOString() })
        .eq("id", user.id);
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${base}/premium?checkout=success`,
      cancel_url: `${base}/premium?checkout=canceled`,
      metadata: { supabase_user_id: user.id },
      subscription_data: {
        metadata: { supabase_user_id: user.id },
      },
      allow_promotion_codes: true,
    });

    if (!session.url) {
      return { ok: false, error: "Could not start checkout." };
    }

    return { ok: true, url: session.url };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Checkout failed.";
    return { ok: false, error: msg };
  }
}
