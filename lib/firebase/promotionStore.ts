import { getDb } from "./admin";
import { doc, getDoc, setDoc } from "firebase/firestore";

export interface PromotionTier {
  threshold: number;
  giftProductId: string;
  giftProductTitle: string;
  giftProductImage: string;
  giftProductHandle: string;
  giftVariantId: string;
  giftProductPrice: string;
}

export interface Promotion {
  active: boolean;
  tiers: PromotionTier[];
  message: string;
  unlockedMessage: string;
  barColor: string;
  startsAt: string;
  endsAt: string;
  discountId?: string;
}

const DEFAULT_TIER: PromotionTier = {
  threshold: 50,
  giftProductId: "",
  giftProductTitle: "",
  giftProductImage: "",
  giftProductHandle: "",
  giftVariantId: "",
  giftProductPrice: "0",
};

const DEFAULT: Promotion = {
  active: false,
  tiers: [{ ...DEFAULT_TIER }],
  message: "Add {amount} more to unlock a free gift!",
  unlockedMessage: "🎁 You've unlocked a free gift!",
  barColor: "#008060",
  startsAt: "",
  endsAt: "",
};

function migrateLegacy(data: Record<string, unknown>): Promotion {
  if (!data.tiers && data.threshold !== undefined) {
    return {
      ...DEFAULT,
      active: Boolean(data.active),
      tiers: [{
        threshold: Number(data.threshold) || 50,
        giftProductId: String(data.giftProductId || ""),
        giftProductTitle: String(data.giftProductTitle || ""),
        giftProductImage: String(data.giftProductImage || ""),
        giftProductHandle: String(data.giftProductHandle || ""),
        giftVariantId: String(data.giftVariantId || ""),
        giftProductPrice: String(data.giftProductPrice || "0"),
      }],
      message: String(data.message || DEFAULT.message),
      unlockedMessage: String(data.unlockedMessage || DEFAULT.unlockedMessage),
      barColor: String(data.barColor || DEFAULT.barColor),
      startsAt: String(data.startsAt || ""),
      endsAt: String(data.endsAt || ""),
      discountId: String(data.discountId || ""),
    };
  }
  return { ...DEFAULT, ...data } as Promotion;
}

export async function getPromotion(shop: string): Promise<Promotion> {
  const snap = await getDoc(doc(getDb(), "promotions", shop));
  if (!snap.exists()) return DEFAULT;
  return migrateLegacy(snap.data() as Record<string, unknown>);
}

export async function savePromotion(shop: string, data: Partial<Promotion>): Promise<void> {
  await setDoc(doc(getDb(), "promotions", shop), data, { merge: true });
}
