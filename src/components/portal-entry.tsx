'use client'

import { useRouter } from 'next/navigation'

export default function PortalEntry() {
  const router = useRouter()

  return (
    <div className="w-full flex justify-center mb-6">
      <div
        onClick={() => router.push('/portal')}
        className="w-full max-w-4xl cursor-pointer rounded-2xl py-10 px-6 text-center
        bg-gradient-to-br from-[#020617] via-[#14532d] to-[#3f2f0b]
        border border-yellow-400/30
        hover:border-yellow-300/60
        transition-all duration-300
        hover:scale-[1.02]
        shadow-[0_0_40px_rgba(234,179,8,0.25)]"
      >
        <h2 className="text-2xl font-semibold text-yellow-300">
          ENTER PORTAL
        </h2>

        <p className="text-sm text-green-300 mt-2">
          Overlay Contests • Added Prize Pools
        </p>
      </div>
    </div>
  )
}
