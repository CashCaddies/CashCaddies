"use client";

import { useEffect } from "react";
import { AuthProvider } from "@/contexts/auth-context";
import { WelcomeEmailSubscriber } from "@/components/welcome-email-subscriber";
import { WinningsToast } from "@/components/winnings-toast";
import { WalletProvider } from "@/hooks/use-wallet";
import { initSound } from "@/lib/sound";

export function AppProviders({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    initSound();
  }, []);

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
