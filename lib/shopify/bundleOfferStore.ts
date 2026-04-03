import { getShop, updateShopSettings } from "@/lib/firebase/shopStore";

export type BundleOffer = {
  id: string;
  name: string;
  productId: string;
  productTitle: string;
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

function normalizeOffer(input: Partial<BundleOffer>, existing?: BundleOffer | null): BundleOffer {
  const now = new Date().toISOString();
  return {
    id: String(input.id || existing?.id || `bundle_${Date.now()}`),
    name: String(input.name || existing?.name || "").trim(),
    productId: String(input.productId || existing?.productId || "").trim(),
    productTitle: String(input.productTitle || existing?.productTitle || "").trim(),
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
    .filter((entry) => entry.name && entry.productId && entry.code && entry.compareAtPrice && entry.discountedPrice);
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
    throw new Error("Name, product, code, compare-at price, and discounted price are required.");
  }

  const filtered = offers.filter((entry) => entry.id !== next.id);
  if (filtered.some((entry) => entry.code.toUpperCase() === next.code.toUpperCase())) {
    throw new Error("Each bundle offer code must be unique.");
  }
  if (filtered.some((entry) => entry.productId === next.productId)) {
    throw new Error("This product already has a bundle offer configured.");
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
