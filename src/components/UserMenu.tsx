"use client";

import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/react";
import {
  ArrowRightOnRectangleIcon,
  ChevronDownIcon,
  UserCircleIcon,
} from "@heroicons/react/24/outline";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { UserAvatar } from "./UserAvatar";

export function UserMenu() {
  const { user, profile, signOut } = useAuth();
  if (!user) return null;

  const display = profile?.displayName || user.displayName || user.email || "User";

  return (
    <Menu as="div" className="relative">
      <MenuButton className="flex items-center gap-1.5 rounded-full p-1 hover:bg-gray-100 active:scale-95 transition">
        <UserAvatar
          id={user.uid}
          src={profile?.avatarUrl}
          email={user.email}
          name={display}
          size="sm"
        />
        <ChevronDownIcon className="size-4 text-gray-400" aria-hidden />
      </MenuButton>
      <MenuItems
        anchor="bottom end"
        className="z-50 mt-2 w-64 origin-top-right rounded-xl bg-white shadow-xl ring-1 ring-black/5 p-1 focus:outline-none data-[closed]:scale-95 data-[closed]:opacity-0 transition duration-100"
      >
        <div className="px-3 py-2 border-b border-gray-100">
          <div className="text-xs font-semibold text-gray-900 truncate">
            {display}
          </div>
          <div className="text-[11px] text-gray-500 truncate">{user.email}</div>
          {profile?.phoneNumber && (
            <div className="text-[11px] text-gray-500 truncate">
              {profile.phoneNumber}
            </div>
          )}
        </div>
        <MenuItem>
          {({ focus }) => (
            <Link
              href="/account"
              className={`${
                focus ? "bg-gray-50 text-gray-900" : "text-gray-700"
              } w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition`}
            >
              <UserCircleIcon className="size-4" />
              Account
            </Link>
          )}
        </MenuItem>
        <MenuItem>
          {({ focus }) => (
            <button
              onClick={() => signOut()}
              className={`${
                focus ? "bg-rose-50 text-rose-700" : "text-gray-700"
              } w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition`}
            >
              <ArrowRightOnRectangleIcon className="size-4" />
              Sign out
            </button>
          )}
        </MenuItem>
      </MenuItems>
    </Menu>
  );
}
