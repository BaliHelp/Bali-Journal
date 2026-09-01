'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface BreakingNewsItem {
  id: string
  title: string
  slug: string
  category: string
}

interface BreakingNewsProps {
  /** Server-rendered, real-time accurate (see src/app/layout.tsx) - shown
   * immediately, no client fetch/flash needed on first paint. */
  initialNews: BreakingNewsItem[]
}

// Refresh interval for long-lived tabs - the initial render already has
// accurate SSR data (no fallback/flash), this just keeps it current for
// someone who leaves the site open for a while without navigating.
const REFRESH_INTERVAL_MS = 5 * 60 * 1000

export function BreakingNews({ initialNews }: BreakingNewsProps) {
  const [news, setNews] = useState<BreakingNewsItem[]>(initialNews)

  useEffect(() => {
    const interval = setInterval(() => {
      fetch('/api/articles/breaking')
        .then((res) => res.json())
        .then((data) => {
          if (data.articles && data.articles.length > 0) setNews(data.articles)
        })
        .catch(() => {
          // Keep showing whatever we already have on error
        })
    }, REFRESH_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [])

  if (news.length === 0) return null

  // Duplicate news items for seamless loop
  const marqueeItems = [...news, ...news, ...news]

  return (
    <div className="bg-red-600 text-white py-2 overflow-hidden">
      <div className="relative">
        {/* Left fade gradient */}
        <div className="absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-red-600 to-transparent z-10" />

        {/* Breaking badge */}
        <div className="absolute left-4 top-1/2 -translate-y-1/2 z-20 bg-white text-red-600 px-3 py-1 text-xs font-bold uppercase tracking-wider rounded shrink-0">
          BREAKING
        </div>

        {/* Marquee container */}
        <div className="marquee-wrapper pl-24">
          <div className="marquee-content flex gap-12 animate-marquee whitespace-nowrap">
            {marqueeItems.map((item, index) => (
              <Link
                key={`${item.id}-${index}`}
                href={`/article/${item.slug}`}
                className="text-sm font-medium hover:underline inline-block"
              >
                {item.title}
              </Link>
            ))}
          </div>
        </div>

        {/* Right fade gradient */}
        <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-red-600 to-transparent z-10" />
      </div>

      <style jsx>{`
        @keyframes marquee {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-33.33%);
          }
        }

        .animate-marquee {
          /* Sped up 1 fold (2x) per request - was 30s */
          animation: marquee 15s linear infinite;
        }

        .animate-marquee:hover {
          animation-play-state: paused;
        }
      `}</style>
    </div>
  )
}
