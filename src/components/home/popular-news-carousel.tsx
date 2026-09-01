'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Eye } from 'lucide-react'

interface PopularArticle {
    id: string
    title: string
    slug: string
    category: string
    featuredImageUrl: string | null
    featuredImageAlt: string | null
    viewCount: number
}

interface PopularNewsCarouselProps {
    articles: PopularArticle[]
}

const AUTO_SCROLL_PX_PER_FRAME = 0.5 // slow, deliberate crawl
const RESUME_AFTER_INTERACTION_MS = 3000

/**
 * Replaces the old static "Trust Indicators" cards (100% Evidence-Based /
 * Published Articles / Legal Review / Editorial Process) per explicit
 * request - real engagement content instead of static claims. Auto-scrolls
 * slowly (rAF-driven scrollLeft increment, not a CSS transform) specifically
 * so native touch/trackpad swipe still works normally - a transform-based
 * marquee (like BreakingNews) would fight manual scrolling instead of
 * cooperating with it. Auto-scroll pauses for a few seconds after any
 * manual interaction, then resumes. Content is duplicated once so the loop
 * wraps seamlessly (jumps back by exactly one set's width, imperceptible
 * since it's identical content at that point).
 */
export function PopularNewsCarousel({ articles }: PopularNewsCarouselProps) {
    const scrollRef = useRef<HTMLDivElement>(null)
    const pausedRef = useRef(false)
    const resumeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    useEffect(() => {
        const el = scrollRef.current
        if (!el || articles.length === 0) return

        let rafId: number
        const step = () => {
            if (!pausedRef.current) {
                el.scrollLeft += AUTO_SCROLL_PX_PER_FRAME
                const singleSetWidth = el.scrollWidth / 2
                if (singleSetWidth > 0 && el.scrollLeft >= singleSetWidth) {
                    el.scrollLeft -= singleSetWidth
                }
            }
            rafId = requestAnimationFrame(step)
        }
        rafId = requestAnimationFrame(step)
        return () => cancelAnimationFrame(rafId)
    }, [articles.length])

    function pauseTemporarily() {
        pausedRef.current = true
        if (resumeTimeoutRef.current) clearTimeout(resumeTimeoutRef.current)
        resumeTimeoutRef.current = setTimeout(() => {
            pausedRef.current = false
        }, RESUME_AFTER_INTERACTION_MS)
    }

    if (articles.length === 0) return null

    // Duplicated for the seamless-loop trick described above.
    const items = [...articles, ...articles]

    return (
        <div
            ref={scrollRef}
            // NOT scroll-smooth: CSS scroll-behavior:smooth fights a
            // continuous rAF-driven scrollLeft increment. Also NOT
            // snap-x/snap-mandatory/snap-proximity: confirmed via direct
            // testing that CSS Scroll Snap of EITHER strictness fights
            // per-frame scrollLeft writes the exact same way (the browser
            // treats each tiny write as a settled position and immediately
            // corrects back toward the nearest snap point, so scrollLeft
            // never accumulates - reproduced with a 180-frame test loop
            // landing on 0 both times). Dropping snap costs precise
            // card-boundary alignment on manual swipe, but native
            // touch/trackpad drag-scroll still works perfectly without it -
            // that's what makes this "swipeable", not CSS snap.
            className="flex gap-4 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            onPointerDown={pauseTemporarily}
            onWheel={pauseTemporarily}
            onTouchStart={pauseTemporarily}
        >
            {items.map((article, i) => (
                <Link
                    key={`${article.id}-${i}`}
                    href={`/article/${article.slug}`}
                    className="group shrink-0 w-[200px] sm:w-[240px]"
                >
                    <div className="relative aspect-video rounded-lg overflow-hidden bg-muted">
                        {article.featuredImageUrl ? (
                            <Image
                                src={article.featuredImageUrl}
                                alt={article.featuredImageAlt || article.title}
                                fill
                                sizes="240px"
                                className="object-cover transition-transform duration-500 group-hover:scale-105"
                            />
                        ) : null}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                        <div className="absolute bottom-1.5 left-2 flex items-center gap-1 text-[11px] text-white/90">
                            <Eye className="h-3 w-3" />
                            {article.viewCount.toLocaleString()}
                        </div>
                    </div>
                    <p className="mt-2 text-sm font-medium line-clamp-2 group-hover:text-primary transition-colors">
                        {article.title}
                    </p>
                </Link>
            ))}
        </div>
    )
}
