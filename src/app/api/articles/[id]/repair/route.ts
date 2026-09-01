
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { generateAndStoreImage } from '@/lib/images/image-service'
import { getSession } from '@/lib/auth/session'

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getSession()
        if (!session || (session.role !== 'ADMIN' && session.role !== 'EDITOR')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // BUG FIX (2026-09-02): `params` is a Promise in this Next.js
        // version - the old code read `params.id` directly (always
        // undefined on a Promise object), so db.article.findUnique({
        // where: { id: undefined } }) threw a Prisma validation error on
        // EVERY call. This is why "Regenerate Image" never worked at all.
        const { id } = await params

        const article = await db.article.findUnique({
            where: { id }
        })

        if (!article) {
            return NextResponse.json({ error: 'Article not found' }, { status: 404 })
        }

        // Generate a fresh image, verify it and store it locally. Passing
        // `content` lets it use the AI-reasoned prompt (grounded in what
        // the article is actually about) instead of just the generic
        // category+excerpt template - matches the other generation entry
        // points (fixed 2026-09-01/02).
        const stored = await generateAndStoreImage(article.title, undefined, {
            category: article.category,
            excerpt: article.excerpt,
            content: article.content,
        })

        if (!stored.localPath) {
            return NextResponse.json({ error: 'Failed to generate valid image' }, { status: 500 })
        }

        const updatedArticle = await db.article.update({
            where: { id },
            data: {
                featuredImageUrl: stored.localPath,
                imageSource: stored.source
            }
        })

        return NextResponse.json({
            success: true,
            imageUrl: stored.localPath,
            article: updatedArticle
        })

    } catch (error) {
        console.error('Image repair failed:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
