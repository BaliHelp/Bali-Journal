'use client'

import { useEffect, useState } from 'react'
import { AdMedia, type AdWithSlot } from './ad-slot'

const ROTATE_MS = 4000

/** Cycles through multiple active ads for the same slot, one at a time, with a soft crossfade. */
export function AdCarousel({ ads }: { ads: AdWithSlot[] }) {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (ads.length <= 1) return
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % ads.length)
    }, ROTATE_MS)
    return () => clearInterval(timer)
  }, [ads.length])

  if (ads.length === 0) return null

  return (
    <div className="relative">
      {ads.map((ad, i) => (
        <div
          key={ad.id}
          className={`transition-opacity duration-700 ${i === index ? 'opacity-100' : 'opacity-0 absolute inset-0 pointer-events-none'}`}
          aria-hidden={i !== index}
        >
          <AdMedia ad={ad} />
        </div>
      ))}
    </div>
  )
}
