import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, verifyShop } from "@/lib/utils/standaloneSession";
import { getShop as getStoredShop, updateShopSettings } from "@/lib/firebase/shopStore";
import {
  localDateTimeToUtcIso,
  normalizeLaunchpadSchedule,
  sortLaunchpadSchedules,
  SUPPORTED_TIMEZONES,
  type LaunchpadSchedule,
} from "@/lib/launchpad";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getAuthenticatedShop(req: NextRequest) {
  const cookie = req.cookies.get(COOKIE_NAME)?.value;
  return cookie ? await verifyShop(cookie) : null;
}

function getStoredSchedules(settings: Record<string, unknown> | undefined): LaunchpadSchedule[] {
  const raw = settings?.launchpadSchedules;
  if (!Array.isArray(raw)) return [];

  return sortLaunchpadSchedules(
    raw
      .map((schedule, index) => normalizeLaunchpadSchedule(schedule, index))
      .filter((schedule): schedule is LaunchpadSchedule => Boolean(schedule)),
  );
}

export async function GET(req: NextRequest) {
  try {
    const shop = await getAuthenticatedShop(req);
    if (!shop) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const stored = await getStoredShop(shop);
    return NextResponse.json({
      schedules: getStoredSchedules(stored?.settings),
      timezones: [...SUPPORTED_TIMEZONES],
    });
  } catch (error) {
    console.error("[standalone/launchpad] GET failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load launchpad schedules" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const shop = await getAuthenticatedShop(req);
    if (!shop) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const themeId = String(body?.themeId ?? "").trim();
    const themeName = String(body?.themeName ?? "").trim();
    const localDateTime = String(body?.localDateTime ?? "").trim();
    const timezone = String(body?.timezone ?? "UTC").trim();

    if (!themeId || !themeName) {
      return NextResponse.json({ error: "Theme id and theme name are required" }, { status: 400 });
    }

    const scheduledForUtc = localDateTimeToUtcIso(localDateTime, timezone);
    if (!scheduledForUtc) {
      return NextResponse.json({ error: "Use a valid local date/time and supported timezone" }, { status: 400 });
    }

    const stored = await getStoredShop(shop);
    const currentSchedules = getStoredSchedules(stored?.settings);
    const nextSchedule: LaunchpadSchedule = {
      id: `launchpad-${Date.now()}`,
      themeId,
      themeName,
      scheduledForUtc,
      timezone,
      status: "pending",
      createdAt: new Date().toISOString(),
    };

    const schedules = sortLaunchpadSchedules([nextSchedule, ...currentSchedules]);
    await updateShopSettings(shop, {
      ...(stored?.settings ?? {}),
      launchpadSchedules: schedules,
    });

    return NextResponse.json({ ok: true, schedules, timezones: [...SUPPORTED_TIMEZONES] });
  } catch (error) {
    console.error("[standalone/launchpad] POST failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create launchpad schedule" },
      { status: 500 },
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const shop = await getAuthenticatedShop(req);
    if (!shop) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const id = String(body?.id ?? "").trim();
    const action = String(body?.action ?? "").trim();
    if (!id || !["cancel", "retry"].includes(action)) {
      return NextResponse.json({ error: "Valid schedule id and action are required" }, { status: 400 });
    }

    const stored = await getStoredShop(shop);
    const currentSchedules = getStoredSchedules(stored?.settings);
    const schedules = currentSchedules.map((schedule) => {
      if (schedule.id !== id) return schedule;
      if (action === "cancel") {
        return { ...schedule, status: "cancelled" as const, cancelledAt: new Date().toISOString(), lastError: undefined };
      }
      return { ...schedule, status: "pending" as const, cancelledAt: undefined, lastError: undefined };
    });

    await updateShopSettings(shop, {
      ...(stored?.settings ?? {}),
      launchpadSchedules: schedules,
    });

    return NextResponse.json({ ok: true, schedules: sortLaunchpadSchedules(schedules), timezones: [...SUPPORTED_TIMEZONES] });
  } catch (error) {
    console.error("[standalone/launchpad] PUT failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update launchpad schedule" },
      { status: 500 },
    );
  }
}
