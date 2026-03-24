import { NextRequest, NextResponse } from "next/server";
import { verifyShop, COOKIE_NAME } from "@/lib/utils/standaloneSession";
import { firestoreSessionStorage } from "@/lib/firebase/sessionStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const cookie = req.cookies.get(COOKIE_NAME)?.value;
  const shop = cookie ? await verifyShop(cookie) : null;
  if (!shop) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sessionId = `offline_${shop}`;
  const session = await firestoreSessionStorage.loadSession(sessionId);
  if (!session?.accessToken) {
    return NextResponse.json({ error: "No access token" }, { status: 403 });
  }

  const res = await fetch(
    `https://${shop}/admin/api/2024-01/products.json?limit=50&fields=id,title,handle,status,variants,image`,
    { headers: { "X-Shopify-Access-Token": session.accessToken } }
  );

  if (!res.ok) {
    const body = await res.text();
    return NextResponse.json({ error: `Shopify ${res.status}: ${body}` }, { status: res.status });
  }

  const data = await res.json();
  return NextResponse.json({ products: data.products });
}
