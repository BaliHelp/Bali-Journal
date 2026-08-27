/**
 * One-time bulk backfill: 47 real Bali news topics (27 Feb - 27 Aug 2026),
 * provided by the user with real source URLs. See the plan file and memory
 * `newsbali_content_backlog_feb_aug_2026.md` for full context.
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
 *      an ongoing legal matter) OR if the AI itself comes back with
 *      riskLevel HIGH/CRITICAL. Otherwise PUBLISHED with publishedAt
 *      backdated to the item's original date+time.
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
    { date: '2026-02-27', time: '06:30', category: 'INCIDENTS', title: 'Flash Flooding Blamed for Dozens of Disaster Sites Across Bali', description: 'Flash flooding in early 2026 was linked to dozens of disaster sites island-wide, prompting emergency response coordination as authorities assessed damage to roads and low-lying neighborhoods.', source: 'https://www.balidiscovery.com/tag/bali-news/' },
    { date: '2026-03-01', time: '07:15', category: 'TOURISM', title: 'Middle East Tensions Ground Dozens of Bali Flights', description: 'Between February 28 and March 6, 2026, Ngurah Rai International Airport recorded the cancellation of 64 international flights as airspace closures tied to Iran-Israel-US tensions disrupted routes into Bali.', source: 'https://www.travelandtourworld.com/news/article/bali-indonesias-leading-destination-pushes-forward-amid-geopolitical-chaos-and-global-uncertainty-how-emerging-markets-innovative-strategies-and-resilient-adaptations-are-shaping-the-fut/' },
    { date: '2026-03-04', time: '06:40', category: 'GOVERNMENT', title: 'Bali to Require Proof of Funds From Foreign Visitors', description: 'Bali officials are preparing rules that could take effect as early as March 2026 requiring international visitors to show evidence of sufficient funds, such as bank statements and confirmed return tickets.', source: 'https://www.travelmole.com/news/bali-to-check-on-travelers-financial-credentials-potentially-from-march-2026/' },
    { date: '2026-03-22', time: '06:50', category: 'INCIDENTS', title: 'Swiss Tourist Faces Jail Over Alleged Nyepi Insult', description: "A Swiss national, Luzian Andrin Zgraggen, was named a suspect after allegedly insulting Bali's sacred Nyepi Day of Silence, with police pursuing possible criminal charges under Indonesian law.", source: 'https://heybali.info/news/a-swiss-tourist-is-accused-of-insulting-nyepi-now-he-faces-possible-jail-time-in-bali/' },
    { date: '2026-03-28', time: '07:05', category: 'LOCAL', title: "Bali's 2026 Tourism Strategy Shifts Toward Quality Over Quantity", description: 'Provincial tourism officials outlined a 2026 direction prioritizing destination management, zoning, and cultural value over sheer visitor numbers.', source: 'https://dewata.news/bali-tourism-2026-quality-sustainability/' },
    { date: '2026-03-28', time: '06:35', category: 'JOBS', title: 'Balinese Villa Sector Cites Workforce Strain After Weak 2025 Season', description: 'The Bali Villa Association reported that a roughly 20 percent occupancy decline over the 2025 year-end holidays squeezed hospitality staffing, with the sector counting on 2026 reforms to stabilize jobs.', source: 'https://dewata.news/bali-tourism-2026-quality-sustainability/' },
    { date: '2026-03-29', time: '07:45', category: 'OPINION', title: "Analysis: Bali's Tourism Economy Tested by Global Uncertainty", description: "A travel-industry analysis argued that geopolitical shocks and airspace disruptions expose Bali's overreliance on a narrow set of source markets, urging diversification into cruise, cultural, and sports tourism.", source: 'https://www.travelandtourworld.com/news/article/bali-indonesias-leading-destination-pushes-forward-amid-geopolitical-chaos-and-global-uncertainty-how-emerging-markets-innovative-strategies-and-resilient-adaptations-are-shaping-the-fut/' },
    { date: '2026-04-06', time: '06:20', category: 'TOURISM', title: 'Bali Sets 6.63 Million Visitor Target for 2026', description: "Bali's Tourism Office announced a goal of 6.63 million international arrivals for 2026, shifting emphasis toward higher-spending \"quality tourism\" and tighter immigration enforcement.", source: 'https://www.travelandtourworld.com/news/article/balis-bold-move-for-2026-targeting-6-63-million-tourists-and-tightening-visitor-regulations/' },
    { date: '2026-04-06', time: '07:50', category: 'GOVERNMENT', title: 'Two New Immigration Offices to Open in Tabanan and Klungkung', description: "As part of expanded surveillance infrastructure, Bali's immigration authority opened new regional offices in Tabanan and Klungkung, alongside a 24-hour hotline for visitor-misconduct cases.", source: 'https://www.travelandtourworld.com/news/article/balis-bold-move-for-2026-targeting-6-63-million-tourists-and-tightening-visitor-regulations/' },
    { date: '2026-04-17', time: '06:10', category: 'INCIDENTS', title: 'Russian National Caught With 2.5kg of Cocaine at Bali Airport', description: 'Customs and police at Ngurah Rai International Airport intercepted a Russian traveler carrying 2.5 kilograms of cocaine, one of several narcotics busts reported at the airport in April 2026.', source: 'https://www.balidiscovery.com/tag/bali-news/' },
    { date: '2026-04-18', time: '07:20', category: 'GOVERNMENT', title: 'Fuel and Gas Prices Rise Across Bali', description: 'Bali households and businesses faced another round of fuel, LPG, and LNG price increases in mid-April 2026, adding pressure to transport and hospitality operating costs.', source: 'https://www.balidiscovery.com/tag/bali-news/' },
    { date: '2026-04-21', time: '06:25', category: 'INVESTMENT', title: 'Unidentified Chinese Submersible Found Near Lombok Strait', description: "The discovery of an unmanned Chinese submersible vessel near the Lombok Strait drew muted responses from both Chinese and Indonesian officials, raising questions about maritime security near Bali's shipping lanes.", source: 'https://www.balidiscovery.com/tag/bali-news/' },
    { date: '2026-04-25', time: '07:00', category: 'LOCAL', title: 'Fire Destroys 5,000 Square Meters of Club Med Bali', description: 'An early-morning blaze tore through roughly 5,000 square meters of the Club Med Bali resort, causing an estimated Rp 5 billion in damages with no fatalities reported.', source: 'https://www.balidiscovery.com/tag/bali-news/' },
    { date: '2026-04-28', time: '06:55', category: 'LOCAL', title: 'Former Taman Festival Padanggalak Site Enters Demolition', description: 'Demolition began at the long-abandoned Taman Festival Padanggalak site in Denpasar, being redeveloped into green space, a Sanur Port access zone, and a culture-and-commerce area with hotel construction banned.', source: 'https://balirealestate.substack.com/p/the-bali-realestate-dispatch-w19-3ad' },
    { date: '2026-05-08', time: '07:35', category: 'INVESTMENT', title: 'Mirah Investment Seals $300 Million Hospitality Partnership', description: 'Bali-based Mirah Investment and Development announced an equity partnership exceeding US$300 million with RV Capital to develop SOMOSHOTELS Uluwatu and the beachfront Cocana Balangan resort.', source: 'https://balirealestate.substack.com/p/the-bali-realestate-dispatch-w19-3ad' },
    { date: '2026-05-10', time: '06:15', category: 'GOVERNMENT', title: "Bali's Economy Grew 5.82 Percent in 2025, Highest in Seven Years", description: "Provincial officials cited 2025 growth of 5.82 percent, the strongest in seven years, as evidence supporting Bali's bid to become a hub for tourism-linked investment and financial services.", source: 'https://en.antaranews.com/news/415297/indonesia-paves-way-for-global-financial-hub-in-bali' },
    { date: '2026-05-10', time: '07:30', category: 'INVESTMENT', title: 'Bali Eyed for New International Financial Center', description: "Coordinating Minister Airlangga Hartarto and Investment Minister Rosan Roeslani began accelerating plans to turn the KEK Kura Kura Bali zone into an international financial hub, modeled loosely on Dubai's economy.", source: 'https://en.antaranews.com/news/415297/indonesia-paves-way-for-global-financial-hub-in-bali' },
    { date: '2026-05-12', time: '06:45', category: 'INVESTMENT', title: 'Bali Financial Hub Project Targets US$6.3 Billion', description: "Officials touring the KEK Kura Kura Bali site outlined ambitions for a US$6.3 billion financial center intended to keep more of Indonesia's capital-market activity onshore.", source: 'https://indonesiabusinesspost.com/6630/markets-and-finance/bali-financial-hub-at-kek-kura-kura-set-for-us-6-3-billion-investment' },
    { date: '2026-05-13', time: '07:10', category: 'TOURISM', title: 'First Quarter 2026 Foreign Arrivals Rise 1.4 Percent', description: "Bali's statistics agency reported 1.4 million foreign tourist visits for January-March 2026, a modest year-on-year increase led by Australian visitors, despite Middle East-linked flight cancellations.", source: 'https://balidiscovery.com/foreign-tourist-arrivals-increase-1-4-in-q1-2026/' },
    { date: '2026-05-20', time: '07:00', category: 'JOBS', title: 'Businessman Calls for More Trade Schools Beyond Hospitality', description: "A Balinese business figure argued Bali's education system over-trains students for tourism careers while neglecting agriculture, forestry, and animal husbandry trades that could diversify the job market.", source: 'https://balidiscovery.com/editorial-back-to-basic-agriculture/' },
    { date: '2026-06-06', time: '06:40', category: 'LOCAL', title: 'Bali Pushes Waste-to-Energy Plant Backed by Danantara', description: "Construction on a sovereign-wealth-backed waste-to-energy facility processing about 120 tonnes of waste daily was slated to begin in June 2026, part of Bali's roadmap to net-zero emissions by 2045.", source: 'https://www.travelandtourworld.com/news/article/66261q959zpb/' },
    { date: '2026-06-06', time: '07:55', category: 'OPINION', title: "Analysis: What Bali's Infrastructure Push Means for Travelers and Investors", description: "A tourism-industry analysis examined Bali's simultaneous investment in waste-to-energy, clean power, and transport, arguing infrastructure spending is now an economic necessity, not an option.", source: 'https://www.travelandtourworld.com/news/article/66261q959zpb/' },
    { date: '2026-06-12', time: '06:50', category: 'LOCAL', title: "Injured 50-Year-Old Sea Turtle Found in Bali River", description: 'Conservationists recovered a decades-old sea turtle injured in a Buleleng Regency river, suspecting human involvement and renewing calls for stronger marine-wildlife protection.', source: 'https://heybali.info/news/a-50-year-old-sea-turtle-was-found-injured-in-a-bali-river-conservationists-suspect-human-involvement/' },
    { date: '2026-06-25', time: '07:40', category: 'LOCAL', title: 'Recycled Plastic Street Signs Installed in Singaraja', description: "North Bali's Singaraja Zero Point received new street signage made from recycled plastic waste, a civic project officials framed as a model for turning waste into public infrastructure.", source: 'https://heybali.info/news/in-balis-historic-north-a-street-sign-revolution-turns-plastic-waste-into-civic-pride/' },
    { date: '2026-06-28', time: '07:25', category: 'GOVERNMENT', title: 'Bali Fiscal Insight: Rp333.6 Billion in Sukuk Funds Disbursed', description: 'The Ministry of Finance disbursed Rp333.6 billion in Islamic bond (SBSN) proceeds through May 2026 for Bali projects including Udayana University facilities, roads, and defense/police installations.', source: 'https://en.antaranews.com/news/420699/indonesia-disburses-rp3336-billion-in-sukuk-funds-for-bali-projects' },
    { date: '2026-07-01', time: '07:15', category: 'INVESTMENT', title: 'Nusa Penida Strait Studied as Renewable Ocean Energy Site', description: "Engineers and officials are evaluating the Nusa Penida Strait's strong currents as a candidate for tidal power generation, part of efforts to diversify Bali's energy sources.", source: 'https://heybali.info/news/could-the-ocean-around-bali-power-the-island-nusa-penida-strait-emerges-as-a-renewable-energy-candidate/' },
    { date: '2026-07-11', time: '06:20', category: 'INCIDENTS', title: 'Australian Man Dies After Collapsing in Immigration Detention', description: 'Bali immigration authorities released a timeline showing officers responded immediately after an Australian detainee collapsed inside the Ngurah Rai Immigration Office, a case that drew scrutiny of detention conditions.', source: 'https://heybali.info/news/' },
    { date: '2026-07-13', time: '07:00', category: 'LOCAL', title: 'Viral Video Accuses Bali Police Chief of Seizing Phone', description: 'A widely shared video alleged a Bali police chief confiscated a bystander\'s phone during an incident, but authorities publicly disputed what the footage showed.', source: 'https://heybali.info/news/viral-video-accuses-bali-police-chief-of-seizing-phone-authorities-say-thats-not-what-happened/' },
    { date: '2026-07-18', time: '07:50', category: 'OPINION', title: 'Press Freedom Concerns Raised Over $1.5 Million Lawsuit Against News Outlets', description: 'An Indonesian lawmaker voiced concern after four Bali-focused news outlets were hit with a combined $1.5 million civil lawsuit, sparking debate over press freedom.', source: 'https://heybali.info/news/indonesian-lawmaker-voices-concern-as-four-bali-news-outlets-face-1-5-million-civil-lawsuit/' },
    { date: '2026-07-19', time: '07:05', category: 'INCIDENTS', title: 'Two Men Shot at Canggu Bar', description: "A shooting at the Shady Pig Bar in North Kuta, Canggu, left two men injured, prompting a police investigation in one of Bali's busiest nightlife districts.", source: 'https://heybali.info/news/' },
    { date: '2026-07-23', time: '06:30', category: 'GOVERNMENT', title: 'Bali Locks Foreign Investors Out of 18 Business Sectors', description: 'New provincial licensing rules bar foreign capital from 18 categories of small business, including hotels, cafés, and motorbike rentals, aiming to protect local livelihoods from investment loopholes.', source: 'https://heybali.info/news/bali-locks-foreign-investors-out-of-18-business-sectors-from-hotels-to-cafes-to-motorbike-rentals/' },
    { date: '2026-07-24', time: '06:45', category: 'TOURISM', title: 'Bali Wants Tourists to Eat More Local Food', description: "A push to connect Bali's hotels and restaurants directly with local farmers through a sustainable supply chain aims to boost farmer incomes while giving visitors more authentic dining options.", source: 'https://heybali.info/news/bali-wants-tourists-to-eat-more-local-food-heres-why-farmers-could-be-the-biggest-winners/' },
    { date: '2026-07-26', time: '07:15', category: 'OPINION', title: "Editorial: Bali's Real Scandal Is What Nobody Checked", description: "A local commentary argued that a viral controversy involving a rejected runner obscured a bigger story about weak fact-checking standards among social-media users and parts of Bali's press.", source: 'https://heybali.info/news/balis-real-scandal-isnt-a-rejected-runner-its-everything-nobody-checked-before-that-screenshot-went-viral/' },
    { date: '2026-07-29', time: '06:10', category: 'JOBS', title: 'Digital Nomads Turn to Freelance Platforms for Extra Income', description: "A guide for Bali's expat and remote-worker community outlined freelance platforms, stock-photo licensing, and gig-economy apps used to supplement income while based on the island.", source: 'https://heybali.info/news/15-legit-ways-digital-nomads-expats-and-travelers-in-bali-are-earning-extra-income-in-august-2026/' },
    { date: '2026-08-10', time: '06:20', category: 'JOBS', title: 'Wildlife Smuggling Bust Highlights Illicit Income Networks', description: "Police detained a suspect and rescued 21 endangered sea turtles in a wildlife-trafficking case, exposing an underground income network built around smuggling protected species through Bali's ports.", source: 'https://heybali.info/news/bali-police-rescue-21-endangered-sea-turtles-as-wildlife-smuggling-network-comes-under-investigation/' },
    { date: '2026-08-17', time: '06:50', category: 'LOCAL', title: 'Activists Push Ubud Resort to Adopt Cage-Free Eggs', description: 'Animal-welfare campaigners staged peaceful protests and petitions urging Plataran Ubud Resort to commit to sourcing only cage-free eggs.', source: 'https://balidiscovery.com/' },
    { date: '2026-08-17', time: '07:45', category: 'TOURISM', title: "Only 43% of Visitors Pay Bali's Tourist Tax", description: 'Provincial officials disclosed that just 43 percent of visitors have paid the mandatory Rp150,000 foreign tourist levy, prompting the government to seek airline cooperation to boost collection rates.', source: 'https://balidiscovery.com/' },
    { date: '2026-08-17', time: '06:25', category: 'GOVERNMENT', title: "Task Force Formed to Elevate Bali's Airport to Top-Class Status", description: 'The Governor is leading a new multi-year task force aimed at upgrading Ngurah Rai International Airport into a top-tier global air gateway, addressing congestion and service-quality complaints.', source: 'https://balidiscovery.com/' },
    { date: '2026-08-19', time: '06:15', category: 'OPINION', title: "Japan's Small-Business Collapse Offers a Warning for Bali's Expat Economy", description: "An economic analysis linked record corporate bankruptcies among Japan's small businesses to broader risks facing Bali's expat-run cafés, guesthouses, and service businesses.", source: 'https://heybali.info/news/japans-small-businesses-are-collapsing-at-a-record-pace-and-balis-expat-economy-should-take-note/' },
    { date: '2026-08-20', time: '07:30', category: 'INVESTMENT', title: 'Indonesia Weighs Bali Airport Land for New Financial Center', description: "Officials confirmed land near Ngurah Rai International Airport is among the top contenders for Indonesia's planned international financial center.", source: 'https://heybali.info/news/indonesia-weighs-bali-as-site-for-new-international-financial-center-with-land-near-the-airport-among-top-contenders/' },
    { date: '2026-08-21', time: '06:00', category: 'GOVERNMENT', title: 'Governor Blocks Foreign Investment Loophole in Small Businesses', description: 'Governor Wayan Koster moved to close a legal loophole that allowed foreign nationals to informally control small Balinese businesses, citing threats to local livelihoods.', source: 'https://heybali.info/news/bali-governor-blocks-foreign-investment-in-small-businesses-citing-loophole-threatening-local-livelihoods/' },
    { date: '2026-08-21', time: '07:20', category: 'INCIDENTS', title: 'Norwegian Woman Deported After Viral Salon Dispute', description: 'A Norwegian national at the center of a widely shared dispute with a Bali salon was deported after authorities found she had overstayed her visa by 34 days.', source: 'https://heybali.info/news/norwegian-woman-at-center-of-viral-salon-dispute-deported-from-bali-after-34-day-visa-overstay/' },
    { date: '2026-08-21', time: '06:35', category: 'INCIDENTS', title: 'Twist in Ubud Gym Dispute: Men Entered Bali on Bulgarian Passports', description: 'Immigration officials revealed that men involved in a viral confrontation at an Ubud gym, who had claimed Israeli nationality, had entered Indonesia using Bulgarian passports.', source: 'https://heybali.info/news/immigration-reveals-twist-in-viral-ubud-gym-dispute-men-claimed-to-be-israeli-but-entered-bali-on-bulgarian-passports/' },
    { date: '2026-08-22', time: '07:10', category: 'GOVERNMENT', title: 'Algerian National Deported After Completing Bangli Prison Sentence', description: 'An Algerian man was deported from Bali immediately after finishing a prison term at the Bangli detention center, part of routine immigration enforcement.', source: 'https://heybali.info/news/algerian-national-deported-from-bali-after-completing-prison-sentence-at-bangli-detention-center/' },
    { date: '2026-08-22', time: '06:05', category: 'INVESTMENT', title: "Data Center Boom Raises Water-Use Concerns on Bali's Coast", description: "As investors weigh new data-center projects along Bali's coastline, analysts warned that facilities' heavy water demands could strain resources already under pressure from tourism growth.", source: 'https://heybali.info/news/ais-hidden-water-problem-why-balis-coastline-should-be-watching-the-data-center-boom/' },
    { date: '2026-08-25', time: '07:00', category: 'INCIDENTS', title: 'British Tourist Dies Weeks After Alleged Kuta Bar Assault', description: 'A British national died nearly two weeks after an alleged assault by four foreign nationals outside a Kuta bar, with all four suspects having already left Indonesia before he died.', source: 'https://heybali.info/news/timeline-how-a-bar-confrontation-in-kuta-led-to-a-british-tourists-death-and-his-four-alleged-attackers-fleeing-to-australia/' },
    { date: '2026-08-25', time: '06:40', category: 'LOCAL', title: "Indonesian Celebrities Criticize Foreign Tourists' Behavior in Bali", description: 'Public figures Pongki Barata and Sophie Navita publicly called out a recurring habit among some foreign visitors, reigniting online debate about tourist etiquette on the island.', source: 'https://heybali.info/news/indonesian-celebrities-call-out-foreign-tourists-in-bali-over-one-surprising-habit/' },
    { date: '2026-08-25', time: '07:55', category: 'GOVERNMENT', title: 'Immigration Tracks Four Australians Linked to Fatal Tourist Assault', description: 'Bali police confirmed they are working with international counterparts (Hubinter) to track four Australian men connected to a fatal tourist assault, after determining all four had already exited Indonesia.', source: 'https://heybali.info/news/bali-police-ask-hubinter-to-track-four-australians-in-fatal-tourist-assault/' },
    { date: '2026-08-06', time: '06:05', category: 'TOURISM', title: 'June Arrivals Climb 4.6 Percent as Q3 Tourism Push Begins', description: 'Foreign tourist arrivals in Bali reached 605,013 in June 2026, up 4.63 percent from May, as national officials pushed a renewed third-quarter tourism and investment campaign.', source: 'https://en.antaranews.com/amp/news/425884/indonesia-targets-investment-tourism-growth-in-q3-2026' },
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

            // Re-check riskLevel the AI actually assigned - route to DRAFT even if not on the manual list.
            if (status === 'PUBLISHED' && (article.riskLevel === 'HIGH' || article.riskLevel === 'CRITICAL')) {
                await db.article.update({ where: { id: article.id }, data: { status: 'DRAFT', publishedAt: null } })
                console.log(`  -> DRAFT (AI flagged riskLevel=${article.riskLevel}) - image: ${article.imageSource}`)
            } else {
                console.log(`  -> ${status} - image: ${article.imageSource}`)
            }

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
