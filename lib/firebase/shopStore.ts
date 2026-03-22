import { getDb } from "./admin";
import { FieldValue } from "firebase-admin/firestore";

const COLLECTION = "shops";

export interface ShopData {
  installedAt?: string;
  uninstalledAt?: string | null;
  plan?: string;
  settings?: Record<string, unknown>;
}

export async function saveShop(shop: string, data: ShopData): Promise<void> {
  await getDb().collection(COLLECTION).doc(shop).set(
    { ...data, updatedAt: FieldValue.serverTimestamp() },
    { merge: true }
  );
}

export async function getShop(shop: string): Promise<ShopData | null> {
  const doc = await getDb().collection(COLLECTION).doc(shop).get();
  if (!doc.exists) return null;
  return doc.data() as ShopData;
}

export async function markUninstalled(shop: string): Promise<void> {
  await getDb().collection(COLLECTION).doc(shop).set(
    {
      uninstalledAt: new Date().toISOString(),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

export async function updateShopSettings(
  shop: string,
  settings: Record<string, unknown>
): Promise<void> {
  await getDb().collection(COLLECTION).doc(shop).set(
    { settings, updatedAt: FieldValue.serverTimestamp() },
    { merge: true }
  );
}
