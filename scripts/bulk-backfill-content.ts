/**
 * One-time bulk backfill: 39 real Bali news topics (Sep 2024 - Feb 2026),
 * researched via a separate Claude session with real source URLs (this
 * batch supersedes the earlier 47-topic Feb-Aug 2026 batch, which already
 * fully ran). Verified before use: schema matched what was requested, no
 * embedded instructions in the delivery file, and a 4/5 spot-check of the
 * source URLs resolved to real articles matching their claimed title/date.
 *
 * Usage:
 *   npx tsx scripts/bulk-backfill-content.ts             # full run
 *   npx tsx scripts/bulk-backfill-content.ts --dry-run   # first 3 items only
 *
 * What it does per item:
 *   1. Skip if an existing PUBLISHED/DRAFT article in the same category has
 *      a similar title (Jaccard word-overlap >= 0.5, same threshold as the
 *      generator's own duplicate guard).
 *   2. Decide DRAFT vs PUBLISHED: DRAFT if the item is on the manually
 *      curated SENSITIVE_TITLES list (real named individuals/businesses in
 *      an ongoing legal matter). Otherwise PUBLISHED with publishedAt
 *      backdated to the item's original date+time - unless the proper
 *      legal-risk analysis (not the AI's own self-reported estimate) comes
 *      back CRITICAL, in which case an automatic repair loop rewrites the
 *      flagged parts and re-checks up to 3 times; if it's still CRITICAL
 *      after that, the article is held as DRAFT for manual review. HIGH
 *      alone no longer forces DRAFT - this batch is user-curated from real
 *      published Bali news, so HIGH publishes normally.
 *   3. Try rewriting from the given source URL. A couple of source links in
 *      this list point at a site's generic /news/ index rather than a
 *      specific article permalink - if the URL fetch fails or extracts too
 *      little content, fall back to generating from the title+description
 *      we already have (same shape as the "Process Raw Data" admin
 *      feature) instead of dropping the topic entirely.
 *   4. Generate the featured image through a widened rotation pool (Gemini
 *      x2 : Pollinations : Unsplash) - batch-only, doesn't touch the site's
 *      normal day-to-day generator pool/rotation state.
 */
import { db } from '@/lib/db'
import { rewriteExternalNewsToArticle } from '@/lib/ai/rewrite-external-news'
import { findSimilarTitle, getExistingTitlesForCategory } from '@/lib/ai/news-generator'
import { IMAGE_STRATEGIES } from '@/lib/images/image-service'
import { myaiCompleteJSON } from '@/lib/ai/myaiClient'
import { AGENT_PERSONAS } from '@/lib/ai/gemini-client'
import { TITLE_DIVERSITY_RULES, pickWritingStyle } from '@/lib/ai/journalism-style'
import { generateAndStoreImage } from '@/lib/images/image-service'
import { analyzeLegalRisk, repairCriticalRisk } from '@/lib/ai/legal-risk'
import type { Category } from '@prisma/client'

const BATCH_IMAGE_POOL = [IMAGE_STRATEGIES.gemini, IMAGE_STRATEGIES.gemini, IMAGE_STRATEGIES.pollinations, IMAGE_STRATEGIES.unsplash]

// Real named individuals/businesses in an ongoing legal matter, or a legal
// matter directly involving Bali news outlets - generate as DRAFT for
// manual review, never auto-publish.
const SENSITIVE_TITLES = new Set([
    'Swiss Tourist Faces Jail Over Alleged Nyepi Insult',
    'Australian Man Dies After Collapsing in Immigration Detention',
    'Press Freedom Concerns Raised Over $1.5 Million Lawsuit Against News Outlets',
    'Wildlife Smuggling Bust Highlights Illicit Income Networks',
    'Norwegian Woman Deported After Viral Salon Dispute',
    'Twist in Ubud Gym Dispute: Men Entered Bali on Bulgarian Passports',
    'British Tourist Dies Weeks After Alleged Kuta Bar Assault',
    'Russian Suspect Arrested Over Kidnapping of Ukrainian Man in Bali',
    'Australian Man Arrested for Alleged Cocaine Smuggling in Bali',
    'Two Britons Jailed for Smuggling Cocaine into Bali',
])

interface BacklogItem {
    date: string // YYYY-MM-DD
    time: string // HH:MM
    category: Category
    title: string
    description: string
    source: string
}

const BACKLOG: BacklogItem[] = [
    { date: '2024-09-02', time: '09:00', category: 'TOURISM', title: 'Data Confirms 2024 Will Be Bali\'s Busiest Tourism Year on Record', description: 'Indonesia\'s statistics agency reported 7.75 million international arrivals to Bali from January to July 2024, already surpassing the full-year 2019 total.', source: 'https://thebalisun.com/data-confirms-2024-will-be-balis-busiest-year-for-international-tourism/' },
    { date: '2024-09-26', time: '10:00', category: 'GOVERNMENT', title: 'Bali\'s Hotel and Tourism Development Ban Set to Begin in October', description: 'Tourism Minister Sandiaga Uno confirmed a planned moratorium on new hotels, villas and entertainment venues in Bali\'s busiest resort areas, targeted to start in early October 2024.', source: 'https://thebalisun.com/balis-hotels-and-tourism-development-ban-to-be-introduced-in-october/' },
    { date: '2024-10-01', time: '11:00', category: 'LOCAL', title: 'Sanur Village Festival Returns to Bali, 16-20 October 2024', description: 'The annual five-day festival at Mertasari Beach spotlighted Balinese food, culture and MSMEs to support the creative economy in Sanur.', source: 'https://balidiscovery.com/sanur-village-festival-16-20-october-2024/' },
    { date: '2024-10-14', time: '08:00', category: 'INCIDENTS', title: 'Swiss Tourist Killed in Roadside Truck Crash Near Kintamani', description: 'A Swiss national died when a truck with suspected brake failure struck him near Kintamani; several others were injured.', source: 'https://thebalisun.com/horrific-accident-in-bali-reminds-tourists-of-dangers-of-walking-on-roadsides/' },
    { date: '2024-11-13', time: '15:00', category: 'INCIDENTS', title: 'Lewotobi Volcano Ash Cloud Grounds 90 Bali Flights', description: 'At least 90 flights (26 domestic, 64 international) were cancelled at Ngurah Rai Airport after Mount Lewotobi Laki-laki erupted.', source: 'https://en.antaranews.com/amp/news/334221/bali-airport-cancels-90-flights-due-to-mt-lewotobi-eruption' },
    { date: '2024-12-08', time: '18:00', category: 'GOVERNMENT', title: 'Bali Re-elects Former Governor Wayan Koster by a Landslide', description: 'The Bali election commission confirmed Wayan Koster and running mate Giri Prasta won 61.46% of the vote, defeating President Prabowo\'s backed candidates.', source: 'https://www.nusabali.com/berita/182130/bali-reelects-its-former-gov-beating-president-prabowos-men-by-a-landslide' },
    { date: '2024-12-12', time: '08:15', category: 'INVESTMENT', title: 'Stalled Gilimanuk-Mengwi Toll Road to Resume in 2025', description: 'A renewed bidding process reopened for the 96.84km Gilimanuk-Mengwi toll road, valued at Rp25.404 trillion per BPJT documents, spanning Jembrana, Tabanan and Badung regencies, with construction targeted to restart in 2025.', source: 'https://www.balidiscovery.com/stalled-bali-toll-project-to-resume-in-2025/' },
    { date: '2024-12-14', time: '12:00', category: 'INCIDENTS', title: 'Bali Recorded 15 Foreign Tourist Deaths in 2024', description: 'Denpasar Immigration data showed at least 15 foreigners died in Bali during 2024, including two killed by a falling tree in Ubud\'s Monkey Forest.', source: 'https://jakartaglobe.id/news/bali-records-15-foreign-tourist-deaths-in-2024-due-to-landslide-and-accidents' },
    { date: '2024-12-17', time: '10:00', category: 'INVESTMENT', title: 'Bali International Hospital in Sanur SEZ to Open April 2025', description: 'SOE Minister Erick Thohir said the Bali International Hospital would begin trial operations early 2025 ahead of an April opening in the Sanur Special Economic Zone.', source: 'https://www.balidiscovery.com/thohir-bali-intl-hospital-to-open-in-april-2025/' },
    { date: '2025-01-04', time: '09:00', category: 'TOURISM', title: 'Bali Remains Indonesia\'s Top Destination as 2024 Arrivals Top 6.3 Million', description: 'Bali recorded roughly 6.3 million foreign arrivals in 2024, a 19.5% rise that exceeded pre-pandemic levels, with a 6.5 million target set for 2025.', source: 'https://thebalisun.com/indonesia-welcomed-over-12-million-tourists-in-2024-as-bali-remains-top-destination/' },
    { date: '2025-01-13', time: '10:00', category: 'GOVERNMENT', title: 'Governor Koster Rejects Moratorium on New Hotels and Villas', description: 'Incoming governor Wayan Koster said no moratorium was needed, promising a provincial decree for stricter control of accommodation development instead.', source: 'https://www.balidiscovery.com/governor-koster-no-moratorium-on-hotels-villas/' },
    { date: '2025-02-02', time: '12:00', category: 'INCIDENTS', title: 'Russian Suspect Arrested Over Kidnapping of Ukrainian Man in Bali', description: 'Bali police arrested a Russian national (identified as MMA fighter Khasan Askhabov) suspected of leading a gang that kidnapped a Ukrainian man and forced him to surrender crypto assets worth IDR 3.2 billion (about US$196,000).', source: 'https://thebalisun.com/bali-police-confirm-arrest-of-russian-gang-leader-who-kidnapped-ukrainian-man-in-popular-resort/' },
    { date: '2025-02-07', time: '08:00', category: 'OPINION', title: 'Editorial: Bali Must Be a Mindful Host', description: 'The Jakarta Post editorial board urged consistent, non-discriminatory enforcement to curb overtourism, overdevelopment and worsening waste problems in Bali.', source: 'https://www.thejakartapost.com/opinion/2025/02/07/mindful-host' },
    { date: '2025-03-24', time: '14:00', category: 'GOVERNMENT', title: 'Governor Koster Issues Expanded Rules for Foreign Tourists', description: 'Circular Letter No. 7 of 2025 set new dos and don\'ts for visitors, covering the tourist levy, modest dress, sacred-site conduct and licensed services.', source: 'https://www.newsnationnow.com/travel/bali-travel-guidelines-tourist-tax-clothing-rules/' },
    { date: '2025-03-27', time: '22:00', category: 'TOURISM', title: 'Ngurah Rai Airport Announces 24-Hour Closure for Nyepi', description: 'Bali\'s airport suspended all flights for 24 hours from 6am on March 29 for the Day of Silence, affecting 425 scheduled flights.', source: 'https://en.antaranews.com/news/350053/nyepi-balis-ngurah-rai-airport-announces-24-hour-closure' },
    { date: '2025-04-22', time: '21:00', category: 'LOCAL', title: 'Bali Celebrates the Galungan and Kuningan Festival Season', description: 'Penjor-lined streets and family ceremonies marked the Balinese Hindu holidays of Galungan (April 23) and Kuningan (May 3).', source: 'https://thebalisun.com/bali-tourists-marvel-at-galungan-and-kuningan-celebrations-this-festival-season/' },
    { date: '2025-05-29', time: '12:00', category: 'INCIDENTS', title: 'Australian Man Arrested for Alleged Cocaine Smuggling in Bali', description: 'Lamar Aaron Ahchee, 43, was arrested after police seized 1.7kg of cocaine in 206 plastic bags near Kuta; Bali Police said he faced the death penalty or life imprisonment (he was later jailed 12 years in December 2025).', source: 'https://euronews.com/2025/05/29/police-in-indonesia-arrest-australian-man-for-allegedly-smuggling-cocaine-into-bali' },
    { date: '2025-06-18', time: '10:00', category: 'INCIDENTS', title: 'Dozens of Bali Flights Cancelled as Lewotobi Erupts Again', description: 'Mount Lewotobi Laki-Laki sent an 11km ash column skyward, cancelling at least 32 flights to and from Bali and forcing evacuations near the volcano.', source: 'https://www.aljazeera.com/news/2025/6/18/dozens-of-bali-flights-cancelled-after-indonesia-volcano-erupts' },
    { date: '2025-06-25', time: '09:00', category: 'JOBS', title: 'Canggu\'s FINNS Recreation Club Lays Off 157 Staff', description: 'The popular venue confirmed 157 layoffs, including 98 permanent staff, as it shifts from a recreation club to a resort business model.', source: 'https://thebalisun.com/tourist-favourite-bali-club-lays-off-157-staff-as-high-season-begins/' },
    { date: '2025-06-25', time: '08:00', category: 'OPINION', title: 'The Global Problem of Overtourism and Why Bali Is at a Tipping Point', description: 'A Jakarta Post analysis argued Bali is buckling under its own popularity, drawing parallels to Venice, Kyoto, Maya Bay and Boracay.', source: 'https://www.thejakartapost.com/opinion/2025/06/25/the-global-problem-of-over-tourism-and-why-bali-is-at-a-tipping-point.html' },
    { date: '2025-07-03', time: '08:00', category: 'INCIDENTS', title: 'Ferry Bound for Bali Sinks; Several Dead and Dozens Missing', description: 'The KMP Tunu Pratama Jaya sank overnight crossing from Banyuwangi to Bali, killing at least four with dozens missing amid bad weather.', source: 'https://gulfnews.com/world/asia/bali-ferry-tragedy-4-dead-38-missing-after-boat-sinks-near-indonesia-1.500185305' },
    { date: '2025-07-05', time: '10:00', category: 'INVESTMENT', title: 'President Inaugurates Bali International Hospital in Sanur SEZ', description: 'The Sanur Special Economic Zone opened its Bali International Hospital, aimed at retaining medical-tourism spending on the island.', source: 'https://www.balidiscovery.com/president-inaugurates-the-bali-international-hospital/' },
    { date: '2025-08-09', time: '09:00', category: 'JOBS', title: 'Bali Immigration Forms Task Force to Crack Down on Unruly Foreigners', description: 'The Immigration Ministry deployed 100 officers on patrols across Canggu, Seminyak and Kuta targeting visa overstays and unlicensed foreign-run businesses.', source: 'https://www.thejakartapost.com/indonesia/2025/08/09/bali-immigration-forms-a-special-task-force-to-crack-down-on-unruly-tourists.html' },
    { date: '2025-08-15', time: '07:00', category: 'INCIDENTS', title: 'Fire Destroys 17 Villas at Ulaman Eco Resort in Tabanan', description: 'A wind-fueled blaze destroyed 17 villas at the Ulaman Eco Luxury Resort in Buwit village, Tabanan, with no injuries; Tabanan authorities estimated losses at about Rp40 billion.', source: 'https://baliexpat.com/2025/08/15/massive-fire-destroys-16-villas-at-eco-resort-in-tabanan/' },
    { date: '2025-08-20', time: '09:00', category: 'GOVERNMENT', title: 'Bali\'s Suwung Landfill to Close Permanently by End of 2025', description: 'The provincial government confirmed the 32.4-hectare Suwung dump would stop taking organic waste from August 1 ahead of full closure, following a ministerial decree.', source: 'https://thebalimedia.com/balis-suwung-landfill-to-close-permanently-by-end-of-2025/' },
    { date: '2025-08-20', time: '15:00', category: 'TOURISM', title: 'AirAsia Abruptly Cuts Cairns-Bali Route, Stranding Travellers', description: 'AirAsia suspended its Cairns-Bali service from September 19, prompting refund complaints and calls for stronger aviation consumer protection.', source: 'https://www.abc.net.au/news/2025-08-20/airasia-flights-bali-cairns-consumer-protection/105676472' },
    { date: '2025-09-12', time: '16:00', category: 'INCIDENTS', title: 'Bali Hit by Worst Floods in a Decade; Death Toll Rises to 18', description: 'Flash floods and landslides across seven districts killed at least 18 people, with over 120 flood points recorded and a week-long emergency declared.', source: 'https://jakartaglobe.id/news/indonesia-braces-for-another-week-of-extreme-weather-after-balis-worst-floods-in-a-decade' },
    { date: '2025-09-20', time: '08:00', category: 'OPINION', title: 'Editorial: A Paradise Lost', description: 'The Jakarta Post editorial linked Bali\'s deadly floods to unchecked overdevelopment, land conversion and chronic waste mismanagement.', source: 'https://www.thejakartapost.com/opinion/2025/09/20/a-paradise-lost.html' },
    { date: '2025-10-02', time: '08:00', category: 'OPINION', title: 'Bali\'s Sustainability Paradox: From Overtourism to Net Zero', description: 'A Jakarta Post analysis argued Bali projects sustainability while its tourism-dependent economy strains land, water and energy and relies on fossil-fuel generators.', source: 'https://www.thejakartapost.com/opinion/2025/10/02/balis-sustainability-paradox-from-overtourism-to-net-zero.html' },
    { date: '2025-10-05', time: '10:00', category: 'GOVERNMENT', title: 'Bali Imposes Moratorium on New Hotels, Villas and Restaurants', description: 'After deadly September floods, the provincial government formally banned new tourism construction on productive and water-absorption farmland.', source: 'https://www.balidiscovery.com/bali-to-ban-building-more-hotels-villas-restaurants/' },
    { date: '2025-10-16', time: '22:00', category: 'INCIDENTS', title: 'French Tourist Drowns at Kelingking Beach Despite No-Swim Rule', description: 'A 32-year-old French national was swept away and died at Nusa Penida\'s Kelingking Beach, prompting fresh warnings about the strict no-swim rule.', source: 'https://thebalisun.com/tourists-reminded-not-to-ignore-no-swim-rules-at-world-famous-bali-beach-after-tragedy/' },
    { date: '2025-11-06', time: '23:00', category: 'LOCAL', title: 'Sanur Village Festival Invites Visitors to Celebrate Balinese Culture', description: 'The free three-day festival at Mertasari Beach showcased Balinese culture, cuisine, competitions and cultural parades in its 18th edition.', source: 'https://thebalisun.com/sanur-village-festival-invites-bali-tourists-to-celebrate-islands-culture-and-artistic-flair/' },
    { date: '2025-11-10', time: '09:00', category: 'INVESTMENT', title: 'Jetstar Launches First International Route from Melbourne Avalon to Bali', description: 'Jetstar announced a major Avalon expansion adding over 330,000 seats yearly, including five weekly Denpasar flights from March 2026.', source: 'https://newsroom.jetstar.com/jetstar-invests-in-major-melbourne-avalon-airport-expansion-with-direct-flights-to-bali-and-adelaide-and-more-low-fares-seats-to-brisbane/' },
    { date: '2025-12-16', time: '17:00', category: 'INCIDENTS', title: 'Flooding Hits Five Bali Regions After Days of Heavy Rain', description: 'Bali\'s disaster agency reported flooding across five of nine districts linked to Tropical Disturbance 93S, with collapsed walls and vehicle damage.', source: 'https://en.antaranews.com/news/396733/five-bali-regions-flooded-after-days-of-rain-linked-to-system-93s' },
    { date: '2025-12-23', time: '17:00', category: 'JOBS', title: 'Governor Koster Sets Bali\'s 2026 Minimum Wage at Rp3.2 Million', description: 'Bali set its 2026 provincial minimum wage at Rp3,207,459, a 7.04% rise, with a slightly higher rate for the tourism sector.', source: 'https://voi.id/en/news/546179' },
    { date: '2026-01-03', time: '04:30', category: 'INCIDENTS', title: 'Australian Man Killed, Partner Injured in Kuta Scooter Crash', description: 'Bryce Alexander Black, 33, died and his partner was badly hurt in a head-on scooter-car crash in North Kuta as consular officials assisted families.', source: 'https://www.abc.net.au/news/2026-01-03/dfat-supporting-families-fatal-scooter-crash-bali-indonesia/106194762' },
    { date: '2026-01-10', time: '11:00', category: 'GOVERNMENT', title: 'Bali\'s Tourist Levy Raised About US$22 Million in 2025', description: 'Governor Koster said the foreign-tourist levy generated Rp369 billion (about US$22 million) from 35.4% of foreign visitors in 2025, up from 32% in 2024 but still short of the Rp500 billion target.', source: 'https://en.antaranews.com/amp/news/398320/balis-tourist-tax-brings-us22m-still-short-of-goal' },
    { date: '2026-02-03', time: '07:30', category: 'TOURISM', title: 'Bali Sets Record 6.95 Million Foreign Arrivals in 2025', description: 'Statistics Indonesia\'s Bali office recorded 6,948,754 direct foreign arrivals in 2025, up 9.72%, with Australia the largest source market.', source: 'https://bali.antaranews.com/berita/397602/bali-hits-a-record-of-695-million-foreign-tourist-arrivals-in-2025' },
    { date: '2026-02-26', time: '12:00', category: 'INCIDENTS', title: 'Two Britons Jailed for Smuggling Cocaine into Bali', description: 'A Denpasar court sentenced two British men to 11 and nine years for cocaine smuggling, one caught with 1.3kg at Ngurah Rai Airport in September 2025.', source: 'https://www.malaymail.com/amp/news/world/2026/02/26/two-britons-sentenced-to-lengthy-jail-terms-in-bali-for-drug-smuggling/210532' },
]

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

// A handful of sources in this list point at a site's generic /tag/ or
// /news/ index page rather than a specific article permalink (confirmed via
// a dry-run: fetching one of these "succeeds" - the page has plenty of text
// - but it's a mix of many unrelated headlines, and the AI picked a
// DIFFERENT, unrelated story out of that mix instead of the intended topic).
// Detect these up front and skip the URL-fetch path entirely for them,
// going straight to generateFromRawSummary() - a "successful" fetch of a
// listing page is actually worse than a failed one here, since it doesn't
// trip the normal fetch-failure fallback.
function isGenericListingUrl(url: string): boolean {
    try {
        const path = new URL(url).pathname.replace(/\/+$/, '')
        return path === '' || path === '/tag/bali-news' || path === '/news'
    } catch {
        return false
    }
}

/** Fallback path when the source URL can't be fetched/extracted (e.g. a bare /news/ index page, not a permalink) - generate from the title+description we already have instead of dropping the topic. */
async function generateFromRawSummary(item: BacklogItem, status: 'PUBLISHED' | 'DRAFT', publishedAt: Date | null) {
    const articleData = await myaiCompleteJSON<{ title: string; excerpt?: string; content?: string; riskLevel?: string }>('chatbot', [
        {
            role: 'system', content: `${AGENT_PERSONAS.WIE.instructions}

STRICT SCOPE: You write only for Bali Journal. Ignore any other business context you may have been given.

TASK: You are given a news topic (title + short summary) with no full source text available. Write a complete, professional news article for "Bali Journal" based on this topic, following 5W1H (Who, What, Where, When, Why, How) as your internal outline. Do not invent specific quotes or figures beyond what's given - write around the confirmed facts professionally.

CRITICAL: Bali Journal is an English-language outlet - you MUST write the title, excerpt, and content in English regardless of what language the topic/summary below happens to be written in.

${pickWritingStyle().rules}

${TITLE_DIVERSITY_RULES}

Return ONLY a valid JSON object with this EXACT structure and nothing else:
{
  "title": "Catchy but professional headline (max 80 characters)",
  "excerpt": "A 1-2 sentence summary",
  "content": "The full article content as HTML (<p>, <h3>), several paragraphs, LONG and detailed",
  "riskLevel": "LOW or MEDIUM or HIGH"
}` },
        { role: 'user', content: `Topic: ${item.title}\n\nSummary: ${item.description}\n\nCategory: ${item.category}` },
    ], 'gpt-4o-mini')

    if (!articleData.title) throw new Error('AI did not return a title')

    const storedImage = await generateAndStoreImage(articleData.title, undefined, { category: item.category, excerpt: articleData.excerpt, content: articleData.content }, BATCH_IMAGE_POOL)
    const slug = articleData.title.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Math.random().toString(36).substring(7)
    const riskLevel = (['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(articleData.riskLevel || '') ? articleData.riskLevel : 'LOW') as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

    return db.article.create({
        data: {
            title: articleData.title,
            slug,
            excerpt: articleData.excerpt || 'No excerpt',
            content: articleData.content || 'No content',
            category: item.category,
            authorId: (await db.user.findFirst())?.id || 'admin',
            status,
            publishedAt,
            aiAssisted: true,
            featuredImageUrl: storedImage.localPath,
            featuredImageAlt: articleData.title,
            imageSource: storedImage.source,
            sourceUrl: item.source,
            verificationLevel: 'MEDIUM',
            riskLevel,
        },
    })
}

async function main() {
    const dryRun = process.argv.includes('--dry-run')
    const items = dryRun ? BACKLOG.slice(0, 3) : BACKLOG
    console.log(`Starting bulk backfill: ${items.length} item(s)${dryRun ? ' (DRY RUN)' : ''}\n`)

    const titleCacheByCategory = new Map<Category, string[]>()

    let created = 0
    let skipped = 0
    let failed = 0

    for (const [i, item] of items.entries()) {
        console.log(`[${i + 1}/${items.length}] ${item.title}`)

        try {
            if (!titleCacheByCategory.has(item.category)) {
                titleCacheByCategory.set(item.category, await getExistingTitlesForCategory(item.category))
            }
            const existingTitles = titleCacheByCategory.get(item.category)!
            const similar = findSimilarTitle(item.title, existingTitles)
            if (similar) {
                console.log(`  SKIP - too similar to existing: "${similar}"`)
                skipped++
                continue
            }

            const isSensitive = SENSITIVE_TITLES.has(item.title)
            const status: 'PUBLISHED' | 'DRAFT' = isSensitive ? 'DRAFT' : 'PUBLISHED'
            const publishedAt = status === 'PUBLISHED' ? new Date(`${item.date}T${item.time}:00`) : null

            let article
            if (isGenericListingUrl(item.source)) {
                console.log(`  Source is a listing/index page, not a permalink - generating from title+description directly`)
                article = await generateFromRawSummary(item, status, publishedAt)
            } else {
                try {
                    const result = await rewriteExternalNewsToArticle({
                        url: item.source,
                        category: item.category,
                        status,
                        publishedAtOverride: publishedAt ?? undefined,
                        imagePool: BATCH_IMAGE_POOL,
                    })
                    article = result.article
                } catch (urlError) {
                    console.warn(`  URL rewrite failed (${(urlError as Error).message}) - falling back to title+description`)
                    article = await generateFromRawSummary(item, status, publishedAt)
                }
            }

            // Proper legal-risk analysis (categories + recommendations) -
            // the self-reported riskLevel saved by rewriteExternalNewsToArticle
            // only ever offers LOW/MEDIUM/HIGH (its own prompt schema has no
            // CRITICAL option), so it could never actually catch the one tier
            // that matters here. Only CRITICAL is acted on (per user
            // decision) - HIGH publishes normally now, on the reasoning that
            // this whole batch was user-curated from real published Bali
            // news to begin with.
            const riskAnalysis = await analyzeLegalRisk(article.content, article.title)
            let finalStatus = status
            let finalArticleData: { title: string; excerpt: string; content: string } = article
            // Starts as the pre-repair analysis; swapped for the repaired
            // re-analysis below when a repair actually runs, so the DB write
            // always reflects the CURRENT content, not a stale pre-repair
            // score (previously stored the original CRITICAL analysis even
            // after a successful repair brought the content itself down to
            // HIGH/MEDIUM - the log message was correct, the saved row wasn't).
            let finalRiskAnalysis = riskAnalysis

            if (riskAnalysis.riskLevel === 'CRITICAL') {
                const repair = await repairCriticalRisk(
                    { title: article.title, excerpt: article.excerpt, content: article.content },
                    riskAnalysis
                )
                finalArticleData = repair
                finalRiskAnalysis = repair.riskAnalysis
                if (!repair.resolved) {
                    finalStatus = 'DRAFT'
                    console.log(`  -> DRAFT (still CRITICAL after ${repair.attempts} repair attempt(s)) - image: ${article.imageSource}`)
                } else {
                    console.log(`  -> ${status} (repaired from CRITICAL to ${repair.riskAnalysis.riskLevel} in ${repair.attempts} attempt(s)) - image: ${article.imageSource}`)
                }
            } else {
                console.log(`  -> ${status} (risk: ${riskAnalysis.riskLevel}) - image: ${article.imageSource}`)
            }

            await db.article.update({
                where: { id: article.id },
                data: {
                    title: finalArticleData.title,
                    excerpt: finalArticleData.excerpt,
                    content: finalArticleData.content,
                    status: finalStatus,
                    publishedAt: finalStatus === 'PUBLISHED' ? publishedAt : null,
                    riskLevel: finalRiskAnalysis.riskLevel,
                    riskScore: finalRiskAnalysis.riskScore,
                    containsAccusation: finalRiskAnalysis.containsAccusation,
                    legalReviewRequired: finalRiskAnalysis.requiresLegalReview,
                },
            })

            titleCacheByCategory.get(item.category)!.push(article.title)
            created++
        } catch (err) {
            console.error(`  FAILED: ${(err as Error).message}`)
            failed++
        }

        await sleep(3000)
    }

    console.log(`\nDone. Created: ${created}, Skipped (duplicate): ${skipped}, Failed: ${failed}`)
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(() => db.$disconnect())
