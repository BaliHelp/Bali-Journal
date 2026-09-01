import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth/session'

/**
 * Full unfiltered results (no query params) are kept for any existing
 * caller that still wants everything, but the admin Articles tab itself no
 * longer calls this that way (see /api/admin/articles/by-month) - loading
 * every article's full row on every dashboard visit was the actual source
 * of the panel feeling heavy as the article count grew past 100.
 * Supports `riskLevel` (comma-separated, e.g. "HIGH,CRITICAL") and `q`
 * (search title/excerpt) for the specific on-demand cases that still need
 * real rows across the WHOLE table regardless of which month is loaded in
 * the main view: the High Risk Articles popup and admin search.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session || (session.role !== 'ADMIN' && session.role !== 'EDITOR')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const riskLevelParam = searchParams.get('riskLevel')
    const q = searchParams.get('q')?.trim()

    // Excludes Trash by default everywhere this route is used (search,
    // High Risk popup, legacy unfiltered listing) - trashed articles only
    // show up in the dedicated Trash panel (/api/admin/articles/trash).
    const where: Record<string, unknown> = { status: { not: 'TRASHED' } }
    if (riskLevelParam) {
      where.riskLevel = { in: riskLevelParam.split(',') }
    }
    if (q) {
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { excerpt: { contains: q, mode: 'insensitive' } },
      ]
    }

    const articles = await db.article.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      // Unbounded only for the filtered/search cases above (small result
      // sets by nature); the truly unfiltered "everything" case is legacy
      // and capped so it can't regress into the same heavy-load problem.
      take: Object.keys(where).length > 0 ? undefined : 500,
      include: {
        author: { select: { id: true, name: true, email: true } },
        evidences: { select: { id: true } },
      },
    })

    return NextResponse.json({ articles })
  } catch (error) {
    console.error('Get articles error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch articles' },
      { status: 500 }
    )
  }
}
