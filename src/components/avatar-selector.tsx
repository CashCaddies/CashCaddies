"use client";

import { AVATAR_OPTIONS } from "@/lib/avatar-options";
import Image from "next/image";
import { useState } from "react";

export default function AvatarSelector() {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div className="grid grid-cols-4 gap-4">
      {AVATAR_OPTIONS.map((src) => (
        <div
          key={src}
          onClick={() => setSelected(src)}
          className={`cursor-pointer rounded-xl border p-1 transition-all
            ${selected === src ? "border-green-400 scale-105" : "border-gray-700 hover:scale-105"}
          `}
        >
          <Image
            src={src}
            alt="avatar"
            width={80}
            height={80}
            className="rounded-lg"
          />
        </div>
      ))}
    </div>
  );
}
