// Firebase Web SDK — used in client components to read contacts in real time.
import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let storage: FirebaseStorage | null = null;

export function getFirebase() {
  if (typeof window === "undefined") {
    throw new Error("getFirebase() must be called from client components only.");
  }
  if (!config.projectId) {
    throw new Error(
      "Firebase config missing. Set NEXT_PUBLIC_FIREBASE_* env vars in .env.local.",
    );
  }
  if (!app) {
    app = getApps()[0] ?? initializeApp(config);
    db = getFirestore(app);
    storage = getStorage(app);
  }
  return { app: app!, db: db!, storage: storage! };
}
