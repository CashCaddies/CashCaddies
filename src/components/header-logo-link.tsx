"use client";

import Image from "next/image";
import Link from "next/link";

export function HeaderLogoLink() {
  return (
    <Link href="/" className="flex items-center">
      <div className="logo-glow">
        <Image
          src="/cashcaddies-full.png"
          alt="CashCaddies"
          width={300}
          height={150}
          className="h-12 w-auto object-contain"
          priority
          unoptimized
        />
      </div>
    </Link>
  );
}
