export interface UpsellProduct {
  productId: string;
  title: string;
  image: string;
  price: string;
  handle: string;
  discountPercent: number;
  badgeText?: string;
}

export interface UpsellRule {
  id: string;
  triggerProductId: string;
  triggerProductTitle: string;
  upsellProducts: UpsellProduct[];
  message: string;
  enabled?: boolean;
}

export interface RuleStat {
  ruleId: string;
  triggerProductTitle: string;
  upsellProductTitle: string;
  views: number;
  clicks: number;
  added: number;
  ctr: string;
  convRate: string;
}
