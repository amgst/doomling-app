import { getDb } from "./admin";
import { doc, getDoc, setDoc, increment, collection, getDocs } from "firebase/firestore";

export type EventType = "view" | "click" | "added" | "gift_shown" | "gift_added";

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

export interface RuleStat {
  ruleId: string;
  views: number;
  clicks: number;
  added: number;
  ctr: string;
  convRate: string;
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

      let views = 0, clicks = 0, added = 0;
      snap.docs.forEach((d) => {
        const data = d.data();
        views += (data.view as number) || 0;
        clicks += (data.click as number) || 0;
        added += (data.added as number) || 0;
      });

      results.push({
        ruleId,
        views,
        clicks,
        added,
        ctr: views > 0 ? ((clicks / views) * 100).toFixed(1) + "%" : "—",
        convRate: clicks > 0 ? ((added / clicks) * 100).toFixed(1) + "%" : "—",
      });
    })
  );

  return results;
}

