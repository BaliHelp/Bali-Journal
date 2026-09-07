import { myaiCompleteJSON } from '@/lib/ai/myaiClient'
import { db } from '@/lib/db'
import { Category, RiskLevel, Verification, Status } from '@prisma/client'
import { generateAndStoreImage, insertInlineImages } from '@/lib/images/image-service'
import { TITLE_DIVERSITY_RULES, pickWritingStyle } from '@/lib/ai/journalism-style'
import { analyzeLegalRisk, repairCriticalRisk } from '@/lib/ai/legal-risk'



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

// ---------------------------------------------------------------------------
// Opening-word repetition. TITLE_DIVERSITY_RULES (journalism-style.ts) rule
// #3 tells the model to never open two consecutive headlines with the same
// word ("Bali", "New", etc.) - but that instruction alone doesn't work,
// because every generation call here is a separate, stateless API request
// with no memory of what any OTHER call in the same batch produced. The
// model has nothing real to check its own draft against, so it just falls
// back to its single strongest default ("Bali's ...") on nearly every call -
// confirmed as a real, near-universal pattern in the published backlog
// (2026-09-08). Fixed by computing the actual opening words from REAL
// recent titles and handing that list to the model as a concrete
// constraint, instead of relying on it to enforce a vague rule with no data
// to enforce it against.
// ---------------------------------------------------------------------------

/** Most recently created titles across ALL categories, most-recent-first - used only for buildAvoidOpeningWordsRule() below. Separate from getExistingTitlesForCategory(), which is per-category and used for topic-dedup, not opening-word variety (the "Bali's ..." pattern shows up across every category equally, so the signal needs to be site-wide, not category-scoped). */
export async function getRecentTitlesForOpeningCheck(limit = 15): Promise<string[]> {
    const recent = await db.article.findMany({
        where: { status: { in: ['PUBLISHED', 'DRAFT'] } },
        select: { title: true },
        take: limit,
        orderBy: { createdAt: 'desc' },
    })
    return recent.map((a) => a.title)
}

/** The actual set of banned opening words, shared between the prompt-text builder below and generateNewsArticles()'s real post-generation check - a prompt instruction alone was tested and found to only work ~2/3 of the time (the model still opened with a banned word on the remaining 1/3), so this same list also drives a real retry, not just a request. */
export function getBannedOpeningWords(titles: string[], sampleSize = 15): Set<string> {
    const firstWords = titles
        .slice(0, sampleSize)
        .map((t) => t.trim().split(/\s+/)[0]?.replace(/[^a-zA-Z']/g, ''))
        .filter((w): w is string => !!w)
    return new Set(firstWords.map((w) => w.toLowerCase()))
}

/** Builds a prompt block banning the new headline's first word from matching any of the most recent titles' first words. Returns '' if `titles` is empty (nothing to compare against yet). */
export function buildAvoidOpeningWordsRule(titles: string[], sampleSize = 15): string {
    const banned = getBannedOpeningWords(titles, sampleSize)
    if (banned.size === 0) return ''
    return `\n\nHEADLINE OPENING WORDS ALREADY USED (most recent headlines published/drafted on this outlet) - your new headline's FIRST WORD must be different from every one of these: ${[...banned].join(', ')}. This is a hard constraint, not a suggestion - if your first draft starts with one of these words (very likely "Bali" or "Bali's"), rewrite the opening using a different structural approach from the HEADLINE VARIETY list above (e.g. lead with the specific place, institution, number, or action instead).\n`
}

/** True if `title`'s first word is one of the recently-overused opening words - used to trigger a real retry, since the prompt instruction alone doesn't always get followed. */
export function startsWithBannedWord(title: string, bannedWords: Set<string>): boolean {
    const firstWord = title.trim().split(/\s+/)[0]?.replace(/[^a-zA-Z']/g, '').toLowerCase()
    return !!firstWord && bannedWords.has(firstWord)
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

export async function generateArticleContent(category: Category, avoidTitles: string[] = [], recentTitlesForOpening: string[] = []): Promise<GeneratedArticle> {
    const avoidBlock = avoidTitles.length
        ? `\n\nALREADY COVERED - DO NOT repeat these topics/angles, pick something genuinely different:\n${avoidTitles.map((t) => `- "${t}"`).join('\n')}\n`
        : ''
    const avoidOpeningWordsBlock = buildAvoidOpeningWordsRule(recentTitlesForOpening)

    const prompt = `You are a Senior Investigative Journalist for Bali Journal, a prestigious English-language news outlet in Indonesia.

    TASK: Write a comprehensive, high-quality news article based on REAL or HIGHLY REALISTIC CURRENT TRENDS in Bali.

    SPECIFICATIONS:
    - Category: ${category}
    - Focus: ${CATEGORY_GUIDELINES[category]}
    - Length: LONG FORM (800-1200 words equivalent).
    ${avoidBlock}
    ${pickWritingStyle().rules}

    ${TITLE_DIVERSITY_RULES}
    ${avoidOpeningWordsBlock}

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

export async function generateNewsArticles(
    count: number = 3,
    authorId: string,
    status: Status = 'PUBLISHED',
    categoryOverride?: Category
) {
    const articles: any[] = []

    for (let i = 0; i < count; i++) {
        try {
            const category = categoryOverride ?? selectRandomCategory()
            const existingTitles = await getExistingTitlesForCategory(category)
            // Re-fetched every iteration (not once before the loop) so it
            // self-corrects WITHIN a single batch too - if article #1 in
            // this run opens with "Bali's ...", article #2's fetch already
            // includes it and bans that opener again, not just across
            // separate runs/days.
            const recentTitlesForOpening = await getRecentTitlesForOpeningCheck()

            const bannedOpeningWords = getBannedOpeningWords(recentTitlesForOpening)

            let generated = await generateArticleContent(category, existingTitles, recentTitlesForOpening)
            let collision = findSimilarTitle(generated.title, existingTitles)
            let bannedOpener = startsWithBannedWord(generated.title, bannedOpeningWords)
            let attempts = 1

            // Retry on EITHER a topic collision (same angle already covered)
            // or a banned opening word (the model ignored the prompt-level
            // instruction and opened with "Bali's ..." anyway - confirmed
            // via live testing this happens on roughly 1 in 3 calls even
            // with the instruction present, so the instruction alone isn't
            // enough; this makes it a real, enforced retry instead of just
            // a request).
            const avoidList = [...existingTitles]
            while ((collision || bannedOpener) && attempts < MAX_TITLE_RETRY_ATTEMPTS) {
                console.warn(
                    collision
                        ? `Title too similar to existing "${collision}" - retrying (attempt ${attempts + 1}/${MAX_TITLE_RETRY_ATTEMPTS})`
                        : `Title opens with an overused word ("${generated.title.split(/\s+/)[0]}") - retrying (attempt ${attempts + 1}/${MAX_TITLE_RETRY_ATTEMPTS})`
                )
                avoidList.push(generated.title)
                generated = await generateArticleContent(category, avoidList, recentTitlesForOpening)
                collision = findSimilarTitle(generated.title, avoidList)
                bannedOpener = startsWithBannedWord(generated.title, bannedOpeningWords)
                attempts++
            }

            if (collision) {
                console.error(`Skipping article: could not produce a distinct title after ${MAX_TITLE_RETRY_ATTEMPTS} attempts (still similar to "${collision}")`)
                continue
            }
            if (bannedOpener) {
                // Not worth skipping the whole article over - a repeated
                // opening word is a style nit, not a duplicate/quality
                // problem. Log it and let the article through as-is.
                console.warn(`Publishing "${generated.title}" despite an overused opening word after ${MAX_TITLE_RETRY_ATTEMPTS} attempts - style nit, not blocking.`)
            }

            // Proper legal-risk analysis (categories + recommendations),
            // replacing the self-reported riskLevel from the generation call
            // above - that one only ever offers LOW/MEDIUM/HIGH (no
            // CRITICAL option in its own schema) and can't drive a repair
            // loop since it has no category breakdown. Only CRITICAL is
            // acted on here (per user decision) - HIGH publishes normally,
            // since a human hasn't reviewed anything this pipeline produces
            // before it goes out, so CRITICAL is the one tier worth an
            // automatic hold-and-fix instead of trusting it straight through.
            let riskAnalysis = await analyzeLegalRisk(generated.content, generated.title)
            let finalStatus = status
            if (riskAnalysis.riskLevel === 'CRITICAL') {
                const repair = await repairCriticalRisk(
                    { title: generated.title, excerpt: generated.excerpt, content: generated.content },
                    riskAnalysis,
                    category
                )
                generated = { ...generated, title: repair.title, excerpt: repair.excerpt, content: repair.content }
                riskAnalysis = repair.riskAnalysis
                if (!repair.resolved) {
                    console.warn(`Article "${generated.title}" still CRITICAL after ${repair.attempts} repair attempt(s) - holding as DRAFT for manual review.`)
                    finalStatus = 'DRAFT'
                }
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
                    riskLevel: riskAnalysis.riskLevel,
                    riskScore: riskAnalysis.riskScore,
                    containsAccusation: riskAnalysis.containsAccusation,
                    verificationLevel: generated.verificationLevel,
                    evidenceCount: generated.evidenceCount,
                    legalReviewRequired: riskAnalysis.requiresLegalReview,
                    status: finalStatus,
                    authorId,
                    publishedAt: finalStatus === 'PUBLISHED' ? publishedAt : null,
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
