import { NextResponse } from "next/server";
import { processDueLaunchpadSchedules } from "@/lib/launchpadRunner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized or CRON_SECRET is not configured" }, { status: 401 });
  }
  const result = await processDueLaunchpadSchedules();
  return NextResponse.json(result);
}
