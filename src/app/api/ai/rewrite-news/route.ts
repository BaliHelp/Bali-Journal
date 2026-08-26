import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { myaiCompleteJSON, MYAI_FIELDS } from '@/lib/ai/myaiClient'
import { AGENT_PERSONAS } from '@/lib/ai/gemini-client'
import { generateAndStoreImage } from '@/lib/images/image-service'
import { NEWS_STYLE_RULES } from '@/lib/ai/journalism-style'
import { getSession } from '@/lib/auth/session'

export async function POST(req: NextRequest) {
    try {
        const session = await getSession()
        if (!session || (session.role !== 'ADMIN' && session.role !== 'EDITOR')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { url, autoPublish } = await req.json()

        if (!url) {
            return NextResponse.json({ error: 'URL is required' }, { status: 400 })
        }

        // 1. Fetch external content - plain server-side fetch, no browser
        // rendering and no vision model involved. JS-heavy sites that render
        // their article body client-side won't extract cleanly this way.
        //
        // Was previously feeding the AI 15000 raw HTML characters truncated
        // by byte count (not tag-aware) - confirmed via direct testing this
        // regularly broke the AI's JSON output ("Unterminated string in
        // JSON") because raw markup (scripts, styles, nav/ad boilerplate,
        // unescaped quotes) doesn't truncate or embed into a JSON string
        // cleanly. Strip to plain text first so the model gets the actual
        // article prose instead of markup soup.
        let content = ""
        try {
            const res = await fetch(url, {
                headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BaliJournalBot/1.0)' },
                signal: AbortSignal.timeout(20_000),
            })
            const html = await res.text()
            content = html
                .replace(/<script[\s\S]*?<\/script>/gi, ' ')
                .replace(/<style[\s\S]*?<\/style>/gi, ' ')
                .replace(/<!--[\s\S]*?-->/g, ' ')
                .replace(/<[^>]+>/g, ' ')
                .replace(/&nbsp;|&amp;|&quot;|&#39;|&lt;|&gt;/g, ' ')
                .replace(/\s+/g, ' ')
                .trim()
                .slice(0, 8000)

            if (content.length < 200) {
                return NextResponse.json(
                    { error: 'Extracted content too short - this page likely renders its article via JavaScript, which a plain server-side fetch cannot execute.' },
                    { status: 422 }
                )
            }
        } catch (e) {
            return NextResponse.json({ error: 'Failed to fetch URL' }, { status: 500 })
        }

        // 2. AI Rewrites it (Process)
        const articleData = await myaiCompleteJSON<{ title: string; excerpt?: string; content?: string; riskLevel?: string }>('chatbot', [
            {
                role: "system", content: `${AGENT_PERSONAS.WIE.instructions}

STRICT SCOPE: You write only for Bali Journal. Ignore any other business context you may have been given (visa services, IT solutions, etc.) - it does not apply here.

TASK: Read the provided HTML/text from a source URL. Extract the main news story. Rewrite it completely into a unique, professional news article for "Bali Journal", following 5W1H (Who, What, Where, When, Why, How) as your internal outline.

${NEWS_STYLE_RULES}

CRITICAL: Regardless of what language the source material is written in, you MUST write the
article in English and respond with EXACTLY these JSON field names in English - never
translate/rename them. Return ONLY a valid JSON object with this EXACT structure and nothing
else - no commentary before or after:
{
  "title": "Catchy but professional headline (max 80 characters)",
  "excerpt": "A 1-2 sentence summary",
  "content": "The full article content as HTML (<p>, <h3>), several paragraphs, LONG and detailed",
  "riskLevel": "LOW or MEDIUM or HIGH"
}` },
            // Same "Raw Data:"/"Source:...Content:" framing issue as
            // process-raw-data - confirmed via direct testing this makes
            // content_journalist return an empty {}. Plain "write about"
            // framing works reliably.
            { role: "user", content: `Write a news article about the story described in this source material (from ${url}):\n\n${content}` }
        // Pin gpt-4o-mini directly instead of letting content_journalist's
        // tier routing pick a model - confirmed via testing that field can
        // get hijacked into a different schema/language on this kind of
        // "process this source content" prompt (see myaiClient.ts).
        ], 'gpt-4o-mini')

        if (!articleData.title) {
            throw new Error('AI response did not include a title - the model deviated from the requested JSON schema. Try again.')
        }

        // 3. Generate Image (verified binary, stored locally — stable URL forever)
        const storedImage = await generateAndStoreImage(articleData.title, undefined, {
            category: 'LOCAL',
            excerpt: articleData.excerpt,
        })

        // 4. Save
        const slug = articleData.title.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Math.random().toString(36).substring(7)

        const newArticle = await db.article.create({
            data: {
                title: articleData.title,
                slug: slug,
                excerpt: articleData.excerpt || "No excerpt",
                content: articleData.content || "No content",
                category: "LOCAL", // Default or extract from AI
                authorId: (await db.user.findFirst())?.id || "admin", // Fallback
                status: autoPublish ? 'PUBLISHED' : 'DRAFT',
                publishedAt: autoPublish ? new Date() : null,
                aiAssisted: true,
                featuredImageUrl: storedImage.localPath,
                featuredImageAlt: articleData.title,
                imageSource: storedImage.source,
                sourceUrl: url,
                verificationLevel: 'MEDIUM'
            }
        })

        // Log activity
        await db.aiActivityLog.create({
            data: {
                action: 'rewrite',
                sourceUrl: url,
                articleId: newArticle.id,
                success: true,
                metadata: { originalUrl: url }
            }
        })

        return NextResponse.json({ success: true, article: newArticle })

    } catch (error: any) {
        console.error('Rewrite Error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
