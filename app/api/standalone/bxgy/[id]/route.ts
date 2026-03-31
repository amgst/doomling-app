import { NextRequest, NextResponse } from "next/server";
import { verifyShop, COOKIE_NAME } from "@/lib/utils/standaloneSession";
import { firestoreSessionStorage } from "@/lib/firebase/sessionStore";
import { deleteBxgyRule, listBxgyRules } from "@/lib/shopify/bxgyRuleStore";
import { setShopBxgyRulesMetafield } from "@/lib/shopify/shopBxgyRulesMetafield";
import { syncBxgyDiscount } from "@/lib/shopify/bxgyDiscountSync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const cookie = req.cookies.get(COOKIE_NAME)?.value;
  const shop = cookie ? await verifyShop(cookie) : null;
  if (!shop) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const session = await firestoreSessionStorage.loadSession(`offline_${shop}`);
  if (!session?.accessToken) return NextResponse.json({ error: "No access token" }, { status: 403 });

  await deleteBxgyRule(shop, session.accessToken, params.id);

  const rules = await listBxgyRules(shop, session.accessToken);
  await setShopBxgyRulesMetafield(shop, session.accessToken, rules);
  await syncBxgyDiscount(shop, session.accessToken, rules);

  return NextResponse.json({ ok: true });
}
