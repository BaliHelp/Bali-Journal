import { myaiCompleteJSON } from '@/lib/ai/myaiClient'
import { db } from '@/lib/db'
import { Category, RiskLevel, Verification, Status } from '@prisma/client'
import { generateAndStoreImage, insertInlineImages } from '@/lib/images/image-service'
import { TITLE_DIVERSITY_RULES, pickWritingStyle } from '@/lib/ai/journalism-style'



interface GeneratedArticle {
    title: string
    excerpt: string
    content: string
    riskLevel: RiskLevel
    verificationLevel: Verification
    evidenceCount: number
}

const CATEGORIES: Category[] = ['TOURISM', 'GOVERNMENT', 'INVESTMENT', 'INCIDENTS', 'LOCAL', 'JOBS', 'OPINION']

// Weighted category distribution
const CATEGORY_WEIGHTS = {
    TOURISM: 25,
    GOVERNMENT: 20,
    INVESTMENT: 15,
    LOCAL: 15,
    JOBS: 10,
    INCIDENTS: 10,
    OPINION: 5,
}

function selectRandomCategory(): Category {
    const totalWeight = Object.values(CATEGORY_WEIGHTS).reduce((a, b) => a + b, 0)
    let random = Math.random() * totalWeight

    for (const [category, weight] of Object.entries(CATEGORY_WEIGHTS)) {
        random -= weight
        if (random <= 0) {
            return category as Category
        }
    }

    return 'TOURISM' // fallback
}

function generateSlug(title: string): string {
    return title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .substring(0, 100)
}

// ---------------------------------------------------------------------------
// Duplicate-title prevention. Audit of the published backlog (2026-08-26)
// found 12 near-duplicate title pairs out of 49 articles - same topic,
// reworded headline ("Job Market Blooms" / "Blossoms" / "Expansion"), which
// is also why their generated photos looked near-identical: same category +
// same excerpt content -> same image prompt inputs, regardless of which
// generator produced it. The real fix is catching this at generation time,
// not just varying the image afterward.
// ---------------------------------------------------------------------------

const TITLE_SIMILARITY_THRESHOLD = 0.5 // jaccard word-overlap; matches the audit's flagging threshold
const MAX_TITLE_RETRY_ATTEMPTS = 3

function titleWords(title: string): Set<string> {
    return new Set(
        title.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((w) => w.length > 3)
    )
}

export function titleSimilarity(a: string, b: string): number {
    const setA = titleWords(a)
    const setB = titleWords(b)
    const intersection = [...setA].filter((w) => setB.has(w)).length
    const union = new Set([...setA, ...setB]).size
    return union === 0 ? 0 : intersection / union
}

/** Existing titles in this category (published or draft) that a new article must not echo. */
export async function getExistingTitlesForCategory(category: Category): Promise<string[]> {
    const existing = await db.article.findMany({
        where: { category, status: { in: ['PUBLISHED', 'DRAFT'] } },
        select: { title: true },
        take: 200,
        orderBy: { createdAt: 'desc' },
    })
    return existing.map((a) => a.title)
}

export function findSimilarTitle(candidate: string, existingTitles: string[]): string | null {
    for (const existing of existingTitles) {
        if (titleSimilarity(candidate, existing) >= TITLE_SIMILARITY_THRESHOLD) return existing
    }
    return null
}

const CATEGORY_GUIDELINES = {
    TOURISM: 'tourism industry, hotels, festivals, cultural attractions, visitor experiences',
    GOVERNMENT: 'Bali provincial government policies, Governor statements, regulations, public services, key Jakarta updates affecting Bali',
    INVESTMENT: 'business investments, startups, funding rounds, economic development, venture capital',
    INCIDENTS: 'accidents, natural disasters, emergencies, safety alerts, volcanic activity',
    LOCAL: 'community initiatives, local government programs, cultural preservation, infrastructure',
    JOBS: 'employment opportunities, job fairs, training programs, career development',
    OPINION: 'expert commentary, cultural analysis, social issues, policy discussions',
}

async function generateArticleContent(category: Category, avoidTitles: string[] = []): Promise<GeneratedArticle> {
    const avoidBlock = avoidTitles.length
        ? `\n\nALREADY COVERED - DO NOT repeat these topics/angles, pick something genuinely different:\n${avoidTitles.map((t) => `- "${t}"`).join('\n')}\n`
        : ''

    const prompt = `You are a Senior Investigative Journalist for Bali Journal, a prestigious English-language news outlet in Indonesia.

    TASK: Write a comprehensive, high-quality news article based on REAL or HIGHLY REALISTIC CURRENT TRENDS in Bali.

    SPECIFICATIONS:
    - Category: ${category}
    - Focus: ${CATEGORY_GUIDELINES[category]}
    - Length: LONG FORM (800-1200 words equivalent).
    ${avoidBlock}
    ${pickWritingStyle().rules}

    ${TITLE_DIVERSITY_RULES}

    CONTENT RULES:
    - **REALISM**: Use REAL locations (specific streets in Canggu, offices in Renon, temples, etc.). Use REAL titles of officials (e.g., Governor, Head of Tourism Board).
    - **NO FAKE NEWS**: Do not invent disasters or crimes unless generating for "INCIDENTS". Focus on factual trends (e.g., Traffic congestion in Canggu, New Visa rules, Investment boom in Uluwatu).

    CRITICAL: Return ONLY a valid JSON object with this EXACT structure:
    {
      "title": "Catchy but Professional Headline (Max 80 characters)",
      "excerpt": "A powerful summary of the article in 2 sentences.",
      "content": "The full formatted HTML content. It must be LONG and detailed.",
      "riskLevel": "LOW or MEDIUM or HIGH",
      "verificationLevel": "MEDIUM or HIGH",
      "evidenceCount": 3-5
    }
    `

    try {
        // 'chatbot' + gpt-4o-mini pinned, not MYAI_FIELDS.WIE
        // (content_journalist) - that field is confirmed hijacked/broken
        // (returns empty {} or a different schema/language), same fix
        // already applied to rewrite-external-news.ts/process-raw-data.
        const result = await myaiCompleteJSON('chatbot', [
            {
                role: 'system',
                content: 'You are an award-winning journalist. Output strictly valid JSON.'
            },
            {
                role: 'user',
                content: prompt
            }
        ], 'gpt-4o-mini')

        return {
            title: result.title,
            excerpt: result.excerpt,
            content: result.content,
            riskLevel: result.riskLevel as RiskLevel,
            verificationLevel: result.verificationLevel as Verification,
            evidenceCount: result.evidenceCount || 0,
        }
    } catch (error) {
        console.error('Error generating article:', error)
        throw new Error('Failed to generate article content')
    }
}

export async function generateNewsArticles(count: number = 3, authorId: string, status: Status = 'PUBLISHED') {
    const articles: any[] = []

    for (let i = 0; i < count; i++) {
        try {
            const category = selectRandomCategory()
            const existingTitles = await getExistingTitlesForCategory(category)

            let generated = await generateArticleContent(category, existingTitles)
            let collision = findSimilarTitle(generated.title, existingTitles)
            let attempts = 1

            // Retry with the colliding title(s) added to the avoid-list -
            // this is what stops the model from just picking the same
            // recurring angle again (e.g. "boost sustainable tourism") every
            // time this category comes up.
            const avoidList = [...existingTitles]
            while (collision && attempts < MAX_TITLE_RETRY_ATTEMPTS) {
                console.warn(`Title too similar to existing "${collision}" - retrying (attempt ${attempts + 1}/${MAX_TITLE_RETRY_ATTEMPTS})`)
                avoidList.push(generated.title)
                generated = await generateArticleContent(category, avoidList)
                collision = findSimilarTitle(generated.title, avoidList)
                attempts++
            }

            if (collision) {
                console.error(`Skipping article: could not produce a distinct title after ${MAX_TITLE_RETRY_ATTEMPTS} attempts (still similar to "${collision}")`)
                continue
            }

            // Generate unique slug
            const baseSlug = generateSlug(generated.title)
            let slug = baseSlug
            let counter = 1

            // Ensure slug is unique
            while (await db.article.findUnique({ where: { slug } })) {
                slug = `${baseSlug}-${counter}`
                counter++
            }

            // Random publish time within the last 24 hours
            const hoursAgo = Math.floor(Math.random() * 24)
            const publishedAt = new Date(Date.now() - hoursAgo * 3600000)

            // Generate, verify and STORE the image locally.
            // The DB receives a stable "/uploads/articles/..." path — no more
            // fragile third-party hotlinks that expire or get rate-limited.
            const stored = await generateAndStoreImage(generated.title, undefined, {
                category,
                excerpt: generated.excerpt,
                content: generated.content,
            })

            // Additional images placed inside the article body itself (not
            // just the one featuredImageUrl banner) - each generated from
            // the specific paragraph it sits next to, so it actually
            // illustrates that section rather than just repeating the
            // headline photo further down the page.
            const contentWithInlineImages = await insertInlineImages(
                generated.content,
                generated.title,
                category
            )

            const article = await db.article.create({
                data: {
                    title: generated.title,
                    slug,
                    excerpt: generated.excerpt,
                    content: contentWithInlineImages,
                    category,
                    featuredImageUrl: stored.localPath, // null only if every source failed
                    featuredImageAlt: generated.title,
                    imageSource: stored.source,
                    aiAssisted: true, // Mark as AI-generated
                    riskLevel: generated.riskLevel,
                    riskScore: generated.riskLevel === 'HIGH' ? 70 : generated.riskLevel === 'MEDIUM' ? 40 : 15,
                    containsAccusation: false,
                    verificationLevel: generated.verificationLevel,
                    evidenceCount: generated.evidenceCount,
                    legalReviewRequired: generated.riskLevel === 'HIGH',
                    status: status,
                    authorId,
                    publishedAt,
                },
            })

            articles.push(article)

            // Small delay between generations to avoid rate limits
            if (i < count - 1) {
                await new Promise(resolve => setTimeout(resolve, 1000))
            }
        } catch (error) {
            console.error(`Failed to generate article ${i + 1}:`, error)
            // Continue with next article
        }
    }

    return articles
}
