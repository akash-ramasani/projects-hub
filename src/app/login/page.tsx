"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { ArrowRightIcon } from "@heroicons/react/24/outline";

function Spinner() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F6FBF8]">
      <div className="h-8 w-8 border-4 border-[#2BB673] border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

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
      setErr((e as Error).message || "Invalid email or password");
      setSubmitting(false);
    }
  }

  // Not-authorized screen (signed in with wrong account)
  if (!loading && user && !allowed) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6 lg:px-8 relative overflow-hidden bg-[#F6FBF8]">
        <Atmosphere />
        <div className="w-full max-w-sm relative z-10 rounded-2xl bg-white px-8 py-10 shadow-2xl shadow-[#2BB673]/10 ring-1 ring-gray-200 text-center">
          <h1 className="text-base font-semibold text-gray-900">Access denied</h1>
          <p className="mt-2 text-sm text-gray-600">
            <span className="font-medium text-gray-900">{user.email}</span> is not
            authorized to use Projects Hub.
          </p>
          <button
            onClick={() => signOut()}
            className="mt-5 inline-flex justify-center rounded-lg bg-[#2BB673] px-4 py-2 text-sm font-bold text-white shadow-md shadow-[#2BB673]/20 hover:bg-[#1e8a55] active:scale-95 transition-all"
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-6 lg:px-8 relative overflow-hidden bg-[#F6FBF8]">
      <Atmosphere />

      <div className="w-full max-w-md relative z-10">
        {/* Brand */}
        <div className="text-center mb-12">
          <div className="flex justify-center mb-5">
            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-xl shadow-md bg-white ring-1 ring-gray-100">
                <div className="size-8 rounded-lg bg-gradient-to-br from-[#2BB673] to-[#1e8a55] grid place-items-center text-white font-extrabold text-sm leading-none">
                  P
                </div>
              </div>
              <span className="font-extrabold text-black text-3xl tracking-tight">
                Projects<span className="text-[#2BB673]">Hub</span>
              </span>
            </div>
          </div>

          <h2 className="text-[11px] font-medium tracking-[0.2em] uppercase text-gray-400">
            Internal Operations Portal
          </h2>
        </div>

        {/* Card */}
        <div className="mt-8 rounded-2xl bg-white px-8 py-10 shadow-2xl shadow-[#2BB673]/10 ring-1 ring-gray-200">
          <form onSubmit={onSubmit} className="space-y-6">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-semibold text-gray-900"
              >
                Email Address
              </label>
              <div className="mt-2">
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoFocus
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full rounded-lg bg-white px-3.5 py-2 text-sm text-gray-900 outline outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-[#2BB673] focus:ring-4 focus:ring-[#2BB673]/10 transition-all"
                  placeholder="name@company.com"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label
                  htmlFor="password"
                  className="block text-sm font-semibold text-gray-900"
                >
                  Password
                </label>
              </div>
              <div className="mt-2">
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full rounded-lg bg-white px-3.5 py-2 text-sm text-gray-900 outline outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-[#2BB673] focus:ring-4 focus:ring-[#2BB673]/10 transition-all"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <input
                id="remember-me"
                name="remember-me"
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-[#2BB673] accent-[#2BB673] focus:ring-[#2BB673] focus:ring-offset-0"
              />
              <label
                htmlFor="remember-me"
                className="text-sm font-medium text-gray-600"
              >
                Keep me signed in
              </label>
            </div>

            {err && (
              <div className="rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-xs text-rose-700">
                {err}
              </div>
            )}

            <div className="pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#2BB673] px-4 py-2 text-sm font-bold text-white shadow-md shadow-[#2BB673]/20 hover:bg-[#1e8a55] hover:-translate-y-0.5 hover:shadow-lg hover:shadow-[#2BB673]/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2BB673] disabled:opacity-50 disabled:hover:translate-y-0 disabled:cursor-not-allowed transition-all active:scale-95"
              >
                {submitting ? (
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Signing in...</span>
                  </div>
                ) : (
                  <>
                    <span>Sign in</span>
                    <ArrowRightIcon className="size-4 stroke-[3]" />
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        <p className="mt-10 text-center text-xs font-medium text-gray-400">
          Managed internally by Projects Hub. Unauthorized access is prohibited.
        </p>
      </div>
    </div>
  );
}

function Atmosphere() {
  return (
    <>
      <div
        className="absolute inset-0 pointer-events-none blur-[1px]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(43,182,115,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(43,182,115,0.02) 1px, transparent 1px)",
          backgroundSize: "72px 72px",
          maskImage:
            "radial-gradient(ellipse 60% 60% at 50% 50%, transparent 0%, #000 100%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 60% 60% at 50% 50%, transparent 0%, #000 100%)",
        }}
      />
      <div
        className="absolute -top-[150px] -right-[50px] w-[650px] h-[650px] pointer-events-none opacity-40"
        style={{
          background:
            "radial-gradient(circle, rgba(43,182,115,0.12) 0%, transparent 60%)",
        }}
      />
      <div
        className="absolute -bottom-[180px] -left-[80px] w-[500px] h-[500px] pointer-events-none opacity-30"
        style={{
          background:
            "radial-gradient(circle, rgba(43,182,115,0.06) 0%, transparent 60%)",
        }}
      />
    </>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <LoginInner />
    </Suspense>
  );
}
