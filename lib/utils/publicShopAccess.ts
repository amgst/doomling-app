import { NextResponse } from "next/server";
import { getShop } from "@/lib/firebase/shopStore";

const SHOP_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/;

export function normalizePublicShop(rawShop: string | null | undefined): string | null {
  const shop = (rawShop ?? "").trim().toLowerCase();
  if (!shop || !SHOP_PATTERN.test(shop)) return null;
  return shop;
}

export async function ensureInstalledPublicShop(rawShop: string | null | undefined) {
  const shop = normalizePublicShop(rawShop);
  if (!shop) {
    return {
      shop: null,
      errorResponse: NextResponse.json({ error: "Invalid shop" }, { status: 400 }),
    };
  }

  const stored = await getShop(shop);
  if (!stored?.installedAt || stored.uninstalledAt) {
    return {
      shop: null,
      errorResponse: NextResponse.json({ error: "Unknown shop" }, { status: 404 }),
    };
  }

  return { shop, stored, errorResponse: null };
}
