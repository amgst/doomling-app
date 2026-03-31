import { NextRequest, NextResponse } from "next/server";
import { verifyShop, COOKIE_NAME } from "@/lib/utils/standaloneSession";
import { firestoreSessionStorage } from "@/lib/firebase/sessionStore";
import { deleteUpsellRule, listUpsellRules } from "@/lib/shopify/upsellRuleStore";
import { setShopUpsellRulesMetafield } from "@/lib/shopify/shopUpsellRulesMetafield";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const cookie = req.cookies.get(COOKIE_NAME)?.value;
  const shop = cookie ? await verifyShop(cookie) : null;
  if (!shop) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const session = await firestoreSessionStorage.loadSession(`offline_${shop}`);
  if (!session?.accessToken) return NextResponse.json({ error: "No access token" }, { status: 403 });

  await deleteUpsellRule(shop, session.accessToken, params.id);

  // Compile to shop metafield for storefront reads
  try {
    const rules = await listUpsellRules(shop, session.accessToken);
    await setShopUpsellRulesMetafield(shop, session.accessToken, rules);
  } catch {
    // ignore
  }
  return NextResponse.json({ ok: true });
}
