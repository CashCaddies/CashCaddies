import type { SupabaseClient } from "@supabase/supabase-js";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { createServiceRoleClient } from "@/lib/supabase/admin";

function customerIdFromSubscription(sub: Stripe.Subscription): string | null {
  const c = sub.customer;
  if (typeof c === "string") {
    return c;
  }
  if (c && typeof c === "object" && "id" in c && typeof c.id === "string") {
    return c.id;
  }
  return null;
}

function subscriptionGrantsPremium(sub: Stripe.Subscription): boolean {
  return sub.status === "active" || sub.status === "trialing";
}

/**
 * Upsert `profiles` premium + Stripe ids from a Subscription object.
 * Resolves user id from explicitUserId, subscription metadata, stripe_subscription_id, or stripe_customer_id.
 */
export async function syncProfilePremiumFromSubscription(
  admin: SupabaseClient,
  sub: Stripe.Subscription,
  explicitUserId?: string | null,
): Promise<void> {
  const customerId = customerIdFromSubscription(sub);
  if (!customerId) {
    return;
  }

  const periodEndIso = new Date(sub.current_period_end * 1000).toISOString();
  const premium = subscriptionGrantsPremium(sub);

  let userId =
    (explicitUserId && explicitUserId.trim()) ||
    (typeof sub.metadata?.supabase_user_id === "string" ? sub.metadata.supabase_user_id.trim() : "") ||
    null;

  if (!userId) {
    const bySub = await admin.from("profiles").select("id").eq("stripe_subscription_id", sub.id).maybeSingle();
    if (!bySub.error && bySub.data?.id) {
      userId = String(bySub.data.id);
    }
  }
  if (!userId) {
    const byCust = await admin.from("profiles").select("id").eq("stripe_customer_id", customerId).maybeSingle();
    if (!byCust.error && byCust.data?.id) {
      userId = String(byCust.data.id);
    }
  }
  if (!userId) {
    console.warn("[stripe] syncProfilePremiumFromSubscription: no profile for subscription", sub.id);
    return;
  }

  const nowIso = new Date().toISOString();

  if (sub.status === "canceled") {
    await admin
      .from("profiles")
      .update({
        stripe_customer_id: customerId,
        stripe_subscription_id: null,
        is_premium: false,
        premium_expires_at: periodEndIso,
        updated_at: nowIso,
      })
      .eq("id", userId);
    return;
  }

  await admin
    .from("profiles")
    .update({
      stripe_customer_id: customerId,
      stripe_subscription_id: sub.id,
      is_premium: premium,
      premium_expires_at: periodEndIso,
      updated_at: nowIso,
    })
    .eq("id", userId);
}

/** Clear premium when Stripe sends customer.subscription.deleted. */
export async function clearProfilePremiumForEndedSubscription(
  admin: SupabaseClient,
  sub: Stripe.Subscription,
): Promise<void> {
  const customerId = customerIdFromSubscription(sub);
  const periodEndIso = new Date(sub.current_period_end * 1000).toISOString();
  const nowIso = new Date().toISOString();

  const { error } = await admin
    .from("profiles")
    .update({
      stripe_subscription_id: null,
      is_premium: false,
      premium_expires_at: periodEndIso,
      updated_at: nowIso,
      ...(customerId ? { stripe_customer_id: customerId } : {}),
    })
    .eq("stripe_subscription_id", sub.id);

  if (error) {
    console.error("[stripe] clearProfilePremiumForEndedSubscription", error.message);
  }
}

export async function applyStripeBillingEvent(event: Stripe.Event): Promise<void> {
  const admin = createServiceRoleClient();
  if (!admin) {
    throw new Error("Service role client is not configured");
  }
  const stripe = getStripe();

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode !== "subscription") {
        return;
      }
      const subRef = session.subscription;
      const subId = typeof subRef === "string" ? subRef : subRef?.id;
      if (!subId) {
        return;
      }
      const userId = session.metadata?.supabase_user_id?.trim() || null;
      if (!userId) {
        console.warn("[stripe] checkout.session.completed missing metadata.supabase_user_id");
        return;
      }
      const sub = await stripe.subscriptions.retrieve(subId);
      await syncProfilePremiumFromSubscription(admin, sub, userId);
      break;
    }
    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      await syncProfilePremiumFromSubscription(admin, sub);
      break;
    }
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      await clearProfilePremiumForEndedSubscription(admin, sub);
      break;
    }
    default:
      break;
  }
}
