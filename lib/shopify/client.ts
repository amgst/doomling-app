import { shopifyApi, LATEST_API_VERSION, LogSeverity, type Shopify } from "@shopify/shopify-api";
import { firestoreSessionStorage } from "@/lib/firebase/sessionStore";

let _shopify: Shopify | null = null;

/**
 * Returns the Shopify API client, initializing it on first call.
 * Lazy-initialized so env vars are read at request time, not at build time.
 */
export function getShopify(): Shopify {
  if (_shopify) return _shopify;

  _shopify = shopifyApi({
    apiKey: process.env.SHOPIFY_API_KEY!,
    apiSecretKey: process.env.SHOPIFY_API_SECRET!,
    scopes: [
      "read_orders",
      "write_orders",
      "read_products",
      "read_customers",
      "read_analytics",
    ],
    hostName: (process.env.HOST ?? "").replace(/^https?:\/\//, ""),
    apiVersion: LATEST_API_VERSION,
    isEmbeddedApp: true,
    sessionStorage: firestoreSessionStorage,
    logger: {
      level:
        process.env.NODE_ENV === "production"
          ? LogSeverity.Warning
          : LogSeverity.Debug,
    },
  });

  return _shopify;
}
