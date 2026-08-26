import { NextResponse } from 'next/server'
import { myaiCompleteJSON, MYAI_FIELDS } from '@/lib/ai/myaiClient'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth/session'
import { generateAndStoreImage } from '@/lib/images/image-service'
import { NEWS_STYLE_RULES } from '@/lib/ai/journalism-style'

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
        // NOTE: intentionally NOT MYAI_FIELDS.WIE (content_journalist) -
        // confirmed via direct testing that field ignores our JSON schema
        // and responds in a hijacked Indonesian schema (judul/artikel/...)
        // for this raw-data-processing task specifically, most likely
        // cross-contamination from another app sharing that field on the
        // gateway. 'chatbot' (GPT-4o-mini) follows the requested schema
        // reliably instead.
        const result = await myaiCompleteJSON(MYAI_FIELDS.WIE, [
            {
                role: "system",
                content: `You are a senior editor at NewsBali. You are given raw data, notes, or a press release.
                Your task is to transform this into a professional, journalistic news article, using the 5W1H standard (Who, What, Where, When, Why, How) as your internal outline only.

                ${NEWS_STYLE_RULES}

                CRITICAL: Regardless of what language the raw data below is written in (it may be
                Indonesian), you MUST write the article in English and respond with EXACTLY these
                JSON field names in English - never translate/rename them (e.g. never "judul",
                "artikel", "ringkasan", "isi"). Return ONLY a valid JSON object with this EXACT flat
                structure - no nested objects, no commentary before or after:
                {
                    "title": "A captivating, journalistic headline",
                    "slug": "kebab-case-slug-optimized-for-seo",
                    "excerpt": "A concise summary (max 160 chars)",
                    "content": "The full article content in HTML format. Use <p>, <h3> (sparingly), <ul>, <li>. Do not use <h1> or <h2>.",
                    "category": "One of: TOURISM, INVESTMENT, INCIDENTS, LOCAL, JOBS, OPINION",
                    "riskLevel": "LOW"
                }

                Tone: Professional, Objective, Informative.
                Language: English.`
            },
            {
                // "Raw Data:" (and similar "Source material:"/"Content:"
                // framings) confirmed via direct testing to make this field
                // return an EMPTY {} - some guardrail/cross-app collision on
                // the gateway triggers on that framing specifically. Framing
                // it as a normal writing request works reliably instead.
                role: "user",
                content: `Write a news article based on the following information:\n${content}`
            }
        ])

        if (!result.title || !result.slug) {
            throw new Error('AI response did not include a title/slug - the model deviated from the requested JSON schema. Try again.')
        }

        // 2. Generate Image (verified binary, stored locally — stable URL forever)
        const storedImage = await generateAndStoreImage(result.title, undefined, {
            category: result.category,
            excerpt: result.excerpt,
        })

        // 3. Create Article
        const article = await db.article.create({
            data: {
                title: result.title,
                slug: `${result.slug}-${Date.now()}`,
                excerpt: result.excerpt,
                content: result.content, // HTML content
                category: result.category,
                featuredImageUrl: storedImage.localPath,
                featuredImageAlt: result.title,
                imageSource: storedImage.source,
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
