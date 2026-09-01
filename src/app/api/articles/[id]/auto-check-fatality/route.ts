import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { checkFatality } from '@/lib/ai/check-fatality'

interface Params {
  params: Promise<{ id: string }>
}

/**
 * Destination for the ONE-TIME delayed QStash call scheduled by
 * checkFatality() when an article resolves to HIGH but isn't publishable
 * yet - NOT a recurring/cron endpoint, and NOT scoped to "all articles":
 * this call is for exactly one article ID, fired exactly once, 10 minutes
 * after that specific article landed on HIGH. See src/lib/qstash.ts.
 */
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    // Re-check the article is still in the state that earned it this
    // scheduled call - an admin may have already handled it (edited,
    // published, or run Check Fatality manually) in the last 10 minutes,
    // in which case there's nothing left for this automatic pass to do.
    const article = await db.article.findUnique({
      where: { id },
      select: { status: true, riskLevel: true, legalReviewedAt: true },
    })
    if (!article || article.status !== 'DRAFT' || article.riskLevel !== 'HIGH' || article.legalReviewedAt) {
      return NextResponse.json({ skipped: true, reason: 'Article no longer needs an automatic check' })
    }

    const result = await checkFatality(id, 'Automated Legal Review (10-min delayed check)', { isAutoRecheck: true })
    return NextResponse.json({ skipped: false, result })
  } catch (error) {
    console.error('Auto check-fatality error:', error)
    return NextResponse.json({ error: 'Failed to run automatic legal-risk check' }, { status: 500 })
  }
}
