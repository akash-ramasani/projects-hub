"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth";
import {
  EnvelopeIcon,
  LockClosedIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";

function LoginInner() {
  const { user, allowed, signIn, signOut, loading } = useAuth();
  const router = useRouter();
  const search = useSearchParams();
  const next = search.get("next") || "/contacts";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && user && allowed) router.replace(next);
  }, [loading, user, allowed, next, router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setSubmitting(true);
    try {
      await signIn(email, password);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (!loading && user && !allowed) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4">
        <div className="w-full max-w-sm rounded-2xl bg-white shadow-xs ring-1 ring-black/5 p-6 text-center">
          <h1 className="text-base font-semibold text-gray-900">Access denied</h1>
          <p className="mt-2 text-sm text-gray-600">
            <span className="font-medium text-gray-900">{user.email}</span> is not
            authorized to use Projects Hub.
          </p>
          <button
            onClick={() => signOut()}
            className="mt-4 inline-flex justify-center rounded-lg bg-[#2BB673] px-4 py-2 text-sm font-semibold text-white hover:bg-[#23a062] active:scale-95 transition"
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-6">
          <div className="size-12 rounded-2xl bg-[#2BB673] grid place-items-center text-white font-bold text-xl shadow-sm">
            P
          </div>
          <h1 className="mt-4 text-xl font-bold text-gray-900">Projects Hub</h1>
          <p className="text-xs text-gray-500 mt-1">
            Sign in with your registered email.
          </p>
        </div>

        <form
          onSubmit={onSubmit}
          className="rounded-2xl bg-white shadow-xs ring-1 ring-black/5 p-6 space-y-4"
        >
          <div>
            <label htmlFor="email" className="block text-xs font-semibold text-gray-700 mb-1">
              Email
            </label>
            <div className="relative">
              <EnvelopeIcon className="size-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="email"
                type="email"
                required
                autoFocus
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="block w-full rounded-lg border-0 py-2 pl-9 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:outline-[#2BB673] focus:ring-4 focus:ring-[#2BB673]/10 transition-all text-sm"
              />
            </div>
          </div>

          <div>
            <label htmlFor="password" className="block text-xs font-semibold text-gray-700 mb-1">
              Password
            </label>
            <div className="relative">
              <LockClosedIcon className="size-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full rounded-lg border-0 py-2 pl-9 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:outline-[#2BB673] focus:ring-4 focus:ring-[#2BB673]/10 transition-all text-sm"
              />
            </div>
          </div>

          {err && (
            <div className="rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-xs text-rose-700">
              {err}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full inline-flex justify-center items-center gap-2 rounded-lg bg-[#2BB673] px-4 py-2 text-sm font-semibold text-white hover:bg-[#23a062] active:scale-95 transition disabled:opacity-60"
          >
            {submitting ? (
              <>
                <ArrowPathIcon className="size-4 animate-spin" />
                Signing in…
              </>
            ) : (
              "Sign in"
            )}
          </button>
        </form>

        <p className="mt-4 text-center text-[11px] text-gray-400">
          Authorized users only.
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}
