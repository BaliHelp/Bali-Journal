'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'

interface BreakingNewsItem {
  id: string
  title: string
  slug: string
  category: string
}

// Fallback breaking news if no database data
const fallbackNews = [
  { id: '1', title: 'Bali Government Tightens Coastal Hotel Development Rules', slug: 'pemerintah-bali-perketat-aturan-pembangunan-hotel-di-area-pesisir', category: 'TOURISM' },
  { id: '2', title: 'Foreign Investors Eye Renewable Energy Projects in East Bali', slug: 'investor-asing-minati-proyek-energi-terbarukan-di-bali-timur', category: 'INVESTMENT' },
  { id: '3', title: 'Tourist Attraction Ticket Price Increase Takes Effect', slug: 'kenaikan-harga-tiket-masuk-objek-wisata-diwisatakan-mulai-berlaku', category: 'TOURISM' },
]

export function BreakingNews() {
  const [news, setNews] = useState<BreakingNewsItem[]>(fallbackNews)
  const hasFetched = useRef(false)

  useEffect(() => {
    if (hasFetched.current) return
    hasFetched.current = true
    
    // Fetch breaking news on mount
    fetch('/api/articles/breaking')
      .then(res => res.json())
      .then(data => {
        if (data.articles && data.articles.length > 0) {
          setNews(data.articles)
        }
      })
      .catch(() => {
        // Keep fallback news on error
      })
  }, [])

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
          animation: marquee 30s linear infinite;
        }
        
        .animate-marquee:hover {
          animation-play-state: paused;
        }
      `}</style>
    </div>
  )
}
