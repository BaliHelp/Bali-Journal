import { myaiCompleteJSON, MYAI_FIELDS } from '@/lib/ai/myaiClient'
import { db } from '@/lib/db'
import { Category, RiskLevel, Verification, Status } from '@prisma/client'
import { validateImageUrl } from '@/lib/ai/image-validator'



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

const CATEGORY_GUIDELINES = {
    TOURISM: 'tourism industry, hotels, festivals, cultural attractions, visitor experiences',
    GOVERNMENT: 'Bali provincial government policies, Governor statements, regulations, public services, key Jakarta updates affecting Bali',
    INVESTMENT: 'business investments, startups, funding rounds, economic development, venture capital',
    INCIDENTS: 'accidents, natural disasters, emergencies, safety alerts, volcanic activity',
    LOCAL: 'community initiatives, local government programs, cultural preservation, infrastructure',
    JOBS: 'employment opportunities, job fairs, training programs, career development',
    OPINION: 'expert commentary, cultural analysis, social issues, policy discussions',
}

async function generateArticleContent(category: Category): Promise<GeneratedArticle> {
    const prompt = `You are a Senior Investigative Journalist for NewsBali, a prestigious English-language news outlet in Indonesia.
    
    TASK: Write a comprehensive, high-quality news article based on REAL or HIGHLY REALISTIC CURRENT TRENDS in Bali.
    
    SPECIFICATIONS:
    - Category: ${category}
    - Focus: ${CATEGORY_GUIDELINES[category]}
    - Tone: Professional, Objective, Authoritative, Journalistic (Associated Press style).
    - Length: LONG FORM (800-1200 words equivalent via sections).
    - Structure: MUST follow the "Inverted Pyramid" + 5W 1H format.
    
    STRICT STRUCTURE (5-7 SECTIONS):
    1.  **LEAD (The Hook)**: summarises the 5W 1H (Who, What, Where, When, Why, How) in the first paragraph.
    2.  **THE FACTS (Body)**: Detailed breakdown of the event/topic.
    3.  **KEY QUOTES**: Include realistic quotes from officials, locals, or experts (e.g., "The Governor of Bali stated...", "Local business owner Wayan...").
    4.  **BACKGROUND/CONTEXT**: Historical context or what led to this.
    5.  **IMPACT**: How this affects tourism, economy, or locals.
    6.  **OPPOSING VIEWS** (if applicable): Balance the story.
    7.  **CONCLUSION/LOOKING AHEAD**: What happens next.
    
    CONTENT RULES:
    - **REALISM**: Use REAL locations (specific streets in Canggu, offices in Renon, temples, etc.). Use REAL titles of officials (e.g., Governor, Head of Tourism Board).
    - **NO FAKE NEWS**: Do not invent disasters or crimes unless generating for "INCIDENTS". Focus on factual trends (e.g., Traffic congestion in Canggu, New Visa rules, Investment boom in Uluwatu).
    - **Formatting**: Use HTML <p> tags for paragraphs, <h3> for section headers to break up the text.
    
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
        const result = await myaiCompleteJSON(MYAI_FIELDS.WIE, [
            {
                role: 'system',
                content: 'You are an award-winning journalist. Output strictly valid JSON.'
            },
            {
                role: 'user',
                content: prompt
            }
        ])

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
            const generated = await generateArticleContent(category)

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

            // Validate Image Logic
            // Clean title for better prompts
            const cleanTitle = generated.title.substring(0, 60).replace(/[^a-zA-Z0-9 ]/g, '')
            const seed = Math.floor(Math.random() * 100000)

            // Primary: Pollinations (High Quality)
            let imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent('journalistic photo ' + cleanTitle + ', bali context, realistic, 4k')}?width=1200&height=800&nologo=true&seed=${seed}`
            let isImageValid = await validateImageUrl(imageUrl)
            let imageAttempts = 0

            // Retry Pollinations with simpler prompt
            while (!isImageValid && imageAttempts < 2) {
                imageAttempts++
                const retrySeed = Math.floor(Math.random() * 100000)
                imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent('bali news ' + cleanTitle)}?width=1200&height=800&nologo=true&seed=${retrySeed}`
                isImageValid = await validateImageUrl(imageUrl)
            }

            // Fallback: LoremFlickr (Reliable)
            if (!isImageValid) {
                const keywords = cleanTitle.split(' ').slice(0, 2).join(',')
                imageUrl = `https://loremflickr.com/1200/800/${keywords}?lock=${seed}`
                // Assume LoremFlickr is valid or let next validation catch it, but usually it works
            }

            const article = await db.article.create({
                data: {
                    title: generated.title,
                    slug,
                    excerpt: generated.excerpt,
                    content: generated.content,
                    category,
                    // Use Pollinations AI for reliable image generation based on title
                    featuredImageUrl: imageUrl,
                    featuredImageAlt: generated.title,
                    imageSource: 'AI Generated',
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
