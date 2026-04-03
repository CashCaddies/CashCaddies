"use client";

import { AuthProvider } from "@/contexts/auth-context";
import { WelcomeEmailSubscriber } from "@/components/welcome-email-subscriber";
import { WinningsToast } from "@/components/winnings-toast";
import { WalletProvider } from "@/hooks/use-wallet";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <WelcomeEmailSubscriber />
      <WalletProvider>
        {children}
        <WinningsToast />
      </WalletProvider>
    </AuthProvider>
  );
}
