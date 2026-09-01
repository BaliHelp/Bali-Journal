import { db } from '@/lib/db'

// Shared by the initial server-render (src/app/layout.tsx) and the
// periodic client refresh (src/app/api/articles/breaking/route.ts) so both
// use the exact same window/limit - kept in one place instead of drifting.
export const BREAKING_NEWS_WINDOW_DAYS = 7
export const BREAKING_NEWS_LIMIT = 15

export function getBreakingNewsArticles() {
    const sinceDate = new Date(Date.now() - BREAKING_NEWS_WINDOW_DAYS * 24 * 60 * 60 * 1000)

    return db.article.findMany({
        where: {
            status: 'PUBLISHED',
            publishedAt: { gte: sinceDate },
        },
        orderBy: { publishedAt: 'desc' },
        take: BREAKING_NEWS_LIMIT,
        select: {
            id: true,
            title: true,
            slug: true,
            category: true,
        },
    })
}
