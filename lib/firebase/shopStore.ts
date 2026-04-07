import { getDb } from "./admin";
import { collection, doc, getDoc, getDocs, setDoc, deleteDoc, serverTimestamp } from "firebase/firestore";

const COLLECTION = "shops";

export interface ShopData {
  installedAt?: string;
  uninstalledAt?: string | null;
  plan?: string;
  settings?: Record<string, unknown>;
}

function stripUndefinedDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value
      .map((entry) => stripUndefinedDeep(entry))
      .filter((entry) => entry !== undefined) as T;
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entry]) => entry !== undefined)
        .map(([key, entry]) => [key, stripUndefinedDeep(entry)]),
    ) as T;
  }

  return value;
}

export async function saveShop(shop: string, data: ShopData): Promise<void> {
  await setDoc(
    doc(getDb(), COLLECTION, shop),
    stripUndefinedDeep({ ...data, updatedAt: serverTimestamp() }),
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
    stripUndefinedDeep({ uninstalledAt: new Date().toISOString(), updatedAt: serverTimestamp() }),
    { merge: true }
  );
}

export async function updateShopSettings(
  shop: string,
  settings: Record<string, unknown>
): Promise<void> {
  await setDoc(
    doc(getDb(), COLLECTION, shop),
    stripUndefinedDeep({ settings, updatedAt: serverTimestamp() }),
    { merge: true }
  );
}

/**
 * Deletes all Firestore data for a shop. Called by the GDPR shop/redact webhook
 * (triggered 48 hours after uninstall). Recursively removes all subcollections.
 */
export async function deleteShopAllData(shop: string): Promise<void> {
  const db = getDb();

  // analytics/{shop}/orders/*
  const analyticsSnap = await getDocs(collection(db, "analytics", shop, "orders"));
  await Promise.all(analyticsSnap.docs.map((d) => deleteDoc(d.ref)));

  // upsells/{shop}/rules/*
  const upsellsSnap = await getDocs(collection(db, "upsells", shop, "rules"));
  await Promise.all(upsellsSnap.docs.map((d) => deleteDoc(d.ref)));

  // bxgy_stats/{shop}/rules/{ruleId}/days/*  +  rule doc
  const bxgyRulesSnap = await getDocs(collection(db, "bxgy_stats", shop, "rules"));
  await Promise.all(
    bxgyRulesSnap.docs.map(async (ruleDoc) => {
      const daysSnap = await getDocs(collection(db, "bxgy_stats", shop, "rules", ruleDoc.id, "days"));
      await Promise.all(daysSnap.docs.map((d) => deleteDoc(d.ref)));
      await deleteDoc(ruleDoc.ref);
    }),
  );

  // post_purchase_stats/{shop}/offers/{offerId}/days/*  +  offer doc
  const ppOffersSnap = await getDocs(collection(db, "post_purchase_stats", shop, "offers"));
  await Promise.all(
    ppOffersSnap.docs.map(async (offerDoc) => {
      const daysSnap = await getDocs(collection(db, "post_purchase_stats", shop, "offers", offerDoc.id, "days"));
      await Promise.all(daysSnap.docs.map((d) => deleteDoc(d.ref)));
      await deleteDoc(offerDoc.ref);
    }),
  );

  // shops/{shop}  (the shop doc itself)
  await deleteDoc(doc(db, "shops", shop));
}

export async function listShops(): Promise<Array<{ shop: string; data: ShopData }>> {
  const snap = await getDocs(collection(getDb(), COLLECTION));
  return snap.docs.map((entry) => ({
    shop: entry.id,
    data: entry.data() as ShopData,
  }));
}
