import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/** Called by ShareMenu (src/components/article/share-menu.tsx) after any share action - powers the admin Metrics panel's "Most Shared" indicator. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    try {
        const article = await db.article.update({
            where: { id },
            data: { shareCount: { increment: 1 } },
            select: { shareCount: true },
        })
        return NextResponse.json({ shareCount: article.shareCount })
    } catch {
        return NextResponse.json({ error: 'Article not found' }, { status: 404 })
    }
}
