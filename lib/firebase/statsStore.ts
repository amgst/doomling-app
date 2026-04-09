import { getDb } from "./admin";
import { doc, setDoc, increment, collection, getDocs } from "firebase/firestore";

export type EventType = "view" | "click" | "added";

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export async function trackEvent(
  shop: string,
  ruleId: string,
  event: EventType
): Promise<void> {
  const ref = doc(getDb(), "upsell_stats", shop, "rules", ruleId, "days", todayKey());
  await setDoc(ref, { [event]: increment(1) }, { merge: true });
}

export async function trackRevenueAttribution(
  shop: string,
  ruleId: string,
  revenue: number,
  orderCountDelta: number,
  unitsDelta = 0,
): Promise<void> {
  const ref = doc(getDb(), "upsell_stats", shop, "rules", ruleId, "days", todayKey());
  const payload: Record<string, unknown> = {};

  if (Number.isFinite(revenue) && revenue !== 0) payload.revenue = increment(revenue);
  if (Number.isFinite(orderCountDelta) && orderCountDelta !== 0) payload.orders = increment(orderCountDelta);
  if (Number.isFinite(unitsDelta) && unitsDelta !== 0) payload.units = increment(unitsDelta);
  if (Object.keys(payload).length === 0) return;

  await setDoc(ref, payload, { merge: true });
}

export interface RuleStat {
  ruleId: string;
  views: number;
  clicks: number;
  added: number;
  orders: number;
  units: number;
  revenue: number;
  ctr: string;
  convRate: string;
  addRate: string;
  revenuePerView: number;
  revenuePerClick: number;
  revenuePerOrder: number;
}

export async function getRuleStats(
  shop: string,
  ruleIds: string[]
): Promise<RuleStat[]> {
  const results: RuleStat[] = [];

  await Promise.all(
    ruleIds.map(async (ruleId) => {
      const daysCol = collection(getDb(), "upsell_stats", shop, "rules", ruleId, "days");
      const snap = await getDocs(daysCol);

      let views = 0;
      let clicks = 0;
      let added = 0;
      let orders = 0;
      let units = 0;
      let revenue = 0;

      snap.docs.forEach((d) => {
        const data = d.data();
        views += (data.view as number) || 0;
        clicks += (data.click as number) || 0;
        added += (data.added as number) || 0;
        orders += (data.orders as number) || 0;
        units += (data.units as number) || 0;
        revenue += (data.revenue as number) || 0;
      });

      results.push({
        ruleId,
        views,
        clicks,
        added,
        orders,
        units,
        revenue,
        ctr: views > 0 ? ((clicks / views) * 100).toFixed(1) + "%" : "-",
        convRate: clicks > 0 ? ((added / clicks) * 100).toFixed(1) + "%" : "-",
        addRate: views > 0 ? ((added / views) * 100).toFixed(1) + "%" : "-",
        revenuePerView: views > 0 ? revenue / views : 0,
        revenuePerClick: clicks > 0 ? revenue / clicks : 0,
        revenuePerOrder: orders > 0 ? revenue / orders : 0,
      });
    })
  );

  return results;
}
