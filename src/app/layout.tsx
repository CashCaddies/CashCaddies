import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppProviders } from "@/components/app-providers";
import { ConditionalBetaBanner } from "@/components/conditional-beta-banner";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import SoftLaunchCountdown from "@/components/SoftLaunchCountdown";
import SupabaseProvider from "@/lib/supabase-provider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://cashcaddies.com"),

  title: "CashCaddies DFS | Fantasy Golf Platform",

  description:
    "Daily fantasy golf contests with built-in entry protection and real cash prizes.",

  openGraph: {
    title: "CashCaddies DFS | Fantasy Golf Platform",

    description:
      "Daily fantasy golf contests with built-in entry protection and real cash prizes.",

    images: [
      {
        url: "/cashcaddies-preview.png",
        width: 1200,
        height: 630,
      },
    ],
  },

  twitter: {
    card: "summary_large_image",

    title: "CashCaddies DFS | Fantasy Golf Platform",

    description:
      "Daily fantasy golf contests with built-in entry protection and real cash prizes.",

    images: ["/cashcaddies-preview.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
      <body className="min-h-screen overflow-y-auto bg-slate-950 text-slate-100">
        <SupabaseProvider>
          <AppProviders>
            <div className="min-h-screen flex flex-col overflow-y-auto">
              <SiteHeader />
              <SoftLaunchCountdown />
              <ConditionalBetaBanner />
              <main className="mx-auto w-full max-w-6xl flex-1 overflow-y-auto px-6 py-8">{children}</main>
              <SiteFooter />
            </div>
          </AppProviders>
        </SupabaseProvider>
        <div
          style={{
            position: "fixed",
            inset: 0,
            pointerEvents: "none",
            zIndex: 999999,
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              padding: "3px",
              background:
                "linear-gradient(135deg, #00ff9c, #00c97a, #ffd700, #ffea70, #00ff9c)",
              WebkitMask:
                "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
              WebkitMaskComposite: "xor",
              maskComposite: "exclude",
              borderRadius: "4px",
              boxShadow:
                "0 0 10px rgba(0,255,156,0.6), 0 0 20px rgba(255,215,0,0.5)",
            }}
          />
        </div>
      </body>
    </html>
  );
}
