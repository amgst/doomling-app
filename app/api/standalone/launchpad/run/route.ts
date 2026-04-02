import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, verifyShop } from "@/lib/utils/standaloneSession";
import { processDueLaunchpadSchedules } from "@/lib/launchpadRunner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getAuthenticatedShop(req: NextRequest) {
  const cookie = req.cookies.get(COOKIE_NAME)?.value;
  return cookie ? await verifyShop(cookie) : null;
}

export async function POST(req: NextRequest) {
  try {
    const shop = await getAuthenticatedShop(req);
    if (!shop) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const result = await processDueLaunchpadSchedules({ shop });
    return NextResponse.json(result);
  } catch (error) {
    console.error("[standalone/launchpad/run] POST failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to run scheduled publishes" },
      { status: 500 },
    );
  }
}
