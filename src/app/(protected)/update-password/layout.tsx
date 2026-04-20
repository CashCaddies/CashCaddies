import type { Metadata } from "next";
import type { ReactNode } from "react";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Set new password",
  description: "Choose a new password for your CashCaddies account.",
};

export default function UpdatePasswordLayout({ children }: { children: ReactNode }) {
  return children;
}
