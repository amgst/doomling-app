import { createHmac } from "crypto";

const SECRET = process.env.SESSION_SECRET ?? "dev-secret-change-in-production";
export const COOKIE_NAME = "upsale_shop";

export function signShop(shop: string): string {
  const sig = createHmac("sha256", SECRET).update(shop).digest("hex");
  return `${shop}|${sig}`;
}

export function verifyShop(value: string): string | null {
  const idx = value.lastIndexOf("|");
  if (idx === -1) return null;
  const shop = value.slice(0, idx);
  const sig = value.slice(idx + 1);
  const expected = createHmac("sha256", SECRET).update(shop).digest("hex");
  return sig === expected ? shop : null;
}
