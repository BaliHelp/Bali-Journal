import fs from 'fs/promises'
import path from 'path'

/**
 * Centralised image pipeline for NewsBali.
 *
 * Generates an image via an external generator (Pollinations -> LoremFlickr
 * fallback), VERIFIES the binary response (content-type + minimum size),
 * stores the file under public/uploads/articles and returns a STABLE LOCAL
 * url (e.g. "/uploads/articles/foo-bar-123.jpg").
 *
 * Articles therefore never store fragile third-party hotlinks again —
 * once generated, the image lives on our own server.
 */

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads', 'articles')
const PUBLIC_PREFIX = '/uploads/articles'
const BROWSER_UA =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
const MIN_IMAGE_BYTES = 5000 // anything smaller is almost certainly an error page
const DOWNLOAD_TIMEOUT_MS = 45_000 // generators can legitimately be slow

export interface StoredImage {
    /** Local web path ("/uploads/articles/...") or null if every source failed */
    localPath: string | null
    /** Human-readable provenance stored in Article.imageSource */
    source: string
}

function cleanPromptText(input: string, max = 60): string {
    return (
        (input || 'bali news')
            .substring(0, max)
            .replace(/[^a-zA-Z0-9 ]/g, '')
            .trim() || 'bali news'
    )
}

function randomSeed(): number {
    return Math.floor(Math.random() * 1_000_000)
}

function buildPollinationsUrl(prompt: string): string {
    return `https://image.pollinations.ai/prompt/${encodeURIComponent(
        prompt
    )}?width=1200&height=800&nologo=true&seed=${randomSeed()}`
}

function extractKeywords(title: string): string {
    const ignored = ['bali', 'the', 'and', 'for', 'with', 'from', 'this', 'that', 'have', 'will']
    const words = title
        .toLowerCase()
        .replace(/[^a-z0-9 ]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length > 3 && !ignored.includes(w))
    return words.slice(0, 2).join(',') || 'bali,news'
}

// ---------------------------------------------------------------------------
// Prompt building - moved here from scripts/regenerate-images.ts so every
// caller (live generation AND repair scripts) shares one implementation
// instead of drifting into slightly different prompt logic.
// ---------------------------------------------------------------------------

/** Visual grounding per category so images actually look like the story they illustrate. */
const CATEGORY_VISUALS: Record<string, string> = {
    TOURISM: 'iconic Bali destination, tropical beach, temple or resort atmosphere',
    GOVERNMENT: 'official government office or press conference setting in Indonesia',
    INVESTMENT: 'modern business district, office towers, professional meeting',
    INCIDENTS: 'emergency response scene, rescue workers, safety perimeter',
    LOCAL: 'Balinese village community life, traditional ceremony, local market',
    JOBS: 'job fair crowd, professionals, training workshop room',
    OPINION: 'thoughtful editorial concept, person reading newspaper, city backdrop',
}

// Applied to every generated prompt - restricts generators from producing
// nudity/explicit content. This is a soft (prompt-level) guard only; it does
// NOT verify the actual output. See the vision-based post-generation gate
// (once GEMINI_API_KEY has usable credits) for the real enforcement layer.
const SAFE_CONTENT_CLAUSE =
    'fully clothed, professional attire, tasteful composition, appropriate for a general-audience news outlet, no nudity, no sexual content'

const PROMPT_STOPWORDS = new Set([
    'bali', 'this', 'that', 'with', 'from', 'have', 'will', 'their', 'about',
    'after', 'over', 'into', 'than', 'then', 'they', 'them', 'were', 'been',
    'more', 'most', 'also', 'said', 'says', 'amid', 'among', 'which', 'while',
    'announced', 'faces', 'rising', 'new', 'the', 'and', 'for', 'are',
])

/** The ~80% "what is this story about" half of the prompt - driven by the headline itself. */
function extractContentKeywords(text: string, max = 8): string {
    const words = (text || '')
        .toLowerCase()
        .replace(/[^a-z0-9 ]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length > 3 && !PROMPT_STOPWORDS.has(w))
    return [...new Set(words)].slice(0, max).join(', ')
}

/**
 * The ~20% "make this specific article's image unique" half of the prompt -
 * a short snippet lifted from the excerpt/short description. Two articles
 * with a similar headline in the same category would otherwise generate a
 * near-identical prompt (and therefore image) - this is what keeps them
 * apart, since the excerpt carries detail the headline alone doesn't.
 */
function shortExcerptSnippet(excerpt: string, maxWords = 6): string {
    const words = (excerpt || '')
        .replace(/[^a-zA-Z0-9 ]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length > 2)
    return words.slice(0, maxWords).join(' ')
}

// Randomized composition/angle modifiers. Two articles with a near-identical
// title+excerpt (same recurring topic, e.g. "boost sustainable tourism")
// would otherwise generate a near-identical prompt and therefore a
// near-identical looking photo, REGARDLESS of which generator produces it -
// this is a second line of defense on top of the title-duplicate check in
// news-generator.ts (which is the real fix; this just adds resilience for
// legitimately-similar topics that aren't duplicates).
const COMPOSITION_VARIANTS = [
    'wide establishing shot',
    'close-up detail shot',
    'over-the-shoulder perspective',
    'aerial/drone angle',
    'candid mid-action moment',
    'symmetrical formal composition',
]
const TIME_OF_DAY_VARIANTS = ['golden hour', 'overcast daylight', 'bright midday sun', 'blue hour dusk']

function randomFrom<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)]
}

/**
 * Builds the default image-generation prompt: ~80% driven by the headline
 * itself (what this story is actually about), ~20% a short snippet from the
 * excerpt/short description for extra uniqueness. Category adds visual
 * grounding (e.g. "government office" vs "tropical beach") on top of both,
 * and a randomized composition/lighting modifier adds a further layer of
 * visual variety between separately-generated images.
 * Exported so scripts/regenerate-images.ts can share this instead of keeping
 * its own copy.
 */
export function buildImagePrompt(title: string, category?: string, excerpt?: string): string {
    const categoryVisual = (category && CATEGORY_VISUALS[category]) || 'bali news, editorial photography'
    const titleContext = extractContentKeywords(title, 8)
    const excerptSnippet = shortExcerptSnippet(excerpt || '', 6)
    const composition = randomFrom(COMPOSITION_VARIANTS)
    const timeOfDay = randomFrom(TIME_OF_DAY_VARIANTS)

    return (
        `award-winning editorial news photograph, ${categoryVisual}, ` +
        `subject: ${titleContext}` +
        (excerptSnippet ? `, additional detail: ${excerptSnippet}` : '') +
        `, ${composition}, ${timeOfDay}, ` +
        `bali indonesia, photojournalism, natural lighting, sharp focus, high detail, ` +
        `${SAFE_CONTENT_CLAUSE}`
    ).slice(0, 480)
}

function extensionFor(contentType: string): string {
    if (contentType.includes('png')) return 'png'
    if (contentType.includes('webp')) return 'webp'
    if (contentType.includes('gif')) return 'gif'
    return 'jpg'
}

/** Downloads an image and only accepts genuine image binaries. */
async function downloadImage(
    url: string,
    timeoutMs: number = DOWNLOAD_TIMEOUT_MS
): Promise<{ buffer: Buffer; contentType: string } | null> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
        const res = await fetch(url, {
            signal: controller.signal,
            redirect: 'follow',
            headers: { 'User-Agent': BROWSER_UA, Accept: 'image/*' },
        })
        if (!res.ok) return null

        const contentType = res.headers.get('content-type') || ''
        if (!contentType.startsWith('image/')) return null

        const buffer = Buffer.from(await res.arrayBuffer())
        if (buffer.length < MIN_IMAGE_BYTES) return null

        return { buffer, contentType }
    } catch {
        return null
    } finally {
        clearTimeout(timer)
    }
}

/** Writes the image to disk and returns its public web path. */
async function persistImage(
    buffer: Buffer,
    contentType: string,
    baseName: string
): Promise<string> {
    await fs.mkdir(UPLOAD_DIR, { recursive: true })
    const safe =
        baseName
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '')
            .slice(0, 80) || 'image'
    const fileName = `${safe}-${randomSeed().toString(36)}.${extensionFor(contentType)}`
    await fs.writeFile(path.join(UPLOAD_DIR, fileName), buffer)
    return `${PUBLIC_PREFIX}/${fileName}`
}

// ---------------------------------------------------------------------------
// Generator rotation - a pool of independent "strategies" (each with its own
// internal fallback chain) so consecutive articles don't all come from the
// same source. Currently only Pollinations is wired in: it's the only
// generator with confirmed-working credentials right now. A Gemini
// (Nano Banana) strategy belongs here once GEMINI_API_KEY has usable
// billing credits (see src/lib/ai/providers/gemini.ts, not yet created) -
// push it into GENERATOR_POOL at the desired ratio (e.g. duplicate the
// pollinations entry twice for a 2:1 pollinations:gemini split) and rotation
// starts working automatically, no other changes needed here.
//
// UPDATE: a Gemini strategy is now wired in (2:1 pollinations:gemini, per
// the requested ratio) - but Gemini image generation needs a billing-enabled
// Google AI Studio account (confirmed: free tier's quota for image-output
// models is hard-capped at 0, not just rate-limited - see providers/gemini.ts).
// Until that's funded, generateImage() returns null and this strategy falls
// straight through to its own Pollinations/LoremFlickr fallback below - so
// rotation "works" today, it just silently skips Gemini's turn.
// ---------------------------------------------------------------------------

interface ImageCandidate {
    label: string
    /** Returns the raw bytes for this candidate, or null if this source failed. */
    fetch: () => Promise<{ buffer: Buffer; contentType: string } | null>
}

interface GeneratorStrategy {
    name: string
    buildCandidates: (prompt: string, cleanTitle: string) => ImageCandidate[]
}

function urlCandidate(url: string, label: string): ImageCandidate {
    return { label, fetch: () => downloadImage(url) }
}

const LOREMFLICKR_FALLBACK = (cleanTitle: string): ImageCandidate =>
    urlCandidate(
        `https://loremflickr.com/1200/800/${extractKeywords(cleanTitle)}?lock=${randomSeed()}`,
        'Stock Photo (LoremFlickr)'
    )

const pollinationsStrategy: GeneratorStrategy = {
    name: 'pollinations',
    buildCandidates: (prompt, cleanTitle) => [
        urlCandidate(buildPollinationsUrl(prompt), 'AI-Generated Illustration'),
        urlCandidate(buildPollinationsUrl(`bali news ${cleanTitle}`), 'AI-Generated Illustration'),
        LOREMFLICKR_FALLBACK(cleanTitle),
    ],
}

const geminiStrategy: GeneratorStrategy = {
    name: 'gemini',
    buildCandidates: (prompt, cleanTitle) => [
        {
            label: 'AI-Generated Illustration (Gemini)',
            fetch: async () => {
                const { generateImage } = await import('@/lib/ai/providers/gemini')
                const result = await generateImage(prompt)
                return result ? { buffer: result.buffer, contentType: result.mimeType } : null
            },
        },
        urlCandidate(buildPollinationsUrl(prompt), 'AI-Generated Illustration'),
        LOREMFLICKR_FALLBACK(cleanTitle),
    ],
}

// Gemini-primary (2:1 gemini:pollinations). Originally the other way around,
// but flipped after an NSFW audit of the published backlog (2026-08-26)
// found Pollinations repeatedly generating content depicting apparent
// minors for "traditional community/village" style prompts specifically -
// not a one-off, the same failure mode recurred across multiple articles.
// The safety gate caught all of it before publish, but an uncensored
// generator producing that pattern at all isn't something to keep as the
// majority source once a safer, higher-quality, billing-funded alternative
// (Gemini, KEY1+KEY4) is available. Pollinations/LoremFlickr stay in the
// rotation as capacity + fallback, not gone entirely - see geminiStrategy's
// own candidate chain above, which already falls back to Pollinations then
// LoremFlickr if both Gemini keys fail on a given call.
const GENERATOR_POOL: GeneratorStrategy[] = [geminiStrategy, geminiStrategy, pollinationsStrategy]

let rotationIndex = 0
function nextGeneratorStrategy(): GeneratorStrategy {
    const strategy = GENERATOR_POOL[rotationIndex % GENERATOR_POOL.length]
    rotationIndex++
    return strategy
}

/**
 * Generates an image for a title, verifies it and stores it locally.
 *
 * @param title Article title - always used for the filename and as a
 *   fallback prompt source.
 * @param promptOverride Use this exact prompt instead of the default
 *   80/20 (category+content / headline-snippet) builder. Existing callers
 *   that already build their own rich prompt (repair scripts, etc.) keep
 *   working unchanged.
 * @param context Category/excerpt used to build the default prompt when no
 *   promptOverride is given - skip this and the prompt falls back to a
 *   generic "bali news" framing.
 */
export async function generateAndStoreImage(
    title: string,
    promptOverride?: string,
    context?: { category?: string; excerpt?: string }
): Promise<StoredImage> {
    const cleanTitle = cleanPromptText(title)
    const prompt = promptOverride || buildImagePrompt(title, context?.category, context?.excerpt)

    const candidates: ImageCandidate[] = []

    if (promptOverride) {
        candidates.push(urlCandidate(buildPollinationsUrl(promptOverride), 'AI-Generated Illustration'))
    }

    const strategy = nextGeneratorStrategy()
    candidates.push(...strategy.buildCandidates(prompt, cleanTitle))

    for (const candidate of candidates) {
        const downloaded = await candidate.fetch()
        if (!downloaded) continue

        // NSFW gate - verify the actual pixels before this ever touches
        // disk/the DB. Fails closed: any error here (network, no key, quota)
        // discards the candidate rather than publishing something nobody
        // actually checked. See providers/gemini.ts for why this can't go
        // through MyAI OS (confirmed to reject image input outright).
        const { checkImageSafety } = await import('@/lib/ai/providers/gemini')
        const safety = await checkImageSafety(downloaded.buffer, downloaded.contentType)
        if (!safety.safe) {
            console.warn(`Discarded image candidate (${candidate.label}) - safety check: ${safety.reason}`)
            continue
        }

        try {
            const localPath = await persistImage(
                downloaded.buffer,
                downloaded.contentType,
                cleanTitle
            )
            return { localPath, source: candidate.label }
        } catch (error) {
            console.error('Failed to persist image file:', error)
        }
    }

    console.error(`All image sources failed for: "${title}"`)
    return { localPath: null, source: 'Generation Failed' }
}

// ---------------------------------------------------------------------------
// Inline images - places additional images WITHIN an article's body, not
// just the one featuredImageUrl banner at the top. There's no separate
// image table/schema for this: `content` is already stored and rendered as
// raw HTML (see article/[slug]/page.tsx's dangerouslySetInnerHTML), so an
// inline image is just an extra <figure> block spliced into that string at
// a paragraph boundary.
// ---------------------------------------------------------------------------

/** Splits HTML into top-level `<p>...</p>` blocks (non-paragraph markup, e.g. stray <h3>, stays attached to the following block). */
function splitIntoParagraphBlocks(html: string): string[] {
    const pieces = html.split(/(<\/p>)/i)
    const blocks: string[] = []
    let pending = ''
    for (let i = 0; i < pieces.length; i++) {
        pending += pieces[i]
        if (/^<\/p>$/i.test(pieces[i])) {
            blocks.push(pending)
            pending = ''
        }
    }
    if (pending.trim()) blocks.push(pending)
    return blocks
}

/**
 * Inserts `count` additional contextual images directly into an article's
 * HTML body, spaced across its paragraphs. "Accurate placement" means each
 * image is generated from the TEXT OF THE PARAGRAPH IT SITS NEXT TO (not
 * just the article's overall title/excerpt) - the image after paragraph 4
 * is built from what paragraph 4 actually says, via the same 80/20
 * (category+content / snippet) prompt builder used everywhere else.
 *
 * No-ops (returns the original HTML unchanged) if the article doesn't have
 * enough paragraphs to space `count` images out without bunching them at
 * the start/end - a 3-paragraph article doesn't need 2 extra photos.
 */
export async function insertInlineImages(
    html: string,
    title: string,
    category: string | undefined,
    count: number = 2
): Promise<string> {
    const blocks = splitIntoParagraphBlocks(html)
    const minParagraphsNeeded = (count + 1) * 2
    if (count <= 0 || blocks.length < minParagraphsNeeded) return html

    const insertPositions: number[] = []
    for (let i = 1; i <= count; i++) {
        insertPositions.push(Math.floor((blocks.length * i) / (count + 1)))
    }

    // Fire every inline image generation CONCURRENTLY rather than one at a
    // time in the loop below - with 2 funded Gemini keys (KEY1 + KEY4) now
    // in rotation, this is what actually lets a 2-image job run both
    // requests in parallel instead of queueing the second behind the first.
    // See imageKeyRotation in providers/gemini.ts for the key-assignment
    // side of this.
    const generated = await Promise.all(
        insertPositions.map((pos) => {
            const sectionText = blocks[pos].replace(/<[^>]+>/g, ' ').trim()
            return generateAndStoreImage(title, undefined, { category, excerpt: sectionText })
        })
    )

    const insertAt = new Map(insertPositions.map((pos, idx) => [pos, generated[idx]]))
    // Full HTML-attribute escaping (not just quotes) - title is AI-generated,
    // not a fixed literal, and this string gets spliced into `content`,
    // which the article page renders via dangerouslySetInnerHTML.
    const alt = title
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')

    let result = ''
    for (let i = 0; i < blocks.length; i++) {
        result += blocks[i]
        const stored = insertAt.get(i)
        if (stored?.localPath) {
            result += `<figure class="my-6"><img src="${stored.localPath}" alt="${alt}" loading="lazy" /><figcaption>${stored.source}</figcaption></figure>`
        }
    }
    return result
}
