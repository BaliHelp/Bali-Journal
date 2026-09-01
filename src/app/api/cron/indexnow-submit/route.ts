import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { submitToIndexNow } from '@/lib/indexnow'
import { SITE_URL } from '@/lib/site-config'

/**
 * Runs every 15 minutes (vercel.json) - finds PUBLISHED articles that
 * haven't been submitted to IndexNow yet (indexNowSubmittedAt: null) and
 * submits them in one batch (IndexNow accepts up to 10,000 URLs per
 * request). Stateful via indexNowSubmittedAt rather than a time-window
 * guess, so a failed run or a missed cron tick can't silently lose an
 * article - it just stays unsubmitted until the next successful run picks
 * it up.
 */
export async function GET(request: Request) {
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const pending = await db.article.findMany({
            where: { status: 'PUBLISHED', indexNowSubmittedAt: null },
            select: { id: true, slug: true },
            take: 10000,
        })

        if (pending.length === 0) {
            return NextResponse.json({ success: true, submitted: 0 })
        }

        const urls = pending.map((a) => `${SITE_URL}/article/${a.slug}`)
        const ok = await submitToIndexNow(urls)

        if (ok) {
            await db.article.updateMany({
                where: { id: { in: pending.map((a) => a.id) } },
                data: { indexNowSubmittedAt: new Date() },
            })
        }

        return NextResponse.json({ success: ok, submitted: ok ? pending.length : 0 })
    } catch (error) {
        console.error('[indexnow-submit] Error:', error)
        return NextResponse.json({ error: 'IndexNow submission failed', details: error instanceof Error ? error.message : 'Unknown' }, { status: 500 })
    }
}
