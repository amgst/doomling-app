export interface DailyStat {
  date: string;
  count: number;
  revenue: number;
  currency: string;
}

export interface Stats {
  totalOrders: number;
  totalRevenue: number;
  totalUpsaleRevenue: number;
  currency: string;
  avgOrderValue: number;
  daily: DailyStat[];
  prevTotalOrders?: number;
  prevTotalRevenue?: number;
  prevUpsaleRevenue?: number;
  prevAvgOrderValue?: number;
}
