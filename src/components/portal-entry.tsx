'use client'

import { useRouter } from 'next/navigation'

export default function PortalEntry() {
  const router = useRouter()

  return (
    <div className="w-full flex justify-center mb-10">
      <div
        onClick={() => router.push('/portal')}
        className="relative w-64 h-64 rounded-full cursor-pointer flex items-center justify-center text-center
        transition-all duration-300 hover:scale-105"
        style={{
          background: "radial-gradient(circle at 30% 30%, #facc15, #14532d 60%, #020617 100%)",
          boxShadow: "0 0 60px rgba(234,179,8,0.35)"
        }}
      >

        {/* DIMPLE OVERLAY */}
        <div
          className="absolute inset-0 rounded-full opacity-20"
          style={{
            backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.15) 2px, transparent 2px)",
            backgroundSize: "14px 14px"
          }}
        />

        {/* PULSE RING */}
        <div className="absolute inset-0 rounded-full border border-yellow-400 animate-ping opacity-20"></div>

        {/* TEXT */}
        <div className="relative z-10 px-4">
          <h2 className="text-lg font-semibold text-yellow-300">
            ENTER
          </h2>
          <p className="text-xs text-green-300 mt-1">
            PORTAL
          </p>
        </div>

      </div>
    </div>
  )
}
