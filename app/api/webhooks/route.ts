import { NextRequest, NextResponse } from "next/server";
import { getShopify } from "@/lib/shopify/client";
import { incrementDailyOrder, decrementDailyOrder } from "@/lib/firebase/analyticsStore";
import { trackRevenueAttribution } from "@/lib/firebase/statsStore";
import { markUninstalled, deleteShopAllData } from "@/lib/firebase/shopStore";
import { firestoreSessionStorage } from "@/lib/firebase/sessionStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type WebhookLineItem = {
  price: string;
  quantity: number;
  properties?: Array<{ name: string; value: string }>;
};

function accumulateUpsellRuleAttribution(lineItems: WebhookLineItem[]) {
  const byRule = new Map<string, { revenue: number; units: number }>();

  for (const item of lineItems) {
    const properties = Array.isArray(item.properties) ? item.properties : [];
    const isUpsale = properties.some((p) => p.name === "_upsale" && p.value === "true");
    const ruleId = properties.find((p) => p.name === "_upsale_rule_id")?.value?.trim();
    if (!isUpsale || !ruleId) continue;

    const price = parseFloat(item.price || "0");
    const quantity = Number(item.quantity) || 0;
    const revenue = Number.isFinite(price) && quantity > 0 ? price * quantity : 0;
    const existing = byRule.get(ruleId) ?? { revenue: 0, units: 0 };
    existing.revenue += revenue;
    existing.units += quantity;
    byRule.set(ruleId, existing);
  }

  return byRule;
}

/**
 * POST /api/webhooks
 * Single endpoint for all Shopify webhook topics.
 * HMAC is verified before any processing.
 */
export async function POST(req: NextRequest) {
  const topic = req.headers.get("x-shopify-topic") ?? "";
  const shop = req.headers.get("x-shopify-shop-domain") ?? "";

  const rawBody = await req.text();

  // Verify HMAC signature
  const isValid = await getShopify().webhooks.validate({
    rawBody,
    rawRequest: req,
    rawResponse: new Response(),
  });

  if (!isValid) {
    console.warn(`[webhooks] Invalid HMAC for topic ${topic} from ${shop}`);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  console.log(`[webhooks] ${topic} from ${shop}`);

  try {
    switch (topic) {
      case "orders/create": {
        const totalPrice = parseFloat((body.total_price as string) ?? "0");
        const currency = (body.currency as string) ?? "USD";
        const createdAt = (body.created_at as string)?.slice(0, 10);
        // Sum revenue from line items tagged with _upsale by our widgets
        const lineItems = (body.line_items as WebhookLineItem[]) ?? [];
        const upsaleRevenue = lineItems
          .filter(item => item.properties?.some(p => p.name === "_upsale" && p.value === "true"))
          .reduce((sum, item) => sum + parseFloat(item.price) * item.quantity, 0);
        await incrementDailyOrder(shop, totalPrice, currency, createdAt, upsaleRevenue);
        const attributedByRule = accumulateUpsellRuleAttribution(lineItems);
        await Promise.all(
          Array.from(attributedByRule.entries()).map(([ruleId, totals]) =>
            trackRevenueAttribution(shop, ruleId, totals.revenue, 1, totals.units),
          ),
        );
        break;
      }

      case "orders/cancelled": {
        const totalPrice = parseFloat((body.total_price as string) ?? "0");
        const createdAt = (body.created_at as string)?.slice(0, 10);
        await decrementDailyOrder(shop, totalPrice, createdAt);
        const lineItems = (body.line_items as WebhookLineItem[]) ?? [];
        const attributedByRule = accumulateUpsellRuleAttribution(lineItems);
        await Promise.all(
          Array.from(attributedByRule.entries()).map(([ruleId, totals]) =>
            trackRevenueAttribution(shop, ruleId, -totals.revenue, -1, -totals.units),
          ),
        );
        break;
      }

      case "orders/updated":
        // No-op for now — could diff old vs new price and adjust aggregates
        break;

      case "app/uninstalled": {
        await markUninstalled(shop);
        const sessions = await firestoreSessionStorage.findSessionsByShop(shop);
        const ids = sessions.map((s) => s.id);
        if (ids.length > 0) {
          await firestoreSessionStorage.deleteSessions(ids);
        }
        break;
      }

      // GDPR webhooks — required for Shopify app store listing
      case "customers/data_request":
        // Respond with customer data you hold for this shop
        // For now: acknowledge (implement data export as needed)
        console.log(`[webhooks] GDPR data_request for shop ${shop}`);
        break;

      case "customers/redact":
        // This app stores no customer PII — analytics are aggregated totals only.
        // No deletion required; acknowledge immediately.
        console.log(`[webhooks] GDPR customers/redact acknowledged for shop ${shop}`);
        break;

      case "shop/redact":
        // Delete all Firestore data for the shop (triggered 48h after uninstall).
        await deleteShopAllData(shop);
        console.log(`[webhooks] GDPR shop/redact: all data deleted for shop ${shop}`);
        break;

      default:
        console.log(`[webhooks] Unhandled topic: ${topic}`);
    }
  } catch (err) {
    console.error(`[webhooks] Handler error for ${topic}:`, err);
    // Return 200 so Shopify doesn't retry — log the error instead
  }

  return NextResponse.json({ ok: true });
}
