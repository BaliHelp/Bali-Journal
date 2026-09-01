import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sendDigestEmail } from '@/lib/email/newsletter'

// Default Vercel function timeout can be too short once the subscriber
// list grows (300ms gap x N subscribers, sequential sends) - Pro plan
// supports up to 300s.
export const maxDuration = 120

/**
 * Runs every 30 minutes (vercel.json) - finds PUBLISHED articles that
 * haven't been included in a newsletter digest yet (newsletterSentAt:
 * null) and, if there are any, sends ONE digest email per active
 * subscriber listing all of them. Batched deliberately rather than one
 * email per article - see sendDigestEmail()'s comment for why. Marked as
 * sent (best-effort, not per-subscriber-guaranteed) once all sends have
 * been attempted, so a transient failure for one subscriber can't cause
 * the whole batch to be resent to everyone else on the next run.
 */
export async function GET(request: Request) {
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const pendingArticles = await db.article.findMany({
            where: { status: 'PUBLISHED', newsletterSentAt: null },
            orderBy: { publishedAt: 'asc' },
            select: { id: true, title: true, excerpt: true, slug: true, category: true },
        })

        if (pendingArticles.length === 0) {
            return NextResponse.json({ success: true, articles: 0, subscribers: 0 })
        }

        const subscribers = await db.subscriber.findMany({
            where: { active: true },
            select: { id: true, email: true },
        })

        if (subscribers.length === 0) {
            // No one to notify, but still mark these as "handled" so they
            // don't pile up indefinitely waiting for a subscriber list
            // that may never exist.
            await db.article.updateMany({
                where: { id: { in: pendingArticles.map((a) => a.id) } },
                data: { newsletterSentAt: new Date() },
            })
            return NextResponse.json({ success: true, articles: pendingArticles.length, subscribers: 0 })
        }

        let sent = 0
        let failed = 0
        for (const subscriber of subscribers) {
            try {
                await sendDigestEmail(subscriber.email, subscriber.id, pendingArticles)
                sent++
            } catch (err) {
                failed++
                console.error(`[newsletter-notify] Failed to send to ${subscriber.email}:`, err)
            }
            // Small gap between sends - Resend's free tier has a per-second
            // request rate limit; this keeps a large subscriber list from
            // tripping it.
            await new Promise((resolve) => setTimeout(resolve, 300))
        }

        await db.article.updateMany({
            where: { id: { in: pendingArticles.map((a) => a.id) } },
            data: { newsletterSentAt: new Date() },
        })

        return NextResponse.json({ success: true, articles: pendingArticles.length, subscribers: subscribers.length, sent, failed })
    } catch (error) {
        console.error('[newsletter-notify] Error:', error)
        return NextResponse.json({ error: 'Newsletter notify failed', details: error instanceof Error ? error.message : 'Unknown' }, { status: 500 })
    }
}
