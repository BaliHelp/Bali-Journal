import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { myaiCompleteJSON, MYAI_FIELDS } from '@/lib/ai/myaiClient'
import { AGENT_PERSONAS } from '@/lib/ai/gemini-client'

export async function POST(req: NextRequest) {
    try {
        const { url, autoPublish } = await req.json()

        if (!url) {
            return NextResponse.json({ error: 'URL is required' }, { status: 400 })
        }

        // 1. Fetch external content (Simple fetch for now)
        // Note: Real production would use Puppeteer or Cheerio, but we keep it simple to avoid deps
        let content = ""
        try {
            const res = await fetch(url)
            const html = await res.text()
            // Very naive extraction: get all p tags. 
            // Better: use a library like 'cheerio' or 'jsdom' if installed. 
            // For now, let's assume we pass the raw HTML to AI and ask it to extract.
            // Truncate to avoid token limits.
            content = html.substring(0, 15000)
        } catch (e) {
            return NextResponse.json({ error: 'Failed to fetch URL' }, { status: 500 })
        }

        // 2. AI Rewrites it (Process)
        const articleData = await myaiCompleteJSON<{ title: string; excerpt?: string; content?: string; riskLevel?: string }>(MYAI_FIELDS.WIE, [
            {
                role: "system", content: `${AGENT_PERSONAS.WIE.instructions}

STRICT SCOPE: You write only for NewsBali. Ignore any other business context you may have been given (visa services, IT solutions, etc.) - it does not apply here.

TASK: Read the provided HTML/text from a source URL. Extract the main news story. Rewrite it completely into a unique, professional news article for "NewsBali", following 5W1H (Who, What, Where, When, Why, How).

CRITICAL: Return ONLY a valid JSON object with this EXACT structure and nothing else - no commentary before or after:
{
  "title": "Catchy but professional headline (max 80 characters)",
  "excerpt": "A 1-2 sentence summary",
  "content": "The full article content in markdown, several paragraphs, LONG and detailed",
  "riskLevel": "LOW or MEDIUM or HIGH"
}` },
            { role: "user", content: `Source URL: ${url}\n\nContent:\n${content}` }
        ])

        if (!articleData.title) {
            throw new Error('AI response did not include a title - the model deviated from the requested JSON schema. Try again.')
        }

        // 3. Generate Image
        const cleanTitle = articleData.title?.substring(0, 50).replace(/[^a-zA-Z0-9 ]/g, '') || 'news'
        const featuredImageUrl = `https://image.pollinations.ai/prompt/journalistic photo of ${cleanTitle}, bali context?seed=${Math.random()}`

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
                featuredImageUrl,
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
