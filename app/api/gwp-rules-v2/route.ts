import { NextRequest, NextResponse } from "next/server";
import { firestoreSessionStorage } from "@/lib/firebase/sessionStore";
import { shopifyAdminGraphql } from "@/lib/shopify/adminGraphql";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RulesCacheEntry = {
  expiresAt: number;
  rules: unknown[];
};

const RULES_TTL_MS = 60_000;

function getRulesCache(): Map<string, RulesCacheEntry> {
  const g = globalThis as unknown as { __gwpRulesCacheV2?: Map<string, RulesCacheEntry> };
  if (!g.__gwpRulesCacheV2) g.__gwpRulesCacheV2 = new Map();
  return g.__gwpRulesCacheV2;
}

function withCors(res: NextResponse) {
  res.headers.set("Access-Control-Allow-Origin", "*");
  res.headers.set("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.headers.set("Access-Control-Allow-Headers", "Content-Type");
  res.headers.set("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
  return res;
}

function isValidShop(shop: string) {
  return /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i.test(shop);
}

export async function OPTIONS() {
  return withCors(new NextResponse(null, { status: 204 }));
}

export async function GET(req: NextRequest) {
  const shop = (req.nextUrl.searchParams.get("shop") ?? "").trim().toLowerCase();
  if (!isValidShop(shop)) {
    return withCors(NextResponse.json({ error: "Invalid shop" }, { status: 400 }));
  }

  const cache = getRulesCache();
  const now = Date.now();
  const cached = cache.get(shop);
  if (cached && cached.expiresAt > now) {
    return withCors(NextResponse.json({ shop, rules: cached.rules }));
  }

  const session = await firestoreSessionStorage.loadSession(`offline_${shop}`);
  const accessToken = session?.accessToken;
  if (!accessToken) {
    cache.set(shop, { expiresAt: now + RULES_TTL_MS, rules: [] });
    return withCors(NextResponse.json({ shop, rules: [] }));
  }

  const data = await shopifyAdminGraphql(
    shop,
    accessToken,
    `
      query GiftRulesMeta {
        shop {
          giftRules: metafield(namespace: "gwp", key: "gift_rules") { value }
        }
      }
    `,
  );

  const raw = data?.data?.shop?.giftRules?.value as string | undefined;
  let rules: unknown[] = [];
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      rules = Array.isArray(parsed?.rules) ? parsed.rules : [];
    } catch {
      rules = [];
    }
  }

  cache.set(shop, { expiresAt: now + RULES_TTL_MS, rules });
  return withCors(NextResponse.json({ shop, rules }));
}

