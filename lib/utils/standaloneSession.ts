const SECRET = process.env.SESSION_SECRET ?? "dev-secret-change-in-production";
export const COOKIE_NAME = "upsale_shop";

async function getKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

async function hmac(data: string): Promise<string> {
  const key = await getKey();
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function signShop(shop: string): Promise<string> {
  const sig = await hmac(shop);
  return `${shop}|${sig}`;
}

export async function verifyShop(value: string): Promise<string | null> {
  const idx = value.lastIndexOf("|");
  if (idx === -1) return null;
  const shop = value.slice(0, idx);
  const sig = value.slice(idx + 1);
  const expected = await hmac(shop);
  return sig === expected ? shop : null;
}
