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

const ogImageUrl = "/Thumbnail2.0FORCC.png";

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
      <body className="min-h-screen overflow-y-auto bg-slate-950 text-slate-100">
        <div className="app-container">
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
            className="pointer-events-none fixed inset-0 z-[999999] box-border w-full max-w-full overflow-x-hidden pl-[calc(16px_+_env(safe-area-inset-left))] pr-[calc(16px_+_env(safe-area-inset-right))]"
          >
            <div
              className="box-border absolute inset-0 h-full w-full"
              style={{
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
      </body>
    </html>
  );
}
