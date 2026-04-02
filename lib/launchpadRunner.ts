import { firestoreSessionStorage } from "@/lib/firebase/sessionStore";
import { getShop, listShops, updateShopSettings } from "@/lib/firebase/shopStore";
import { normalizeLaunchpadSchedule, sortLaunchpadSchedules, type LaunchpadSchedule } from "@/lib/launchpad";
import { publishTheme } from "@/lib/shopify/themeSwitcher";

function readSchedules(settings: Record<string, unknown> | undefined): LaunchpadSchedule[] {
  const raw = settings?.launchpadSchedules;
  if (!Array.isArray(raw)) return [];

  return raw
    .map((schedule, index) => normalizeLaunchpadSchedule(schedule, index))
    .filter((schedule): schedule is LaunchpadSchedule => Boolean(schedule));
}

export async function processDueLaunchpadSchedules(options?: { shop?: string }) {
  const now = Date.now();
  const shops = options?.shop
    ? [{ shop: options.shop, data: await getShop(options.shop) }]
    : await listShops();
  const processed: Array<{ shop: string; scheduleId: string; status: string }> = [];

  for (const entry of shops) {
    const shop = entry.shop;
    const stored = entry.data ?? (await getShop(shop));
    const schedules = readSchedules(stored?.settings);
    const dueSchedules = schedules.filter((schedule) => schedule.status === "pending" && Date.parse(schedule.scheduledForUtc) <= now);
    if (dueSchedules.length === 0) continue;

    const session = await firestoreSessionStorage.loadSession(`offline_${shop}`);
    const accessToken = session?.accessToken;
    const nextSchedules = [...schedules];

    if (!accessToken) {
      for (const schedule of dueSchedules) {
        const index = nextSchedules.findIndex((candidate) => candidate.id === schedule.id);
        if (index >= 0) {
          nextSchedules[index] = {
            ...schedule,
            status: "failed",
            lastError: "No offline access token available for this shop",
          };
          processed.push({ shop, scheduleId: schedule.id, status: "failed" });
        }
      }
      await updateShopSettings(shop, {
        ...(stored?.settings ?? {}),
        launchpadSchedules: sortLaunchpadSchedules(nextSchedules),
      });
      continue;
    }

    for (const schedule of dueSchedules) {
      const index = nextSchedules.findIndex((candidate) => candidate.id === schedule.id);
      if (index < 0) continue;

      try {
        await publishTheme(shop, accessToken, schedule.themeId);
        nextSchedules[index] = {
          ...schedule,
          status: "published",
          publishedAt: new Date().toISOString(),
          lastError: undefined,
        };
        processed.push({ shop, scheduleId: schedule.id, status: "published" });
      } catch (error) {
        nextSchedules[index] = {
          ...schedule,
          status: "failed",
          lastError: error instanceof Error ? error.message : "Failed to publish theme",
        };
        processed.push({ shop, scheduleId: schedule.id, status: "failed" });
      }
    }

    await updateShopSettings(shop, {
      ...(stored?.settings ?? {}),
      launchpadSchedules: sortLaunchpadSchedules(nextSchedules),
    });
  }

  return { ok: true, processed };
}
