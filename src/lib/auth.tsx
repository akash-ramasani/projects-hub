"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import {
  getAuth,
  onIdTokenChanged,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  type Auth,
  type User,
  setPersistence,
  browserLocalPersistence,
} from "firebase/auth";
import { getFirebase } from "./firebase";
import {
  bootstrapProfile,
  subscribeProfile,
  type UserProfile,
} from "./profile";

interface AuthContextValue {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  allowed: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  /** Force a fresh read of profile + reload user from Firebase. */
  refresh: () => Promise<void>;
}

const Ctx = createContext<AuthContextValue | null>(null);

let _auth: Auth | null = null;
export function getAppAuth() {
  if (!_auth) {
    const { app } = getFirebase();
    _auth = getAuth(app);
    setPersistence(_auth, browserLocalPersistence).catch(() => {});
  }
  return _auth;
}

const ALLOWED = (process.env.NEXT_PUBLIC_ALLOWED_EMAIL || "")
  .trim()
  .toLowerCase();

// ── Sync auth to browser extension (Projects Hub extension) ───────────────────
// Mirrors the JobWatch pattern: when the user logs in/out (or Firebase silently
// refreshes the ID token every ~1h), we postMessage the new tokens to the page,
// where the extension's content-script bridge picks them up and stores them in
// chrome.storage. This lets the extension write to Firestore as the signed-in
// user without ever showing its own login form.
async function syncToExtension(u: User | null) {
  if (typeof window === "undefined") return;
  if (!(window as { __PH_EXTENSION_INSTALLED__?: boolean }).__PH_EXTENSION_INSTALLED__) return;
  try {
    if (u) {
      const result = await u.getIdTokenResult();
      const expiresIn = Math.max(
        300,
        Math.floor((new Date(result.expirationTime).getTime() - Date.now()) / 1000),
      );
      window.postMessage(
        {
          type: "PH_AUTH",
          idToken: result.token,
          refreshToken: (u as unknown as { refreshToken: string }).refreshToken,
          uid: u.uid,
          email: u.email || "",
          displayName: u.displayName || "",
          photoURL: u.photoURL || "",
          expiresIn,
        },
        window.location.origin,
      );
    } else {
      window.postMessage({ type: "PH_LOGOUT" }, window.location.origin);
    }
  } catch (e) {
    console.warn("[ph-auth] extension sync failed:", (e as Error).message);
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let unsubAuth = () => {};
    let unsubProfile = () => {};
    try {
      unsubAuth = onIdTokenChanged(getAppAuth(), async (u) => {
        setUser(u);
        setLoading(false);
        syncToExtension(u);
        unsubProfile();
        unsubProfile = () => {};
        if (u) {
          const isAllowed =
            !ALLOWED || (u.email || "").toLowerCase() === ALLOWED;
          if (isAllowed) {
            try {
              await bootstrapProfile(u);
            } catch (e) {
              console.warn("[auth] bootstrapProfile failed", e);
            }
            unsubProfile = subscribeProfile(u.uid, setProfile);
          } else {
            setProfile(null);
          }
        } else {
          setProfile(null);
        }
      });
    } catch (e) {
      setError((e as Error).message);
      setLoading(false);
    }
    return () => {
      unsubAuth();
      unsubProfile();
    };
  }, []);

  const allowed =
    !!user && (!ALLOWED || (user.email || "").toLowerCase() === ALLOWED);

  async function signIn(email: string, password: string) {
    setError(null);
    if (ALLOWED && email.trim().toLowerCase() !== ALLOWED) {
      throw new Error("This email is not allowed to sign in.");
    }
    try {
      await signInWithEmailAndPassword(getAppAuth(), email.trim(), password);
    } catch (e) {
      const msg =
        friendlyAuthError((e as { code?: string }).code) || (e as Error).message;
      setError(msg);
      throw new Error(msg);
    }
  }

  async function signOut() {
    try {
      await fbSignOut(getAppAuth());
    } catch {}
  }

  async function refresh() {
    const u = getAppAuth().currentUser;
    if (!u) return;
    await u.reload();
    setUser(getAppAuth().currentUser);
    try {
      await bootstrapProfile(getAppAuth().currentUser!);
    } catch {}
  }

  return (
    <Ctx.Provider
      value={{ user, profile, loading, allowed, error, signIn, signOut, refresh }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used inside <AuthProvider>");
  return v;
}

function friendlyAuthError(code?: string): string | null {
  switch (code) {
    case "auth/invalid-email":
      return "Invalid email address.";
    case "auth/user-disabled":
      return "This account has been disabled.";
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "Incorrect email or password.";
    case "auth/too-many-requests":
      return "Too many failed attempts. Try again later.";
    case "auth/network-request-failed":
      return "Network error. Check your connection.";
    case "auth/invalid-phone-number":
      return "Invalid phone number. Use E.164 format like +14155551234.";
    case "auth/invalid-verification-code":
      return "The verification code is incorrect.";
    case "auth/code-expired":
      return "The verification code has expired. Request a new one.";
    case "auth/credential-already-in-use":
      return "That phone number is already linked to another account.";
    default:
      return null;
  }
}
