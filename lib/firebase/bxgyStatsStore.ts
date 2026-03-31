import { getDb } from "./admin";
import { collection, doc, getDocs, increment, setDoc } from "firebase/firestore";

export type BxgyEventType = "qualified" | "auto_added";

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export async function trackBxgyEvent(shop: string, ruleId: string, event: BxgyEventType): Promise<void> {
  const ref = doc(getDb(), "bxgy_stats", shop, "rules", ruleId, "days", todayKey());
  await setDoc(ref, { [event]: increment(1) }, { merge: true });
}

export interface BxgyRuleStat {
  ruleId: string;
  qualified: number;
  autoAdded: number;
  conversionRate: string;
}

export async function getBxgyRuleStats(shop: string, ruleIds: string[]): Promise<BxgyRuleStat[]> {
  const results: BxgyRuleStat[] = [];

  await Promise.all(
    ruleIds.map(async (ruleId) => {
      const daysCol = collection(getDb(), "bxgy_stats", shop, "rules", ruleId, "days");
      const snap = await getDocs(daysCol);

      let qualified = 0;
      let autoAdded = 0;
      snap.docs.forEach((entry) => {
        const data = entry.data();
        qualified += (data.qualified as number) || 0;
        autoAdded += (data.auto_added as number) || 0;
      });

      results.push({
        ruleId,
        qualified,
        autoAdded,
        conversionRate: qualified > 0 ? ((autoAdded / qualified) * 100).toFixed(1) + "%" : "—",
      });
    }),
  );

  return results;
}
