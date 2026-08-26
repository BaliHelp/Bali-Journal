
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { generateAndStoreImage } from '@/lib/images/image-service'
import { getSession } from '@/lib/auth/session'

export async function POST(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getSession()
        if (!session || (session.role !== 'ADMIN' && session.role !== 'EDITOR')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const article = await db.article.findUnique({
            where: { id: params.id }
        })

        if (!article) {
            return NextResponse.json({ error: 'Article not found' }, { status: 404 })
        }

        // Generate a fresh image, verify it and store it locally.
        const stored = await generateAndStoreImage(article.title, undefined, {
            category: article.category,
            excerpt: article.excerpt,
        })

        if (!stored.localPath) {
            return NextResponse.json({ error: 'Failed to generate valid image' }, { status: 500 })
        }

        const updatedArticle = await db.article.update({
            where: { id: params.id },
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
