import { initializeApp, getApps, cert, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

let _db: Firestore | null = null;

/**
 * Returns the Firestore instance, initializing Firebase Admin on first call.
 * Lazy-initialized so it does not run at build time (only at request time).
 */
export function getDb(): Firestore {
  if (_db) return _db;

  let app: App;
  if (getApps().length === 0) {
    app = initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        // Vercel stores the key with literal \n — replace them with real newlines
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      }),
    });
  } else {
    app = getApps()[0];
  }

  _db = getFirestore(app);
  return _db;
}
