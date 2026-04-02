import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, verifyShop } from "@/lib/utils/standaloneSession";
import { firestoreSessionStorage } from "@/lib/firebase/sessionStore";
import { listThemes, publishTheme } from "@/lib/shopify/themeSwitcher";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getAuthenticatedShop(req: NextRequest) {
  const cookie = req.cookies.get(COOKIE_NAME)?.value;
  return cookie ? await verifyShop(cookie) : null;
}

async function getAccessToken(shop: string) {
  const session = await firestoreSessionStorage.loadSession(`offline_${shop}`);
  return session?.accessToken ?? null;
}

export async function GET(req: NextRequest) {
  try {
    const shop = await getAuthenticatedShop(req);
    if (!shop) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const accessToken = await getAccessToken(shop);
    if (!accessToken) return NextResponse.json({ error: "No access token" }, { status: 403 });

    const themes = await listThemes(shop, accessToken);
    return NextResponse.json({ themes });
  } catch (error) {
    console.error("[standalone/themes] GET failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load themes" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const shop = await getAuthenticatedShop(req);
    if (!shop) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const accessToken = await getAccessToken(shop);
    if (!accessToken) return NextResponse.json({ error: "No access token" }, { status: 403 });

    const body = await req.json();
    const id = String(body?.id ?? "").trim();
    if (!id) return NextResponse.json({ error: "Theme id is required" }, { status: 400 });

    const theme = await publishTheme(shop, accessToken, id);
    const themes = await listThemes(shop, accessToken);
    return NextResponse.json({ ok: true, theme, themes });
  } catch (error) {
    console.error("[standalone/themes] POST failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to publish theme" },
      { status: 500 },
    );
  }
}
