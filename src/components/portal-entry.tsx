'use client'

import { useRouter } from 'next/navigation'

export default function PortalEntry() {
  const router = useRouter()

  return (
    <div className="w-full flex justify-center mb-6">
      <div
        onClick={() => router.push('/portal')}
        className="w-full max-w-4xl cursor-pointer rounded-2xl py-10 px-6 text-center
        bg-gradient-to-br from-zinc-900 via-emerald-950 to-cyan-950
        border border-cyan-400/20
        hover:border-cyan-300/40
        transition-all duration-300
        hover:scale-[1.02]
        shadow-[0_0_25px_rgba(34,211,238,0.15)]"
      >
        <h2 className="text-2xl font-semibold text-cyan-300">
          ENTER PORTAL
        </h2>

        <p className="text-sm text-emerald-300/80 mt-2">
          Overlay Contests • Added Prize Pools
        </p>
      </div>
    </div>
  )
}
