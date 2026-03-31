import { NextRequest, NextResponse } from "next/server";
import { getGiftRules } from "@/lib/firebase/giftRuleStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RulesCacheEntry = {
  expiresAt: number;
  rules: unknown[];
};

const RULES_TTL_MS = 60_000;

function getRulesCache(): Map<string, RulesCacheEntry> {
  const g = globalThis as unknown as { __gwpRulesCacheV1?: Map<string, RulesCacheEntry> };
  if (!g.__gwpRulesCacheV1) g.__gwpRulesCacheV1 = new Map();
  return g.__gwpRulesCacheV1;
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

  const rules = await getGiftRules(shop);
  cache.set(shop, { expiresAt: now + RULES_TTL_MS, rules: rules as unknown[] });
  return withCors(NextResponse.json({ shop, rules }));
}

