"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { dicebearUrl, getCachedAvatar } from "@/lib/profile";

interface UserAvatarProps {
  id: string;
  /** If provided, used as the avatar src (typically a Firebase Storage URL). */
  src?: string | null;
  name?: string | null;
  email?: string | null;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
}

const sizeClasses = {
  xs: "size-5",
  sm: "size-8",
  md: "size-9",
  lg: "size-12",
  xl: "size-full",
};
const sizeMap = { xs: 20, sm: 32, md: 36, lg: 48, xl: 96 };

export function UserAvatar({
  id,
  src,
  name,
  email,
  size = "sm",
  className = "",
}: UserAvatarProps) {
  // Avoid SSR/CSR mismatch — pick the URL on the client only.
  const [resolved, setResolved] = useState<string | null>(src ?? null);
  useEffect(() => {
    if (src) {
      setResolved(src);
      return;
    }
    const cached = getCachedAvatar(id);
    setResolved(cached || dicebearUrl(id));
  }, [src, id]);

  const finalSizeClass = sizeClasses[size];
  const finalRounding = className.includes("rounded-") ? "" : "rounded-full";

  if (!resolved) {
    return (
      <div
        className={`${finalSizeClass} ${finalRounding} shrink-0 bg-gray-100 ${className}`}
      />
    );
  }

  return (
    <Image
      src={resolved}
      alt={name || email || "User Avatar"}
      width={sizeMap[size]}
      height={sizeMap[size]}
      unoptimized
      className={`${finalSizeClass} shrink-0 object-cover ${finalRounding} ${className}`}
      draggable={false}
    />
  );
}
