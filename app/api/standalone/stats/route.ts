import { NextRequest, NextResponse } from "next/server";
import { verifyShop, COOKIE_NAME } from "@/lib/utils/standaloneSession";
import { listUpsells } from "@/lib/firebase/upsellStore";
import { getRuleStats, getGiftStats } from "@/lib/firebase/statsStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const cookie = req.cookies.get(COOKIE_NAME)?.value;
  const shop = cookie ? await verifyShop(cookie) : null;
  if (!shop) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rules = await listUpsells(shop);
  const ruleIds = rules.map((r) => r.id);
  const [ruleStats, giftStats] = await Promise.all([
    getRuleStats(shop, ruleIds),
    getGiftStats(shop),
  ]);

  // Merge rule info with stats
  const merged = ruleStats.map((s) => {
    const rule = rules.find((r) => r.id === s.ruleId);
    return { ...s, triggerProductTitle: rule?.triggerProductTitle ?? "", upsellProductTitle: rule?.upsellProductTitle ?? "" };
  });

  return NextResponse.json({ rules: merged, gift: giftStats });
}
