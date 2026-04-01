import { NextRequest, NextResponse } from "next/server";
import { verifyShop, COOKIE_NAME } from "@/lib/utils/standaloneSession";
import { firestoreSessionStorage } from "@/lib/firebase/sessionStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getNextPageUrl(linkHeader: string | null) {
  if (!linkHeader) return null;

  const nextPart = linkHeader
    .split(",")
    .map((part) => part.trim())
    .find((part) => part.includes('rel="next"'));

  if (!nextPart) return null;

  const match = nextPart.match(/<([^>]+)>/);
  return match?.[1] ?? null;
}

export async function GET(req: NextRequest) {
  const cookie = req.cookies.get(COOKIE_NAME)?.value;
  const shop = cookie ? await verifyShop(cookie) : null;
  if (!shop) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sessionId = `offline_${shop}`;
  const session = await firestoreSessionStorage.loadSession(sessionId);
  if (!session?.accessToken) {
    return NextResponse.json({ error: "No access token" }, { status: 403 });
  }

  const headers = { "X-Shopify-Access-Token": session.accessToken };
  let nextUrl: string | null =
    `https://${shop}/admin/api/2024-01/products.json?limit=250&fields=id,title,handle,status,variants,image`;
  const products: any[] = [];

  while (nextUrl) {
    const res = await fetch(nextUrl, { headers, cache: "no-store" });

    if (!res.ok) {
      const body = await res.text();
      return NextResponse.json({ error: `Shopify ${res.status}: ${body}` }, { status: res.status });
    }

    const data = await res.json();
    products.push(...(data.products ?? []));
    nextUrl = getNextPageUrl(res.headers.get("link"));
  }

  return NextResponse.json({ products });
}
