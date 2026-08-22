import { NextResponse } from 'next/server'
import { myaiCompleteJSON, MYAI_FIELDS } from '@/lib/ai/myaiClient'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth/session'

export async function POST(request: Request) {
    try {
        const session = await getSession()
        if (!session || (session.role !== 'ADMIN' && session.role !== 'EDITOR')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { content, autoPublish } = await request.json()

        if (!content || content.length < 10) {
            return NextResponse.json({ error: 'Content is too short' }, { status: 400 })
        }

        // 1. Analyze and Structure with 5W1H
        const result = await myaiCompleteJSON(MYAI_FIELDS.WIE, [
            {
                role: "system",
                content: `You are a senior editor at NewsBali. You are given raw data, notes, or a press release.
                Your task is to transform this into a professional, journalistic news article adhering to the 5W1H standard (Who, What, Where, When, Why, How).

                The output must be a valid JSON object with the following structure:
                {
                    "title": "A captivating, journalistic headline",
                    "slug": "kebab-case-slug-optimized-for-seo",
                    "excerpt": "A concise summary (max 160 chars)",
                    "content": "The full article content in HTML format. Use <h2>, <p>, <ul>, <li>. Do not use <h1>. Ensure 5W1H are covered early in the text.",
                    "category": "One of: TOURISM, INVESTMENT, INCIDENTS, LOCAL, JOBS, OPINION",
                    "riskLevel": "LOW",
                    "fiveWOneH": {
                        "who": "...",
                        "what": "...",
                        "where": "...",
                        "when": "...",
                        "why": "...",
                        "how": "..."
                    }
                }

                Tone: Professional, Objective, Informative.
                Language: English.`
            },
            {
                role: "user",
                content: `Raw Data:\n${content}`
            }
        ])

        if (!result.title || !result.slug) {
            throw new Error('AI response did not include a title/slug - the model deviated from the requested JSON schema. Try again.')
        }

        // 2. Generate Image
        const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(result.title + ' Bali news realistic')}?width=1200&height=800&nologo=true`

        // 3. Create Article
        const article = await db.article.create({
            data: {
                title: result.title,
                slug: `${result.slug}-${Date.now()}`,
                excerpt: result.excerpt,
                content: result.content, // HTML content
                category: result.category,
                featuredImageUrl: imageUrl,
                featuredImageAlt: result.title,
                imageSource: 'AI Generated',
                aiAssisted: true,
                riskLevel: 'LOW', // Default, assuming editor checks
                status: autoPublish ? 'PUBLISHED' : 'DRAFT',
                authorId: session.id,
                publishedAt: autoPublish ? new Date() : null
            }
        })

        // 4. Log Activity
        await db.aiActivityLog.create({
            data: {
                action: 'process-raw-data',
                category: result.category,
                articleId: article.id,
                success: true,
                metadata: {
                    sourceLength: content.length,
                    fiveWOneH: result.fiveWOneH
                }
            }
        })

        return NextResponse.json({ success: true, article })

    } catch (error) {
        console.error('Error processing raw data:', error)
        return NextResponse.json(
            { error: 'Failed to process raw data', details: error instanceof Error ? error.message : 'Unknown' },
            { status: 500 }
        )
    }
}
