'use client'

import { useRouter } from 'next/navigation'

export default function PortalEntry() {
  const router = useRouter()

  return (
    <div className="w-full flex justify-center mb-6">
      <div
        onClick={() => router.push('/portal')}
        className="w-full max-w-4xl cursor-pointer rounded-2xl py-10 px-6 text-center
        bg-gradient-to-br from-zinc-900 to-black
        border border-purple-500/20
        hover:border-purple-500/40
        transition-all duration-300
        hover:scale-[1.02]"
      >
        <h2 className="text-2xl font-semibold">
          ENTER PORTAL
        </h2>

        <p className="text-sm text-muted-foreground mt-2">
          Overlay Contests • Added Prize Pools
        </p>
      </div>
    </div>
  )
}
