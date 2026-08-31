import { db } from '@/lib/db'
import { SITE_URL, SITE_NAME } from '@/lib/site-config'

export const revalidate = 300 // 5 minutes - news sitemaps are meant to stay fresh

/**
 * Google News-specific sitemap (https://developers.google.com/search/docs/crawling-indexing/sitemaps/news-sitemap)
 * - a plain sitemap.xml entry is not enough to be picked up by Google News,
 * it needs the <news:news> namespace with a publication date. Google only
 * considers articles published in the last 2 days for this feed, so this
 * intentionally stays small and fast rather than listing the whole archive
 * (that's what the regular /sitemap.xml is for).
 */
function escapeXml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;')
}

export async function GET() {
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 3600 * 1000)

    const articles = await db.article.findMany({
        where: { status: 'PUBLISHED', publishedAt: { gte: twoDaysAgo } },
        select: { slug: true, title: true, publishedAt: true, category: true },
        orderBy: { publishedAt: 'desc' },
        take: 1000,
    })

    const urls = articles
        .map((article) => {
            const loc = `${SITE_URL}/article/${article.slug}`
            const pubDate = (article.publishedAt ?? new Date()).toISOString()
            return `  <url>
    <loc>${escapeXml(loc)}</loc>
    <news:news>
      <news:publication>
        <news:name>${escapeXml(SITE_NAME)}</news:name>
        <news:language>en</news:language>
      </news:publication>
      <news:publication_date>${pubDate}</news:publication_date>
      <news:title>${escapeXml(article.title)}</news:title>
      <news:keywords>${escapeXml(article.category)}</news:keywords>
    </news:news>
  </url>`
        })
        .join('\n')

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${urls}
</urlset>`

    return new Response(xml, {
        headers: {
            'Content-Type': 'application/xml; charset=utf-8',
            'Cache-Control': 'public, max-age=300, stale-while-revalidate=60',
        },
    })
}
