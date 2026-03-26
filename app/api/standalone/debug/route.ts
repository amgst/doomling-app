import { NextRequest, NextResponse } from "next/server";
import { verifyShop, COOKIE_NAME } from "@/lib/utils/standaloneSession";
import { firestoreSessionStorage } from "@/lib/firebase/sessionStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const cookie = req.cookies.get(COOKIE_NAME)?.value;
  const shop = cookie ? await verifyShop(cookie) : null;
  if (!shop) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const session = await firestoreSessionStorage.loadSession(`offline_${shop}`);
  if (!session?.accessToken) {
    return NextResponse.json({ error: "No access token in session" });
  }

  // Query 1: get app info from this token
  const appInfoRes = await fetch(`https://${shop}/admin/api/2024-01/graphql.json`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": session.accessToken },
    body: JSON.stringify({ query: `{ shop { name id } currentAppInstallation { id app { id title } } }` }),
  });
  const appInfo = await appInfoRes.json();

  // Query 2: list shopify functions
  const fnRes = await fetch(`https://${shop}/admin/api/2024-01/graphql.json`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": session.accessToken },
    body: JSON.stringify({ query: `{ shopifyFunctions(first: 25) { nodes { id apiType handle } } }` }),
  });
  const fnData = await fnRes.json();

  return NextResponse.json({
    shop,
    hasToken: true,
    appInfo: appInfo?.data,
    appInfoErrors: appInfo?.errors,
    functions: fnData?.data?.shopifyFunctions?.nodes ?? [],
    functionsErrors: fnData?.errors,
  });
}
