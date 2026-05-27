import type { Metadata } from "next";
import "./globals.css";
import { Plus_Jakarta_Sans } from "next/font/google";
import { AppLayout } from "@/components/AppLayout";
import { AuthProvider } from "@/lib/auth";

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-plus-jakarta",
});

const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME || "Projects Hub";
const OWNER = process.env.NEXT_PUBLIC_OWNER_NAME || "";
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const metadata: Metadata = {
  title: {
    default: SITE_NAME,
    template: `%s · ${SITE_NAME}`,
  },
  description: OWNER
    ? `Personal projects hub for ${OWNER} — internal tools, dashboards, and data utilities.`
    : "Personal projects hub — internal tools, dashboards, and data utilities.",
  metadataBase: new URL(SITE_URL),
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`h-full bg-white ${plusJakartaSans.variable}`}>
      <body
        className={`${plusJakartaSans.className} h-full antialiased text-gray-900 bg-white`}
      >
        <AuthProvider>
          <AppLayout>{children}</AppLayout>
        </AuthProvider>
      </body>
    </html>
  );
}
