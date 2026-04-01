import { collection, doc, getDocs, increment, setDoc } from "firebase/firestore";
import { getDb } from "./admin";

export type PostPurchaseEventType = "viewed" | "accepted";

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export async function trackPostPurchaseEvent(shop: string, offerId: string, event: PostPurchaseEventType) {
  const ref = doc(getDb(), "post_purchase_stats", shop, "offers", offerId, "days", todayKey());
  await setDoc(ref, { [event]: increment(1) }, { merge: true });
}

export async function addPostPurchaseRevenue(shop: string, offerId: string, revenue: number) {
  const ref = doc(getDb(), "post_purchase_stats", shop, "offers", offerId, "days", todayKey());
  await setDoc(ref, { revenue: increment(revenue) }, { merge: true });
}

export interface PostPurchaseOfferStat {
  offerId: string;
  viewed: number;
  accepted: number;
  revenue: number;
  conversionRate: string;
}

export async function getPostPurchaseOfferStats(shop: string, offerIds: string[]): Promise<PostPurchaseOfferStat[]> {
  const results: PostPurchaseOfferStat[] = [];

  await Promise.all(
    offerIds.map(async (offerId) => {
      const daysCol = collection(getDb(), "post_purchase_stats", shop, "offers", offerId, "days");
      const snap = await getDocs(daysCol);

      let viewed = 0;
      let accepted = 0;
      let revenue = 0;

      snap.docs.forEach((entry) => {
        const data = entry.data();
        viewed += (data.viewed as number) || 0;
        accepted += (data.accepted as number) || 0;
        revenue += (data.revenue as number) || 0;
      });

      results.push({
        offerId,
        viewed,
        accepted,
        revenue,
        conversionRate: viewed > 0 ? `${((accepted / viewed) * 100).toFixed(1)}%` : "—",
      });
    }),
  );

  return results;
}
