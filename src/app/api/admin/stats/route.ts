import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth/session'

/**
 * Lightweight aggregate counts for the Overview stat cards + their detail
 * popups - cheap DB count()/groupBy() queries instead of loading every
 * article row into memory just to .filter().length it client-side (which is
 * what fetchAllData()'s old approach did, and part of why the admin
 * Articles panel got heavy as the article count grew).
 */
export async function GET() {
    const session = await getSession()
    if (!session || (session.role !== 'ADMIN' && session.role !== 'EDITOR')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const [totalArticles, byStatusRaw, byCategoryRaw, highRiskArticles, totalUsers, byRoleRaw, totalComments, pendingComments] =
        await Promise.all([
            db.article.count(),
            db.article.groupBy({ by: ['status'], _count: true }),
            db.article.groupBy({ by: ['category'], _count: true }),
            db.article.count({ where: { riskLevel: { in: ['HIGH', 'CRITICAL'] } } }),
            db.user.count(),
            db.user.groupBy({ by: ['role'], _count: true }),
            db.comment.count(),
            db.comment.count({ where: { status: 'PENDING' } }),
        ])

    const byStatus = Object.fromEntries(byStatusRaw.map((r) => [r.status, r._count]))
    const byCategory = Object.fromEntries(byCategoryRaw.map((r) => [r.category, r._count]))
    const byRole = Object.fromEntries(byRoleRaw.map((r) => [r.role, r._count]))

    return NextResponse.json({
        totalArticles,
        publishedArticles: byStatus.PUBLISHED || 0,
        highRiskArticles,
        totalUsers,
        totalComments,
        pendingComments,
        byStatus,
        byCategory,
        byRole,
    })
}
