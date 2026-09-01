import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * Public like/unlike - no login required (this site has no reader
 * accounts), same trust model as the existing localStorage-based bookmark
 * feature (src/components/article/article-actions.tsx). The client tracks
 * "did I already like this" itself (localStorage) and calls POST once /
 * DELETE once accordingly - not abuse-proof, but matches this site's
 * existing engineering level for reader-facing engagement features, and is
 * real, working data rather than nothing.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    try {
        const article = await db.article.update({
            where: { id },
            data: { likeCount: { increment: 1 } },
            select: { likeCount: true },
        })
        return NextResponse.json({ likeCount: article.likeCount })
    } catch {
        return NextResponse.json({ error: 'Article not found' }, { status: 404 })
    }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    try {
        const article = await db.article.findUnique({ where: { id }, select: { likeCount: true } })
        if (!article) return NextResponse.json({ error: 'Article not found' }, { status: 404 })

        const updated = await db.article.update({
            where: { id },
            data: { likeCount: Math.max(0, article.likeCount - 1) },
            select: { likeCount: true },
        })
        return NextResponse.json({ likeCount: updated.likeCount })
    } catch {
        return NextResponse.json({ error: 'Article not found' }, { status: 404 })
    }
}
