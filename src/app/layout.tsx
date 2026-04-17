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

const ogImageUrl = "/logo.png?v=1";

export const metadata: Metadata = {
  metadataBase: new URL("https://cashcaddies.com"),

  title: "CashCaddies",

  description: "Daily Fantasy Golf",

  openGraph: {
    title: "CashCaddies",
    description: "Daily Fantasy Golf",
    images: [
      {
        url: ogImageUrl,
      },
    ],
  },

  twitter: {
    card: "summary_large_image",
    title: "CashCaddies",
    description: "Daily Fantasy Golf",
    images: [ogImageUrl],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
      <body className="min-h-[100dvh] overflow-y-auto overflow-x-hidden bg-slate-950 text-slate-100">
        <div className="app-shell">
          <div className="app-container">
            <SupabaseProvider>
              <AppProviders>
                <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
                  <SiteHeader />
                  <SoftLaunchCountdown />
                  <ConditionalBetaBanner />
                  <main className="mx-auto w-full max-w-[1400px] flex-1 overflow-y-auto px-6 py-8">{children}</main>
                  <SiteFooter />
                </div>
              </AppProviders>
            </SupabaseProvider>
            <script
              dangerouslySetInnerHTML={{
                __html: `
      setInterval(() => {
        document.querySelectorAll('select').forEach(el => {
          el.style.display = 'none';
        });
      }, 500);
    `,
              }}
            />
          </div>
        </div>
      </body>
    </html>
  );
}
