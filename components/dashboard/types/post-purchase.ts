export interface PostPurchaseProduct {
  productId: string;
  variantId: string;
  title: string;
  image: string;
  price: string;
  handle: string;
}

export interface PostPurchaseOffer {
  id: string;
  name: string;
  offerProduct: PostPurchaseProduct | null;
  headline: string;
  body: string;
  ctaLabel: string;
  discountPercent: number;
  priority: number;
  triggerType: "all_orders" | "minimum_subtotal" | "contains_product";
  triggerProductIds: string[];
  minimumSubtotal: number;
  enabled: boolean;
}

export interface PostPurchaseSummary {
  activeOffers: number;
  totalViews: number;
  totalAccepted: number;
  totalRevenue: number;
  conversionRate: string;
}

export interface PostPurchaseOfferStat {
  offerId: string;
  name: string;
  productLabel: string;
  triggerType: string;
  discountPercent: number;
  viewed: number;
  accepted: number;
  revenue: number;
  conversionRate: string;
}
