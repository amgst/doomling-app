import { getDb } from "./admin";
import { collection, doc, getDoc, getDocs, setDoc, serverTimestamp } from "firebase/firestore";

const COLLECTION = "shops";

export interface ShopData {
  installedAt?: string;
  uninstalledAt?: string | null;
  plan?: string;
  settings?: Record<string, unknown>;
}

export async function saveShop(shop: string, data: ShopData): Promise<void> {
  await setDoc(
    doc(getDb(), COLLECTION, shop),
    { ...data, updatedAt: serverTimestamp() },
    { merge: true }
  );
}

export async function getShop(shop: string): Promise<ShopData | null> {
  const snap = await getDoc(doc(getDb(), COLLECTION, shop));
  if (!snap.exists()) return null;
  return snap.data() as ShopData;
}

export async function markUninstalled(shop: string): Promise<void> {
  await setDoc(
    doc(getDb(), COLLECTION, shop),
    { uninstalledAt: new Date().toISOString(), updatedAt: serverTimestamp() },
    { merge: true }
  );
}

export async function updateShopSettings(
  shop: string,
  settings: Record<string, unknown>
): Promise<void> {
  await setDoc(
    doc(getDb(), COLLECTION, shop),
    { settings, updatedAt: serverTimestamp() },
    { merge: true }
  );
}

export async function listShops(): Promise<Array<{ shop: string; data: ShopData }>> {
  const snap = await getDocs(collection(getDb(), COLLECTION));
  return snap.docs.map((entry) => ({
    shop: entry.id,
    data: entry.data() as ShopData,
  }));
}
