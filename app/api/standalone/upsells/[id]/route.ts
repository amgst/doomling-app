import { NextRequest, NextResponse } from "next/server";
import { verifyShop, COOKIE_NAME } from "@/lib/utils/standaloneSession";
import { firestoreSessionStorage } from "@/lib/firebase/sessionStore";
import { deleteUpsellRule, getUpsellRule, listUpsellRules, upsertUpsellRule } from "@/lib/shopify/upsellRuleStore";
import { setShopUpsellRulesMetafield } from "@/lib/shopify/shopUpsellRulesMetafield";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getShopAndToken(req: NextRequest) {
  const cookie = req.cookies.get(COOKIE_NAME)?.value;
  const shop = cookie ? await verifyShop(cookie) : null;
  if (!shop) return { shop: null, accessToken: null, error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const session = await firestoreSessionStorage.loadSession(`offline_${shop}`);
  if (!session?.accessToken) return { shop, accessToken: null, error: NextResponse.json({ error: "No access token" }, { status: 403 }) };
  return { shop, accessToken: session.accessToken, error: null };
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { shop, accessToken, error } = await getShopAndToken(req);
  if (error || !shop || !accessToken) return error!;

  const current = await getUpsellRule(shop, accessToken, params.id, { includeDisabled: true });
  if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const nextRule = {
    ...current,
    ...body,
    id: params.id,
    triggerProductId: body.triggerProductId ?? current.triggerProductId,
    triggerProductTitle: body.triggerProductTitle ?? current.triggerProductTitle,
    upsellProducts: Array.isArray(body.upsellProducts) ? body.upsellProducts : current.upsellProducts,
    message: body.message ?? current.message,
    enabled: typeof body.enabled === "boolean" ? body.enabled : current.enabled !== false,
  };

  await upsertUpsellRule(shop, accessToken, nextRule);

  try {
    const rules = await listUpsellRules(shop, accessToken);
    await setShopUpsellRulesMetafield(shop, accessToken, rules);
  } catch {
    // ignore
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const { shop, accessToken, error } = await getShopAndToken(req);
  if (error || !shop || !accessToken) return error!;

  await deleteUpsellRule(shop, accessToken, params.id);

  // Compile to shop metafield for storefront reads
  try {
    const rules = await listUpsellRules(shop, accessToken);
    await setShopUpsellRulesMetafield(shop, accessToken, rules);
  } catch {
    // ignore
  }
  return NextResponse.json({ ok: true });
}
