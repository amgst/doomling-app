import { getDb } from "./admin";
import { FieldValue, FieldPath } from "firebase-admin/firestore";

/**
 * Firestore structure:
 *   analytics/{shop}/orders/{YYYY-MM-DD} → { count, revenue, currency }
 */

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export async function incrementDailyOrder(
  shop: string,
  revenue: number,
  currency: string,
  date: string = todayKey()
): Promise<void> {
  const ref = getDb()
    .collection("analytics")
    .doc(shop)
    .collection("orders")
    .doc(date);

  await ref.set(
    {
      count: FieldValue.increment(1),
      revenue: FieldValue.increment(revenue),
      currency,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

export async function decrementDailyOrder(
  shop: string,
  revenue: number,
  date: string = todayKey()
): Promise<void> {
  const ref = getDb()
    .collection("analytics")
    .doc(shop)
    .collection("orders")
    .doc(date);

  await ref.set(
    {
      count: FieldValue.increment(-1),
      revenue: FieldValue.increment(-revenue),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

export interface DailyOrderStat {
  date: string;
  count: number;
  revenue: number;
  currency: string;
}

export interface AnalyticsSummary {
  totalOrders: number;
  totalRevenue: number;
  currency: string;
  avgOrderValue: number;
  daily: DailyOrderStat[];
}

export async function getOrderStats(
  shop: string,
  startDate: string,
  endDate: string
): Promise<AnalyticsSummary> {
  const snap = await getDb()
    .collection("analytics")
    .doc(shop)
    .collection("orders")
    .where(FieldPath.documentId(), ">=", startDate)
    .where(FieldPath.documentId(), "<=", endDate)
    .orderBy(FieldPath.documentId())
    .get();

  let totalOrders = 0;
  let totalRevenue = 0;
  let currency = "USD";
  const daily: DailyOrderStat[] = [];

  snap.docs.forEach((doc) => {
    const data = doc.data();
    const count = (data.count as number) ?? 0;
    const revenue = (data.revenue as number) ?? 0;
    currency = (data.currency as string) ?? "USD";
    totalOrders += count;
    totalRevenue += revenue;
    daily.push({ date: doc.id, count, revenue, currency });
  });

  return {
    totalOrders,
    totalRevenue,
    currency,
    avgOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0,
    daily,
  };
}

export function buildDateRange(days: number): { startDate: string; endDate: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - (days - 1));
  return { startDate: dayKey(start), endDate: dayKey(end) };
}
