"use client";

import {
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import type { User } from "firebase/auth";
import { getFirebase } from "./firebase";

export interface UserProfile {
  uid: string;
  email: string | null;
  emailVerified: boolean;
  displayName: string | null;
  phoneNumber: string | null;
  photoURL: string | null;     // Auth-provided
  avatarUrl: string | null;    // Our generated DiceBear, in Storage
  createdAt?: unknown;
  updatedAt?: unknown;
}

const dicebearColors = ["b6e3f4", "c0aede", "d1d4f9", "ffd5dc", "ffdfbf"];
const maleHair =
  "variant01,variant02,variant10,variant11,variant12,variant13,variant20,variant22,variant24,variant26";

function colorFor(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  return dicebearColors[Math.abs(hash) % dicebearColors.length];
}

function dicebearUrl(seed: string) {
  return `https://api.dicebear.com/9.x/notionists/svg?seed=${encodeURIComponent(
    seed,
  )}&backgroundColor=${colorFor(seed)}&hair=${maleHair}`;
}

const CACHE_KEY = (uid: string) => `ph_avatar_${uid}`;

export function getCachedAvatar(uid: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(CACHE_KEY(uid));
  } catch {
    return null;
  }
}
function setCachedAvatar(uid: string, url: string) {
  try {
    localStorage.setItem(CACHE_KEY(uid), url);
  } catch {}
}

/**
 * Make sure the signed-in user has a Firestore profile doc + a generated
 * avatar stored in Firebase Storage. Returns the resolved profile.
 *
 * Safe to call on every sign-in / hot-reload: it no-ops if everything is
 * already in place. Permission errors (missing Firestore/Storage rules) are
 * caught and logged — they won't break sign-in.
 */
export async function bootstrapProfile(user: User): Promise<UserProfile | null> {
  const { db, storage } = getFirebase();
  const userRef = doc(db, "users", user.uid);

  let snap;
  try {
    snap = await getDoc(userRef);
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === "permission-denied") {
      console.warn(
        "[profile] Firestore permission denied reading users/" +
          user.uid +
          ". Add the users/{uid} rule from README.md to your Firestore Rules and republish.",
      );
      return null;
    }
    throw e;
  }
  const existing = snap.exists() ? (snap.data() as Partial<UserProfile>) : null;

  const baseUpdate: Partial<UserProfile> = {
    uid: user.uid,
    email: user.email,
    emailVerified: user.emailVerified,
    displayName:
      user.displayName ||
      existing?.displayName ||
      (user.email ? user.email.split("@")[0] : null),
    phoneNumber: user.phoneNumber || existing?.phoneNumber || null,
    photoURL: user.photoURL || existing?.photoURL || null,
    updatedAt: serverTimestamp(),
  };

  let avatarUrl = existing?.avatarUrl ?? null;

  if (!avatarUrl) {
    try {
      const res = await fetch(dicebearUrl(user.uid));
      if (res.ok) {
        const blob = await res.blob();
        const storageRef = ref(storage, `avatars/${user.uid}.svg`);
        await uploadBytes(storageRef, blob, { contentType: "image/svg+xml" });
        avatarUrl = await getDownloadURL(storageRef);
      }
    } catch (e) {
      console.warn(
        "[profile] avatar upload failed, falling back to DiceBear URL. " +
          "Make sure Storage rules allow writes to avatars/{uid}.svg for the owner.",
        e,
      );
      avatarUrl = dicebearUrl(user.uid);
    }
  }

  const full: Partial<UserProfile> = {
    ...baseUpdate,
    avatarUrl,
    ...(snap.exists() ? {} : { createdAt: serverTimestamp() }),
  };

  try {
    await setDoc(userRef, full, { merge: true });
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === "permission-denied") {
      console.warn(
        "[profile] Firestore permission denied writing users/" +
          user.uid +
          ". Add the users/{uid} rule from README.md to your Firestore Rules and republish.",
      );
      // Still cache avatar so UI doesn't break.
      if (avatarUrl) setCachedAvatar(user.uid, avatarUrl);
      return null;
    }
    throw e;
  }

  if (avatarUrl) setCachedAvatar(user.uid, avatarUrl);

  return {
    uid: user.uid,
    email: user.email,
    emailVerified: user.emailVerified,
    displayName: full.displayName ?? null,
    phoneNumber: full.phoneNumber ?? null,
    photoURL: full.photoURL ?? null,
    avatarUrl,
  };
}

export function subscribeProfile(
  uid: string,
  cb: (p: UserProfile | null) => void,
): () => void {
  const { db } = getFirebase();
  return onSnapshot(
    doc(db, "users", uid),
    (snap) => {
      if (!snap.exists()) return cb(null);
      const data = snap.data() as Partial<UserProfile>;
      if (data.avatarUrl) setCachedAvatar(uid, data.avatarUrl);
      cb({
        uid,
        email: data.email ?? null,
        emailVerified: !!data.emailVerified,
        displayName: data.displayName ?? null,
        phoneNumber: data.phoneNumber ?? null,
        photoURL: data.photoURL ?? null,
        avatarUrl: data.avatarUrl ?? null,
      });
    },
    (err) => {
      if ((err as { code?: string }).code === "permission-denied") {
        console.warn(
          "[profile] Cannot subscribe to users/" +
            uid +
            " — Firestore rules deny access. Add the users/{uid} rule from README.md.",
        );
        cb(null);
        return;
      }
      console.warn("[profile] subscribeProfile error", err);
    },
  );
}

/**
 * Re-uploads a fresh DiceBear avatar to Storage (e.g. after the user
 * regenerates it). Returns the new download URL.
 */
export async function regenerateAvatar(uid: string): Promise<string | null> {
  const { db, storage } = getFirebase();
  try {
    // Add a cache-busting seed so DiceBear returns a different image.
    const url = `${dicebearUrl(uid)}&v=${Date.now()}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    const storageRef = ref(storage, `avatars/${uid}.svg`);
    await uploadBytes(storageRef, blob, { contentType: "image/svg+xml" });
    const downloadUrl = await getDownloadURL(storageRef);
    await setDoc(
      doc(db, "users", uid),
      { avatarUrl: downloadUrl, updatedAt: serverTimestamp() },
      { merge: true },
    );
    setCachedAvatar(uid, downloadUrl);
    return downloadUrl;
  } catch (e) {
    console.warn("[profile] regenerateAvatar failed", e);
    return null;
  }
}

export async function updateDisplayName(uid: string, name: string) {
  const { db } = getFirebase();
  await setDoc(
    doc(db, "users", uid),
    { displayName: name, updatedAt: serverTimestamp() },
    { merge: true },
  );
}

export async function syncPhoneNumber(uid: string, phoneNumber: string | null) {
  const { db } = getFirebase();
  await setDoc(
    doc(db, "users", uid),
    { phoneNumber, updatedAt: serverTimestamp() },
    { merge: true },
  );
}

export { dicebearUrl };
