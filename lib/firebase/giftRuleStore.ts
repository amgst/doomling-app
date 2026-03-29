import { getDb } from "./admin";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";

export interface GiftRule {
  mainVariantId: string;
  giftVariantId: string;
}

export async function getGiftRules(shop: string): Promise<GiftRule[]> {
  const ref = doc(getDb(), "gift_rules", shop);
  const snap = await getDoc(ref);
  if (!snap.exists()) return [];
  return (snap.data().rules as GiftRule[]) ?? [];
}

export async function setGiftRules(shop: string, rules: GiftRule[]): Promise<void> {
  const ref = doc(getDb(), "gift_rules", shop);
  await setDoc(ref, { rules, updatedAt: serverTimestamp() });
}
