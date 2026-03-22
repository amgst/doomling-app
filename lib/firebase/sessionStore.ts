import { Session } from "@shopify/shopify-api";
import { getDb } from "./admin";

const COLLECTION = "shopify_sessions";

export const firestoreSessionStorage = {
  async storeSession(session: Session): Promise<boolean> {
    try {
      const sessionObj = session.toObject();
      const clean = Object.fromEntries(
        Object.entries(sessionObj).filter(([, v]) => v !== undefined)
      );
      await getDb().collection(COLLECTION).doc(session.id).set(clean);
      return true;
    } catch (err) {
      console.error("[sessionStore] storeSession failed:", err);
      return false;
    }
  },

  async loadSession(id: string): Promise<Session | undefined> {
    try {
      const doc = await getDb().collection(COLLECTION).doc(id).get();
      if (!doc.exists) return undefined;
      const data = doc.data()!;
      return Session.fromPropertyArray(
        Object.entries(data) as [string, string | boolean | number][]
      );
    } catch (err) {
      console.error("[sessionStore] loadSession failed:", err);
      return undefined;
    }
  },

  async deleteSession(id: string): Promise<boolean> {
    try {
      await getDb().collection(COLLECTION).doc(id).delete();
      return true;
    } catch (err) {
      console.error("[sessionStore] deleteSession failed:", err);
      return false;
    }
  },

  async deleteSessions(ids: string[]): Promise<boolean> {
    try {
      const db = getDb();
      const batch = db.batch();
      ids.forEach((id) => batch.delete(db.collection(COLLECTION).doc(id)));
      await batch.commit();
      return true;
    } catch (err) {
      console.error("[sessionStore] deleteSessions failed:", err);
      return false;
    }
  },

  async findSessionsByShop(shop: string): Promise<Session[]> {
    try {
      const snap = await getDb()
        .collection(COLLECTION)
        .where("shop", "==", shop)
        .get();
      return snap.docs.map((d) =>
        Session.fromPropertyArray(
          Object.entries(d.data()) as [string, string | boolean | number][]
        )
      );
    } catch (err) {
      console.error("[sessionStore] findSessionsByShop failed:", err);
      return [];
    }
  },
};
