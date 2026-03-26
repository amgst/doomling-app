import { getDb } from "./admin";
import {
  collection, doc, getDocs, getDoc, addDoc, deleteDoc, serverTimestamp,
} from "firebase/firestore";

export interface UpsellProduct {
  productId: string;
  title: string;
  image: string;
  price: string;
  handle: string;
  discountPercent: number;
}

export interface UpsellRule {
  id: string;
  triggerProductId: string;
  triggerProductTitle: string;
  upsellProducts: UpsellProduct[];
  message: string;
  createdAt: string;
  // Legacy flat fields (still present on old docs)
  upsellProductId?: string;
  upsellProductTitle?: string;
  upsellProductImage?: string;
  upsellProductPrice?: string;
  upsellProductHandle?: string;
  discountPercent?: number;
}

/** Normalise old single-product docs into the new upsellProducts[] shape */
export function normalizeRule(id: string, data: Record<string, unknown>): UpsellRule {
  if (Array.isArray(data.upsellProducts) && data.upsellProducts.length > 0) {
    return { id, ...data } as UpsellRule;
  }
  // Migrate legacy flat fields
  const legacy: UpsellProduct = {
    productId: String(data.upsellProductId ?? ""),
    title: String(data.upsellProductTitle ?? ""),
    image: String(data.upsellProductImage ?? ""),
    price: String(data.upsellProductPrice ?? ""),
    handle: String(data.upsellProductHandle ?? ""),
    discountPercent: Number(data.discountPercent ?? 0),
  };
  return {
    id,
    triggerProductId: String(data.triggerProductId ?? ""),
    triggerProductTitle: String(data.triggerProductTitle ?? ""),
    upsellProducts: legacy.productId ? [legacy] : [],
    message: String(data.message ?? ""),
    createdAt: String(data.createdAt ?? ""),
  };
}

function rulesCol(shop: string) {
  return collection(getDb(), "upsells", shop, "rules");
}

export async function getUpsell(shop: string, id: string): Promise<UpsellRule | null> {
  const snap = await getDoc(doc(getDb(), "upsells", shop, "rules", id));
  if (!snap.exists()) return null;
  return normalizeRule(snap.id, snap.data() as Record<string, unknown>);
}

export async function listUpsells(shop: string): Promise<UpsellRule[]> {
  const snap = await getDocs(rulesCol(shop));
  return snap.docs.map(d => normalizeRule(d.id, d.data() as Record<string, unknown>));
}

export async function addUpsell(
  shop: string,
  rule: Omit<UpsellRule, "id" | "createdAt">
): Promise<string> {
  const ref = await addDoc(rulesCol(shop), {
    triggerProductId: rule.triggerProductId,
    triggerProductTitle: rule.triggerProductTitle,
    upsellProducts: rule.upsellProducts,
    message: rule.message,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function deleteUpsell(shop: string, id: string): Promise<void> {
  await deleteDoc(doc(getDb(), "upsells", shop, "rules", id));
}
