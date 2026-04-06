export interface BxgyProduct {
  productId: string;
  variantId: string;
  title: string;
  image: string;
  price: string;
  handle: string;
}

export interface BxgyRule {
  id: string;
  name: string;
  buyProducts: BxgyProduct[];
  giftProduct: BxgyProduct | null;
  buyQuantity: number;
  giftQuantity: number;
  limitOneGiftPerOrder: boolean;
  message: string;
  autoAdd: boolean;
  priority: number;
  enabled: boolean;
}

export interface BxgySummary {
  activeRules: number;
  totalQualified: number;
  totalAutoAdded: number;
  conversionRate: string;
}

export interface BxgyRuleStat {
  ruleId: string;
  name: string;
  buyLabel: string;
  giftLabel: string;
  message: string;
  qualified: number;
  autoAdded: number;
  conversionRate: string;
}
