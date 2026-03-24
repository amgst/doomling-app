import { getDb } from "./admin";
import {
  collection, doc, getDocs, addDoc, deleteDoc, serverTimestamp,
} from "firebase/firestore";

export interface UpsellRule {
  id: string;
  triggerProductId: string;
  triggerProductTitle: string;
  upsellProductId: string;
  upsellProductTitle: string;
  discountPercent: number;
  message: string;
  createdAt: string;
}

function rulesCol(shop: string) {
  return collection(getDb(), "upsells", shop, "rules");
}

export async function listUpsells(shop: string): Promise<UpsellRule[]> {
  const snap = await getDocs(rulesCol(shop));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as UpsellRule));
}

export async function addUpsell(
  shop: string,
  rule: Omit<UpsellRule, "id" | "createdAt">
): Promise<string> {
  const ref = await addDoc(rulesCol(shop), {
    ...rule,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function deleteUpsell(shop: string, id: string): Promise<void> {
  await deleteDoc(doc(getDb(), "upsells", shop, "rules", id));
}
