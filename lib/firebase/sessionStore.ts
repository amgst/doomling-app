import { Session } from "@shopify/shopify-api";
import { getDb } from "./admin";
import { doc, getDoc, setDoc, deleteDoc, collection, query, where, getDocs } from "firebase/firestore";

const COLLECTION = "shopify_sessions";

export const firestoreSessionStorage = {
  async storeSession(session: Session): Promise<boolean> {
    try {
      const sessionObj = session.toObject();
      const clean = Object.fromEntries(
        Object.entries(sessionObj).filter(([, v]) => v !== undefined)
      );
      await setDoc(doc(getDb(), COLLECTION, session.id), clean);
      return true;
    } catch (err) {
      console.error("[sessionStore] storeSession failed:", err);
      return false;
    }
  },

  async loadSession(id: string): Promise<Session | undefined> {
    try {
      const snap = await getDoc(doc(getDb(), COLLECTION, id));
      if (!snap.exists()) return undefined;
      const data = snap.data()!;
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
      await deleteDoc(doc(getDb(), COLLECTION, id));
      return true;
    } catch (err) {
      console.error("[sessionStore] deleteSession failed:", err);
      return false;
    }
  },

  async deleteSessions(ids: string[]): Promise<boolean> {
    try {
      await Promise.all(ids.map((id) => deleteDoc(doc(getDb(), COLLECTION, id))));
      return true;
    } catch (err) {
      console.error("[sessionStore] deleteSessions failed:", err);
      return false;
    }
  },

  async findSessionsByShop(shop: string): Promise<Session[]> {
    try {
      const q = query(collection(getDb(), COLLECTION), where("shop", "==", shop));
      const snap = await getDocs(q);
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
