import { NextRequest, NextResponse } from "next/server";
import { getShopify } from "@/lib/shopify/client";
import { firestoreSessionStorage } from "@/lib/firebase/sessionStore";
import { Session } from "@shopify/shopify-api";

export async function verifyRequest(req: NextRequest): Promise<{
  session: Session | null;
  shop: string | null;
  errorResponse: NextResponse | null;
}> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return {
      session: null,
      shop: null,
      errorResponse: NextResponse.json({ error: "Missing authorization header" }, { status: 401 }),
    };
  }

  const sessionToken = authHeader.slice(7);
  const shopify = getShopify();

  try {
    const payload = await shopify.session.decodeSessionToken(sessionToken);
    const shop = (payload.dest as string).replace("https://", "");

    const offlineSessionId = shopify.session.getOfflineId(shop);
    const session = await firestoreSessionStorage.loadSession(offlineSessionId);

    if (!session) {
      return {
        session: null,
        shop,
        errorResponse: NextResponse.json(
          { error: "Shop not installed or session expired. Please reinstall the app." },
          { status: 403 }
        ),
      };
    }

    return { session, shop, errorResponse: null };
  } catch (err) {
    console.error("[verifyRequest] Token verification failed:", err);
    return {
      session: null,
      shop: null,
      errorResponse: NextResponse.json({ error: "Invalid session token" }, { status: 401 }),
    };
  }
}
