import { getShop, updateShopSettings } from "@/lib/firebase/shopStore";

export type BundleOfferItem = {
  productId: string;
  productTitle: string;
  variantId?: string;
  variantTitle?: string;
  quantity: number;
  image?: string;
};

export type BundleOffer = {
  id: string;
  name: string;
  offerType: "bundle" | "product";
  productId: string;
  productTitle: string;
  storefrontTitle: string;
  bundleLevel: "product" | "variant";
  items: BundleOfferItem[];
  code: string;
  compareAtPrice: string;
  discountedPrice: string;
  enabled: boolean;
  discountId?: string;
  createdAt: string;
  updatedAt: string;
};

function normalizeMoneyString(value: unknown) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return "";
  return amount.toFixed(2);
}

function normalizeCode(value: unknown) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, "")
    .slice(0, 255);
}

function normalizePositiveInt(value: unknown, fallback = 1) {
  const parsed = Number.parseInt(String(value ?? fallback), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeBundleLevel(value: unknown): "product" | "variant" {
  return String(value ?? "").trim().toLowerCase() === "variant" ? "variant" : "product";
}

function normalizeOfferType(value: unknown): "bundle" | "product" {
  return String(value ?? "").trim().toLowerCase() === "product" ? "product" : "bundle";
}

function normalizeItem(input: Partial<BundleOfferItem>): BundleOfferItem | null {
  const productId = String(input.productId || "").trim();
  const productTitle = String(input.productTitle || "").trim();
  if (!productId || !productTitle) return null;

  const quantity = normalizePositiveInt(input.quantity, 1);
  const variantId = String(input.variantId || "").trim() || undefined;
  const variantTitle = String(input.variantTitle || "").trim() || undefined;
  const image = String(input.image || "").trim() || undefined;

  return {
    productId,
    productTitle,
    variantId,
    variantTitle,
    quantity,
    image,
  };
}

function normalizeItems(raw: unknown, existing?: BundleOfferItem[]): BundleOfferItem[] {
  const source = Array.isArray(raw) ? raw : existing ?? [];
  const seen = new Set<string>();

  return source
    .map((entry) => normalizeItem((entry ?? {}) as Partial<BundleOfferItem>))
    .filter((entry): entry is BundleOfferItem => Boolean(entry))
    .filter((entry) => {
      const key = `${entry.productId}::${entry.variantId ?? "product"}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function normalizeOffer(input: Partial<BundleOffer>, existing?: BundleOffer | null): BundleOffer {
  const now = new Date().toISOString();
  return {
    id: String(input.id || existing?.id || `bundle_${Date.now()}`),
    name: String(input.name || existing?.name || "").trim(),
    offerType: normalizeOfferType(input.offerType ?? existing?.offerType),
    productId: String(input.productId || existing?.productId || "").trim(),
    productTitle: String(input.productTitle || existing?.productTitle || "").trim(),
    storefrontTitle: String(input.storefrontTitle || existing?.storefrontTitle || "").trim(),
    bundleLevel: normalizeBundleLevel(input.bundleLevel ?? existing?.bundleLevel),
    items: normalizeItems(input.items, existing?.items),
    code: normalizeCode(input.code || existing?.code || ""),
    compareAtPrice: normalizeMoneyString(input.compareAtPrice ?? existing?.compareAtPrice),
    discountedPrice: normalizeMoneyString(input.discountedPrice ?? existing?.discountedPrice),
    enabled: input.enabled !== undefined ? input.enabled !== false : existing?.enabled !== false,
    discountId: String(input.discountId || existing?.discountId || "").trim() || undefined,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };
}

function getOffersFromSettings(settings: Record<string, unknown> | undefined): BundleOffer[] {
  const raw = settings?.bundleOffers;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry) => normalizeOffer((entry ?? {}) as Partial<BundleOffer>))
    .filter(
      (entry) =>
        entry.name &&
        entry.productId &&
        entry.code &&
        entry.compareAtPrice &&
        entry.discountedPrice &&
        (entry.offerType === "product" || entry.items.length > 0),
    );
}

export async function listBundleOffers(shop: string) {
  const store = await getShop(shop);
  return getOffersFromSettings(store?.settings);
}

export async function upsertBundleOffer(shop: string, input: Partial<BundleOffer>) {
  const store = await getShop(shop);
  const offers = getOffersFromSettings(store?.settings);
  const existing = offers.find((entry) => entry.id === input.id) ?? null;
  const next = normalizeOffer(input, existing);

  if (!next.name || !next.productId || !next.code || !next.compareAtPrice || !next.discountedPrice) {
    throw new Error("Name, storefront product, code, compare-at price, and discounted price are required.");
  }
  if (!next.storefrontTitle) {
    throw new Error("Enter the storefront title for the discounted storefront product.");
  }
  if (next.offerType === "bundle" && next.items.length === 0) {
    throw new Error("Add at least one product to the bundle.");
  }

  const filtered = offers.filter((entry) => entry.id !== next.id);
  if (filtered.some((entry) => entry.code.toUpperCase() === next.code.toUpperCase())) {
    throw new Error("Each discount offer code must be unique.");
  }
  if (filtered.some((entry) => entry.productId === next.productId)) {
    throw new Error("This product already has a discount offer configured.");
  }

  const updated = [...filtered, next].sort((a, b) => a.name.localeCompare(b.name));
  await updateShopSettings(shop, {
    ...(store?.settings ?? {}),
    bundleOffers: updated,
  });
  return next;
}

export async function saveBundleOffer(shop: string, offer: BundleOffer) {
  return upsertBundleOffer(shop, offer);
}

export async function deleteBundleOffer(shop: string, offerId: string) {
  const store = await getShop(shop);
  const offers = getOffersFromSettings(store?.settings);
  const target = offers.find((entry) => entry.id === offerId) ?? null;
  if (!target) return null;

  const updated = offers.filter((entry) => entry.id !== offerId);
  await updateShopSettings(shop, {
    ...(store?.settings ?? {}),
    bundleOffers: updated,
  });
  return target;
}
