import { NextRequest, NextResponse } from "next/server";
import { verifyShop, COOKIE_NAME } from "@/lib/utils/standaloneSession";
import { firestoreSessionStorage } from "@/lib/firebase/sessionStore";
import { listUpsellRules } from "@/lib/shopify/upsellRuleStore";
import { getRuleStats } from "@/lib/firebase/statsStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const cookie = req.cookies.get(COOKIE_NAME)?.value;
  const shop = cookie ? await verifyShop(cookie) : null;
  if (!shop) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const session = await firestoreSessionStorage.loadSession(`offline_${shop}`);
  if (!session?.accessToken) return NextResponse.json({ error: "No access token" }, { status: 403 });

  const rules = await listUpsellRules(shop, session.accessToken);
  const ruleIds = rules.map((r) => r.id);
  const ruleStats = await getRuleStats(shop, ruleIds);

  const merged = ruleStats.map((s) => {
    const rule = rules.find((r) => r.id === s.ruleId);
    const upsellProductTitle = rule?.upsellProducts?.map(p => p.title).join(", ") ?? "";
    return { ...s, triggerProductTitle: rule?.triggerProductTitle ?? "", upsellProductTitle };
  });

  return NextResponse.json({ rules: merged });
}
