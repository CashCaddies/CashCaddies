'use client'

import { useRouter } from 'next/navigation'

export default function PortalEntry() {
  const router = useRouter()

  return (
    <div className="w-full flex justify-center mb-6">
      <div
        onClick={() => router.push('/portal')}
        style={{
          background: "linear-gradient(135deg, #020617, #14532d, #3f2f0b)",
          boxShadow: "0 0 50px rgba(234,179,8,0.35)"
        }}
        className="w-full max-w-4xl cursor-pointer rounded-2xl py-10 px-6 text-center border border-yellow-400/40 hover:scale-[1.02] transition-all duration-300"
      >
        <h2 className="text-2xl font-semibold !text-yellow-300">
          ENTER PORTAL
        </h2>

        <p className="text-sm !text-green-300 mt-2">
          Overlay Contests • Added Prize Pools
        </p>
      </div>
    </div>
  )
}
