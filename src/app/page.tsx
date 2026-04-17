"use client";

import { ClosedBetaClient } from "@/app/closed-beta/closed-beta-client";

export default function Page() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
      {/* PORTAL */}
      <div className="w-full flex justify-center my-10">
        <div
          onClick={() => window.location.href = '/portal'}
          className="relative w-64 h-64 rounded-full cursor-pointer flex items-center justify-center text-center hover:scale-105 transition-all duration-300"
          style={{
            background: "radial-gradient(circle at 30% 30%, #facc15, #14532d 60%, #020617 100%)",
            boxShadow: "0 0 60px rgba(234,179,8,0.35)"
          }}
        >

          {/* dimples */}
          <div
            className="absolute inset-0 rounded-full opacity-20"
            style={{
              backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.15) 2px, transparent 2px)",
              backgroundSize: "14px 14px"
            }}
          />

          {/* pulse */}
          <div className="absolute inset-0 rounded-full border border-yellow-400 animate-ping opacity-20"></div>

          {/* text */}
          <div className="relative z-10">
            <h2 className="text-lg font-semibold text-yellow-300">ENTER</h2>
            <p className="text-xs text-green-300">PORTAL</p>
          </div>

        </div>
      </div>
      <ClosedBetaClient />
    </main>
  );
}
