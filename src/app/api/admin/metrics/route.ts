import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth/session'

/**
 * Powers the admin Metrics panel. Views/likes/shares are real counters on
 * Article (viewCount already existed; likeCount/shareCount added 2026-09-02
 * alongside the like button and Share menu's tracking calls - see
 * src/components/article/share-menu.tsx and the new like route). Search
 * terms come from SearchQuery, one row per public search performed
 * (src/app/search/page.tsx) - this tracking also didn't exist before.
 */
export async function GET() {
    const session = await getSession()
    if (!session || (session.role !== 'ADMIN' && session.role !== 'EDITOR')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const baseSelect = {
        id: true,
        title: true,
        slug: true,
        category: true,
        viewCount: true,
        likeCount: true,
        shareCount: true,
        publishedAt: true,
        _count: { select: { comments: true } },
    } as const

    const [topViewed, topLiked, topShared, topCommentedRaw, searchTerms, totals] = await Promise.all([
        db.article.findMany({
            where: { status: 'PUBLISHED' },
            orderBy: { viewCount: 'desc' },
            take: 10,
            select: baseSelect,
        }),
        db.article.findMany({
            where: { status: 'PUBLISHED' },
            orderBy: { likeCount: 'desc' },
            take: 10,
            select: baseSelect,
        }),
        db.article.findMany({
            where: { status: 'PUBLISHED' },
            orderBy: { shareCount: 'desc' },
            take: 10,
            select: baseSelect,
        }),
        db.article.findMany({
            where: { status: 'PUBLISHED' },
            take: 200, // can't orderBy a relation _count directly in findMany - sort in JS below
            select: baseSelect,
        }),
        db.searchQuery.groupBy({
            by: ['query'],
            _count: { query: true },
            orderBy: { _count: { query: 'desc' } },
            take: 10,
        }),
        db.article.aggregate({
            where: { status: 'PUBLISHED' },
            _sum: { viewCount: true, likeCount: true, shareCount: true },
        }),
    ])

    const topCommented = topCommentedRaw
        .filter((a) => a._count.comments > 0)
        .sort((a, b) => b._count.comments - a._count.comments)
        .slice(0, 10)

    const totalSearches = await db.searchQuery.count()

    return NextResponse.json({
        topViewed,
        topLiked,
        topShared,
        topCommented,
        topSearched: searchTerms.map((t) => ({ query: t.query, count: t._count.query })),
        totals: {
            views: totals._sum.viewCount || 0,
            likes: totals._sum.likeCount || 0,
            shares: totals._sum.shareCount || 0,
            searches: totalSearches,
        },
    })
}
