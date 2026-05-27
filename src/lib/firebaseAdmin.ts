// Firebase Admin SDK — used by /api routes to upsert contacts.
import {
  initializeApp,
  getApps,
  cert,
  type App,
  applicationDefault,
} from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

let app: App | null = null;
let db: Firestore | null = null;

function loadServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed.private_key === "string") {
      // Vercel-style escaped newlines
      parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
    }
    return parsed;
  } catch (e) {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT is not valid JSON. " + (e as Error).message,
    );
  }
}

export function getAdmin() {
  if (!app) {
    if (getApps().length) {
      app = getApps()[0]!;
    } else {
      const svc = loadServiceAccount();
      app = initializeApp(
        svc ? { credential: cert(svc) } : { credential: applicationDefault() },
      );
    }
    db = getFirestore(app);
  }
  return { app: app!, db: db! };
}
