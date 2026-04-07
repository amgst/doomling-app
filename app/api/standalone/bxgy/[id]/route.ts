import { NextRequest, NextResponse } from "next/server";
import { verifyShop, COOKIE_NAME } from "@/lib/utils/standaloneSession";
import { firestoreSessionStorage } from "@/lib/firebase/sessionStore";
import { deleteBxgyRule, listBxgyRules, upsertBxgyRule } from "@/lib/shopify/bxgyRuleStore";
import { setShopBxgyRulesMetafield } from "@/lib/shopify/shopBxgyRulesMetafield";
import { syncBxgyDiscount } from "@/lib/shopify/bxgyDiscountSync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const cookie = req.cookies.get(COOKIE_NAME)?.value;
    const shop = cookie ? await verifyShop(cookie) : null;
    if (!shop) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const session = await firestoreSessionStorage.loadSession(`offline_${shop}`);
    if (!session?.accessToken) return NextResponse.json({ error: "No access token" }, { status: 403 });

    const allRules = await listBxgyRules(shop, session.accessToken);
    const existing = allRules.find((rule) => rule.id === params.id);
    if (!existing) return NextResponse.json({ error: "Rule not found" }, { status: 404 });

    const body = await req.json();
    const updated = {
      ...existing,
      ...(body.name !== undefined && { name: String(body.name) }),
      ...(Array.isArray(body.buyProducts) && { buyProducts: body.buyProducts }),
      ...(body.giftProduct !== undefined && { giftProduct: body.giftProduct }),
      ...(body.buyQuantity !== undefined && { buyQuantity: Number(body.buyQuantity) }),
      ...(body.giftQuantity !== undefined && { giftQuantity: Number(body.giftQuantity) }),
      ...(typeof body.limitOneGiftPerOrder === "boolean" && { limitOneGiftPerOrder: body.limitOneGiftPerOrder }),
      ...(body.message !== undefined && { message: String(body.message) }),
      ...(typeof body.autoAdd === "boolean" && { autoAdd: body.autoAdd }),
      ...(body.priority !== undefined && { priority: Number(body.priority) }),
      ...(typeof body.enabled === "boolean" && { enabled: body.enabled }),
    };
    await upsertBxgyRule(shop, session.accessToken, updated);

    const rules = await listBxgyRules(shop, session.accessToken);
    const enabledRules = rules.filter((rule) => rule.enabled);
    await setShopBxgyRulesMetafield(shop, session.accessToken, enabledRules);

    let warning: string | null = null;
    try {
      const syncTimeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Discount sync timed out. Rule updated — try toggling the rule to retry sync.")), 8_000)
      );
      await Promise.race([syncBxgyDiscount(shop, session.accessToken, enabledRules), syncTimeout]);
    } catch (error) {
      console.error("[bxgy] PATCH sync failed", error);
      warning = error instanceof Error ? error.message : "Rule updated, but discount sync failed.";
    }

    return NextResponse.json({ ok: true, warning });
  } catch (error) {
    console.error("[bxgy] PATCH failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update BXGY rule" },
      { status: 500 },
    );
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const cookie = req.cookies.get(COOKIE_NAME)?.value;
    const shop = cookie ? await verifyShop(cookie) : null;
    if (!shop) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const session = await firestoreSessionStorage.loadSession(`offline_${shop}`);
    if (!session?.accessToken) return NextResponse.json({ error: "No access token" }, { status: 403 });

    await deleteBxgyRule(shop, session.accessToken, params.id);

    const rules = await listBxgyRules(shop, session.accessToken);
    const enabledRules = rules.filter((rule) => rule.enabled);
    await setShopBxgyRulesMetafield(shop, session.accessToken, enabledRules);

    let warning: string | null = null;
    try {
      const syncTimeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Discount sync timed out. Rule deleted — try saving another rule to retry sync.")), 8_000)
      );
      await Promise.race([syncBxgyDiscount(shop, session.accessToken, enabledRules), syncTimeout]);
    } catch (error) {
      console.error("[bxgy] DELETE sync failed", error);
      warning = error instanceof Error ? error.message : "Rule deleted, but discount sync failed.";
    }

    return NextResponse.json({ ok: true, warning });
  } catch (error) {
    console.error("[bxgy] DELETE failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete BXGY rule" },
      { status: 500 },
    );
  }
}
