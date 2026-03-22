import { Session, DeliveryMethod } from "@shopify/shopify-api";
import { shopify } from "./client";

/**
 * Register all webhooks for a newly installed shop.
 * Called once from the OAuth callback after the session is saved.
 */
export async function registerWebhooks(session: Session): Promise<void> {
  const webhookUrl = `${process.env.HOST}/api/webhooks`;

  const topics = [
    "orders/create",
    "orders/updated",
    "orders/cancelled",
    "app/uninstalled",
    // GDPR — mandatory for Shopify app listing approval
    "customers/data_request",
    "customers/redact",
    "shop/redact",
  ];

  for (const topic of topics) {
    try {
      await shopify.webhooks.addHandlers({
        [topic]: [
          {
            deliveryMethod: DeliveryMethod.Http,
            callbackUrl: webhookUrl,
          },
        ],
      });
    } catch (err) {
      console.warn(`[webhooks] Failed to register ${topic}:`, err);
    }
  }

  const response = await shopify.webhooks.register({ session });
  console.log("[webhooks] Registration result:", JSON.stringify(response, null, 2));
}
