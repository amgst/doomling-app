import { getDb } from "./admin";
import { doc, getDoc, setDoc } from "firebase/firestore";

export interface Promotion {
  active: boolean;
  threshold: number;
  giftProductId: string;
  giftProductTitle: string;
  giftProductImage: string;
  giftProductHandle: string;
  giftVariantId: string;
  giftProductPrice: string;
  message: string;
  discountId?: string;
}

const DEFAULT: Promotion = {
  active: false,
  threshold: 50,
  giftProductId: "",
  giftProductTitle: "",
  giftProductImage: "",
  giftProductHandle: "",
  giftVariantId: "",
  giftProductPrice: "0",
  message: "Add {amount} more to get a free gift!",
};

export async function getPromotion(shop: string): Promise<Promotion> {
  const snap = await getDoc(doc(getDb(), "promotions", shop));
  if (!snap.exists()) return DEFAULT;
  return { ...DEFAULT, ...snap.data() } as Promotion;
}

export async function savePromotion(shop: string, data: Partial<Promotion>): Promise<void> {
  await setDoc(doc(getDb(), "promotions", shop), data, { merge: true });
}
