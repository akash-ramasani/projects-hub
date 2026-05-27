"use client";

import React, { useEffect, useState, isValidElement } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Dialog, DialogBackdrop, DialogPanel, TransitionChild } from "@headlessui/react";
import {
  Bars3Icon,
  XMarkIcon,
  MapPinIcon,
  ArrowPathIcon,
  ArrowRightOnRectangleIcon,
} from "@heroicons/react/24/outline";
import { MapPinIcon as MapPinIconSolid } from "@heroicons/react/24/solid";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { UserMenu } from "./UserMenu";
import { UserAvatar } from "./UserAvatar";

function cn(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

// Add more tabs here later — same shape, that's it.
const NAV = [
  {
    href: "/contacts",
    label: "Maps Contacts",
    icon: MapPinIcon,
    activeIcon: MapPinIconSolid,
  },
];

const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME || "Projects Hub";
const SITE_INITIAL = (SITE_NAME[0] || "P").toUpperCase();

const listVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.055, delayChildren: 0.08 } },
};
const itemVariants = {
  hidden: { opacity: 0, x: -14 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { type: "spring" as const, stiffness: 400, damping: 28 },
  },
};

function NavItem({
  href,
  icon,
  activeIcon: IconSolid,
  label,
  isActive,
  onClick,
}: {
  href: string;
  icon: React.ElementType | React.ReactNode;
  activeIcon?: React.ElementType;
  label: string;
  isActive: boolean;
  onClick?: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const isNode = isValidElement(icon);
  return (
    <motion.li variants={itemVariants} className="relative">
      <Link
        href={href}
        onClick={onClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={cn(
          isActive
            ? "text-[#2BB673]"
            : "text-gray-600 hover:text-[#2BB673] hover:bg-gray-100/70",
          "group flex items-center gap-x-3 py-2 pr-2 pl-3 text-sm font-semibold transition-colors relative z-10 select-none rounded-lg",
        )}
      >
        <AnimatePresence>
          {isActive && (
            <>
              <motion.div
                layoutId="active-pill"
                className="absolute inset-0 bg-[#2BB673]/10 -z-10 rounded-lg ring-1 ring-[#2BB673]/20"
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
              />
              <motion.div
                layoutId="active-indicator"
                className="absolute left-0 top-1 bottom-1 w-[3px] bg-[#2BB673] z-20 rounded-r-full"
                initial={{ opacity: 0, scaleY: 0.4 }}
                animate={{ opacity: 1, scaleY: 1 }}
                exit={{ opacity: 0, scaleY: 0.4 }}
                transition={{ duration: 0.22 }}
              />
            </>
          )}
        </AnimatePresence>
        <motion.div
          animate={
            hovered ? { scale: 1.15, rotate: -6 } : { scale: 1, rotate: 0 }
          }
          transition={{ type: "spring", stiffness: 400, damping: 20 }}
          className="shrink-0"
        >
          {isNode ? (
            (icon as React.ReactNode)
          ) : (
            (() => {
              const IconComp = (
                isActive && IconSolid ? IconSolid : icon
              ) as React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
              return (
                <IconComp
                  aria-hidden
                  className={cn(
                    isActive
                      ? "text-[#2BB673]"
                      : "text-gray-400 group-hover:text-[#2BB673]",
                    "size-5 transition-colors duration-200",
                  )}
                />
              );
            })()
          )}
        </motion.div>
        <span>{label}</span>
      </Link>
    </motion.li>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { user, profile, signOut } = useAuth();
  return (
    <div className="flex grow flex-col gap-y-5 overflow-y-auto border-r border-gray-200 bg-white px-4 pt-5 pb-4">
      <Link href="/contacts" className="flex items-center gap-2 px-2">
        <div className="size-8 rounded-lg bg-[#2BB673] grid place-items-center text-white font-bold">
          {SITE_INITIAL}
        </div>
        <div className="leading-tight">
          <div className="text-sm font-bold text-gray-900">{SITE_NAME}</div>
        </div>
      </Link>

      <nav className="flex-1 flex flex-col">
        <div className="px-3 text-[10px] font-bold tracking-widest text-gray-400 uppercase mb-2">
          Main
        </div>
        <motion.ul
          variants={listVariants}
          initial="hidden"
          animate="visible"
          className="-mx-1 space-y-1"
        >
          {NAV.map((n) => (
            <NavItem
              key={n.href}
              href={n.href}
              icon={n.icon}
              activeIcon={n.activeIcon}
              label={n.label}
              isActive={pathname.startsWith(n.href)}
              onClick={onNavigate}
            />
          ))}
        </motion.ul>

        {user && (
          <div className="mt-auto pt-6">
            <div className="px-3 text-[10px] font-bold tracking-widest text-gray-400 uppercase mb-2">
              Account
            </div>
            <ul className="-mx-1 space-y-1">
              <li>
                <Link
                  href="/account"
                  onClick={onNavigate}
                  className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                    pathname.startsWith("/account")
                      ? "bg-[#2BB673]/10 text-[#1e8a55]"
                      : "text-gray-700 hover:bg-gray-50 hover:text-gray-900"
                  }`}
                >
                  <UserAvatar
                    id={user.uid}
                    src={profile?.avatarUrl}
                    name={profile?.displayName || user.displayName}
                    email={user.email}
                    size="xs"
                  />
                  My Profile
                </Link>
              </li>
              <li>
                <button
                  onClick={() => signOut()}
                  className="w-full group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-rose-50 hover:text-rose-700 transition"
                >
                  <ArrowRightOnRectangleIcon className="size-4 text-gray-400 group-hover:text-rose-500" />
                  Sign out
                </button>
              </li>
            </ul>
          </div>
        )}
      </nav>

      <div className="px-3 py-2 text-[10px] text-gray-400">
        v0.1.0 · {SITE_NAME}
      </div>
    </div>
  );
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { user, allowed, loading } = useAuth();

  // Public routes (no shell, no auth gate)
  const isPublic = pathname === "/login";

  // Auth gate: redirect to /login if not authed (or not authorized)
  useEffect(() => {
    if (isPublic || loading) return;
    if (!user || !allowed) {
      const next = pathname && pathname !== "/" ? `?next=${encodeURIComponent(pathname)}` : "";
      router.replace(`/login${next}`);
    }
  }, [isPublic, loading, user, allowed, pathname, router]);

  // Login page: just render — no sidebar / topbar.
  if (isPublic) {
    return <div className="min-h-screen bg-gray-50">{children}</div>;
  }

  // Splash while auth state is resolving / redirect is happening.
  if (loading || !user || !allowed) {
    return (
      <div className="min-h-screen grid place-items-center bg-white">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <ArrowPathIcon className="size-4 animate-spin" />
          Loading…
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-gray-50">
      {/* Mobile sidebar */}
      <Dialog open={open} onClose={setOpen} className="relative z-50 lg:hidden">
        <DialogBackdrop className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm data-[closed]:opacity-0 transition-opacity duration-200" />
        <div className="fixed inset-0 flex">
          <DialogPanel className="relative mr-16 flex w-full max-w-xs flex-1 data-[closed]:-translate-x-full transition duration-200">
            <TransitionChild>
              <div className="absolute top-0 left-full flex w-16 justify-center pt-5">
                <button onClick={() => setOpen(false)} className="-m-2.5 p-2.5">
                  <span className="sr-only">Close sidebar</span>
                  <XMarkIcon className="size-6 text-white" aria-hidden />
                </button>
              </div>
            </TransitionChild>
            <SidebarContent onNavigate={() => setOpen(false)} />
          </DialogPanel>
        </div>
      </Dialog>

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:z-40 lg:flex lg:w-60 lg:flex-col">
        <SidebarContent />
      </div>

      <div className="lg:pl-60">
        {/* Top bar */}
        <div className="sticky top-0 z-30 flex h-14 items-center gap-x-4 border-b border-gray-200 bg-white/80 px-4 backdrop-blur sm:px-6 lg:px-8">
          <button
            className="-m-2.5 p-2.5 text-gray-700 lg:hidden"
            onClick={() => setOpen(true)}
          >
            <span className="sr-only">Open sidebar</span>
            <Bars3Icon className="size-6" aria-hidden />
          </button>
          <div className="text-sm text-gray-500">{SITE_NAME}</div>
          <div className="ml-auto">
            <UserMenu />
          </div>
        </div>

        <main className="py-6 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
