import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { checkFatality, type CheckFatalityResult } from '@/lib/ai/check-fatality'

const GRACE_PERIOD_MS = 10 * 60 * 1000 // 10 minutes

/**
 * Auto-publish for HIGH-risk articles: any DRAFT article sitting at HIGH
 * risk for at least 10 minutes (giving a human a window to intervene first)
 * that hasn't already had a legal-review check run gets ONE automatic
 * "Check Fatality" pass (see src/lib/ai/check-fatality.ts) - this stamps
 * the legal-review sign-off HIGH-risk articles need to publish, and
 * auto-publishes if every other requirement (image, evidence, content
 * length) is already met. legalReviewedAt being set afterward is what
 * stops this from re-processing the same article on the next run.
 *
 * Called by Vercel Cron (see vercel.json) - NOTE: Vercel's Hobby plan only
 * supports daily-granularity cron schedules, not a 10-minute interval. On
 * Hobby, either upgrade to Pro for minute-level cron, or point a free
 * external scheduler (e.g. cron-job.org) at this URL with the
 * Authorization: Bearer <CRON_SECRET> header instead.
 */
export async function GET(request: Request) {
    try {
        const authHeader = request.headers.get('authorization')
        const cronSecret = process.env.CRON_SECRET
        if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const cutoff = new Date(Date.now() - GRACE_PERIOD_MS)
        const candidates = await db.article.findMany({
            where: {
                status: 'DRAFT',
                riskLevel: 'HIGH',
                legalReviewedAt: null,
                updatedAt: { lte: cutoff },
            },
            select: { id: true, title: true },
            take: 20, // safety cap per run
        })

        const results: Array<{ id: string; title: string } & (Partial<CheckFatalityResult> | { error: string })> = []
        for (const candidate of candidates) {
            try {
                const result = await checkFatality(candidate.id, 'Automated Legal Review (10-min HIGH-risk check)')
                results.push({ id: candidate.id, title: candidate.title, ...result })
            } catch (error) {
                console.error(`Auto-publish check failed for ${candidate.id}:`, error)
                results.push({ id: candidate.id, title: candidate.title, error: (error as Error).message })
            }
        }

        return NextResponse.json({
            checked: results.length,
            published: results.filter((r) => 'published' in r && r.published).length,
            results,
        })
    } catch (error) {
        console.error('Auto-publish high-risk cron error:', error)
        return NextResponse.json({ error: 'Failed to run auto-publish check' }, { status: 500 })
    }
}
