import { NextRequest, NextResponse } from "next/server";
import { shopify } from "@/lib/shopify/client";
import { incrementDailyOrder, decrementDailyOrder } from "@/lib/firebase/analyticsStore";
import { markUninstalled } from "@/lib/firebase/shopStore";

export const runtime = "nodejs";

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
  const isValid = await shopify.webhooks.validate({
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
        await incrementDailyOrder(shop, totalPrice, currency, createdAt);
        break;
      }

      case "orders/cancelled": {
        const totalPrice = parseFloat((body.total_price as string) ?? "0");
        const createdAt = (body.created_at as string)?.slice(0, 10);
        await decrementDailyOrder(shop, totalPrice, createdAt);
        break;
      }

      case "orders/updated":
        // No-op for now — could diff old vs new price and adjust aggregates
        break;

      case "app/uninstalled": {
        await markUninstalled(shop);
        const sessions = await shopify.config.sessionStorage!.findSessionsByShop(shop);
        const ids = sessions.map((s) => s.id);
        if (ids.length > 0) {
          await shopify.config.sessionStorage!.deleteSessions(ids);
        }
        break;
      }

      // GDPR webhooks — required for Shopify app store listing
      case "customers/data_request":
        // Respond with customer data you hold for this shop
        // For now: log and acknowledge (implement data export as needed)
        console.log(`[webhooks] GDPR data_request for shop ${shop}`, body);
        break;

      case "customers/redact":
        // Delete customer PII from your database
        console.log(`[webhooks] GDPR customers/redact for shop ${shop}`, body);
        break;

      case "shop/redact":
        // Delete all shop data (triggered 48h after uninstall)
        console.log(`[webhooks] GDPR shop/redact for shop ${shop}`, body);
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
