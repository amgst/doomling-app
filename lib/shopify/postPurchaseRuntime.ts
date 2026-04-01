import { createHmac, randomUUID } from "crypto";
import { firestoreSessionStorage } from "@/lib/firebase/sessionStore";
import { trackPostPurchaseEvent, addPostPurchaseRevenue } from "@/lib/firebase/postPurchaseStatsStore";
import { getShopify } from "@/lib/shopify/client";
import { listPostPurchaseOffers, type PostPurchaseOffer } from "@/lib/shopify/postPurchaseOfferStore";

type CheckoutJwtPayload = {
  dest?: string;
  iss?: string;
  sub?: string;
  aud?: string;
};

type InitialPurchaseLineItem = {
  quantity?: number;
  product?: { id?: number; title?: string };
};

type InitialPurchase = {
  referenceId?: string;
  totalPriceSet?: {
    presentmentMoney?: { amount?: string };
    shopMoney?: { amount?: string };
  };
  lineItems?: InitialPurchaseLineItem[];
};

function getBearerToken(header: string | null) {
  const value = String(header ?? "");
  const match = value.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

function getShopFromPayload(payload: CheckoutJwtPayload, fallbackShopDomain?: string) {
  const dest = String(payload.dest ?? "");
  if (dest) {
    const hostname = dest.startsWith("http://") || dest.startsWith("https://")
      ? new URL(dest).hostname
      : dest;
    return getShopify().utils.sanitizeShop(hostname, true)!;
  }

  const fallback = String(fallbackShopDomain ?? "");
  if (fallback) {
    return getShopify().utils.sanitizeShop(fallback, true)!;
  }

  throw new Error("Missing destination shop in checkout token");
}

function parseAmount(value: unknown) {
  const parsed = Number.parseFloat(String(value ?? 0));
  return Number.isFinite(parsed) ? parsed : 0;
}

function base64Url(input: string | Buffer) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function signHs256(payload: Record<string, unknown>) {
  const apiKey = process.env.SHOPIFY_API_KEY ?? "";
  const apiSecret = process.env.SHOPIFY_API_SECRET ?? "";
  if (!apiKey || !apiSecret) {
    throw new Error("Missing Shopify API credentials for post-purchase signing");
  }

  const fullPayload = {
    iss: apiKey,
    jti: randomUUID(),
    iat: Date.now(),
    ...payload,
  };

  const header = { alg: "HS256", typ: "JWT" };
  const encodedHeader = base64Url(JSON.stringify(header));
  const encodedPayload = base64Url(JSON.stringify(fullPayload));
  const content = `${encodedHeader}.${encodedPayload}`;
  const signature = createHmac("sha256", apiSecret).update(content).digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

  return `${content}.${signature}`;
}

export async function verifyCheckoutRequest(authHeader: string | null, fallbackShopDomain?: string) {
  const token = getBearerToken(authHeader);
  if (!token) throw new Error("Missing checkout token");

  const payload = await getShopify().session.decodeSessionToken(token, { checkAudience: false }) as CheckoutJwtPayload;
  const shop = getShopFromPayload(payload, fallbackShopDomain);
  const session = await firestoreSessionStorage.loadSession(`offline_${shop}`);
  if (!session?.accessToken) throw new Error("No access token");

  return { shop, accessToken: session.accessToken, payload };
}

export function offerMatchesPurchase(offer: PostPurchaseOffer, initialPurchase: InitialPurchase | undefined) {
  if (!initialPurchase) return offer.triggerType === "all_orders";

  if (offer.triggerType === "all_orders") return true;

  if (offer.triggerType === "minimum_subtotal") {
    const total = parseAmount(
      initialPurchase.totalPriceSet?.presentmentMoney?.amount ??
      initialPurchase.totalPriceSet?.shopMoney?.amount,
    );
    return total >= Number(offer.minimumSubtotal || 0);
  }

  if (offer.triggerType === "contains_product") {
    const productIds = new Set(
      (initialPurchase.lineItems ?? [])
        .map((line) => String(line?.product?.id ?? ""))
        .filter(Boolean),
    );
    return offer.triggerProductIds.some((id) => productIds.has(String(id)));
  }

  return false;
}

export async function resolvePostPurchaseOffer(
  shop: string,
  accessToken: string,
  initialPurchase: InitialPurchase | undefined,
) {
  const offers = await listPostPurchaseOffers(shop, accessToken);
  return offers.find((offer) => offerMatchesPurchase(offer, initialPurchase)) ?? null;
}

export function buildRuntimeOffer(offer: PostPurchaseOffer) {
  const originalPrice = parseAmount(offer.offerProduct?.price);
  const discountedPrice = originalPrice * (1 - (offer.discountPercent || 0) / 100);
  const variantId = Number.parseInt(String(offer.offerProduct?.variantId ?? 0), 10);

  return {
    id: offer.id,
    productTitle: offer.offerProduct?.title ?? offer.name,
    productImageURL: offer.offerProduct?.image ?? "",
    productDescription: [offer.headline, offer.body].filter(Boolean),
    originalPrice: originalPrice.toFixed(2),
    discountedPrice: discountedPrice.toFixed(2),
    changes: [
      {
        type: "add_variant",
        variantId,
        quantity: 1,
        discount: {
          value: Number(offer.discountPercent || 0),
          valueType: "percentage",
          title: `${offer.discountPercent}% off`,
        },
      },
    ],
  };
}

export async function trackOfferView(shop: string, offerId: string) {
  await trackPostPurchaseEvent(shop, offerId, "viewed");
}

export async function buildSignedChangeset(shop: string, offer: PostPurchaseOffer, referenceId: string) {
  const runtimeOffer = buildRuntimeOffer(offer);
  await trackPostPurchaseEvent(shop, offer.id, "accepted");
  await addPostPurchaseRevenue(shop, offer.id, parseAmount(runtimeOffer.discountedPrice));

  return signHs256({
    sub: referenceId,
    changes: runtimeOffer.changes,
  });
}
