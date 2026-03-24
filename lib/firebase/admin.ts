import { initializeApp, getApps } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDmu2ptSEuavrVRIDlnaqH1C4SHCYQusDQ",
  authDomain: "doomling-app.firebaseapp.com",
  projectId: "doomling-app",
  storageBucket: "doomling-app.firebasestorage.app",
  messagingSenderId: "1043752536481",
  appId: "1:1043752536481:web:5107229de98d410581a3e0",
};

let _db: Firestore | null = null;

export function getDb(): Firestore {
  if (_db) return _db;
  const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  _db = getFirestore(app);
  return _db;
}
