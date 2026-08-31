import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth/session'

/**
 * Powers the admin Articles tab's month-by-month lazy loading - one real
 * calendar month of articles per request instead of every article ever
 * created. `before` (ISO date, optional) asks for the next OLDER month
 * relative to that cursor; omit it to get the most recent month that has
 * articles. No raw SQL needed: 3 cheap queries per call (find the anchor
 * article, compute that month's boundaries in JS, fetch + check for an
 * even-older one).
 */
export async function GET(request: NextRequest) {
    const session = await getSession()
    if (!session || (session.role !== 'ADMIN' && session.role !== 'EDITOR')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const beforeParam = searchParams.get('before')
    const before = beforeParam ? new Date(beforeParam) : new Date()

    // Anchor: the most recent article older than the cursor - its month is
    // the next month we should show.
    const anchor = await db.article.findFirst({
        where: { createdAt: { lt: before } },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
    })

    if (!anchor) {
        return NextResponse.json({ articles: [], month: null, hasMore: false })
    }

    const monthStart = new Date(Date.UTC(anchor.createdAt.getUTCFullYear(), anchor.createdAt.getUTCMonth(), 1))
    const monthEnd = new Date(Date.UTC(anchor.createdAt.getUTCFullYear(), anchor.createdAt.getUTCMonth() + 1, 1))

    const [articles, olderArticle] = await Promise.all([
        db.article.findMany({
            where: { createdAt: { gte: monthStart, lt: monthEnd } },
            orderBy: { createdAt: 'desc' },
            include: {
                author: { select: { id: true, name: true, email: true } },
                evidences: { select: { id: true } },
            },
        }),
        db.article.findFirst({ where: { createdAt: { lt: monthStart } }, select: { id: true } }),
    ])

    return NextResponse.json({
        articles,
        month: monthStart.toISOString().slice(0, 7), // "YYYY-MM"
        hasMore: !!olderArticle,
    })
}
