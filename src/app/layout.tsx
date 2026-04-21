import "./globals.css";
import { AppProviders } from "@/components/app-providers";
import SupabaseProvider from "@/lib/supabase-provider";
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <SupabaseProvider>
          <AppProviders>{children}</AppProviders>
        </SupabaseProvider>
      </body>
    </html>
  );
}
