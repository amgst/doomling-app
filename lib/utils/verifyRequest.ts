import { NextRequest, NextResponse } from "next/server";
import { shopify } from "@/lib/shopify/client";
import { Session } from "@shopify/shopify-api";

/**
 * Verifies the session token in the Authorization header (App Bridge pattern).
 * Returns the offline session for the shop so API routes can make admin API calls.
 *
 * Usage in an API route:
 *   const { session, errorResponse } = await verifyRequest(req);
 *   if (errorResponse) return errorResponse;
 */
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

  try {
    const payload = await shopify.session.decodeSessionToken(sessionToken);
    const shop = (payload.dest as string).replace("https://", "");

    // Load the offline session for this shop (used for admin API calls)
    const offlineSessionId = shopify.session.getOfflineId(shop);
    const session = await shopify.config.sessionStorage!.loadSession(offlineSessionId);

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
