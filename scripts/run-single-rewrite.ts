/**
 * One-off runner for rewriteExternalNewsToArticle() - same pipeline the
 * admin "Rewrite External News" panel uses (src/app/api/ai/rewrite-news/
 * route.ts), just invoked directly instead of through the authenticated
 * HTTP endpoint. Saved as DRAFT (not auto-published) since immigration/
 * nationality-related stories go through the normal legal-risk review flow
 * before publish, same as every other AI-generated article.
 *
 * Usage: bun scripts/run-single-rewrite.ts <url> [category]
 */
import { rewriteExternalNewsToArticle } from '../src/lib/ai/rewrite-external-news'
import type { Category } from '@prisma/client'

const url = process.argv[2]
const category = (process.argv[3] as Category) || 'GOVERNMENT'

if (!url) {
    console.error('Usage: bun scripts/run-single-rewrite.ts <url> [category]')
    process.exit(1)
}

rewriteExternalNewsToArticle({
    url,
    category,
    status: 'DRAFT',
    onProgress: (stage) => console.log('->', stage),
})
    .then(({ article, imageSource }) => {
        console.log('\n=== DONE ===')
        console.log('id:', article.id)
        console.log('slug:', article.slug)
        console.log('title:', article.title)
        console.log('category:', article.category)
        console.log('riskLevel:', article.riskLevel)
        console.log('status:', article.status)
        console.log('sourceUrl:', article.sourceUrl)
        console.log('featuredImageUrl:', article.featuredImageUrl)
        console.log('imageSource:', imageSource)
    })
    .catch((err) => {
        console.error('FAILED:', err)
        process.exit(1)
    })
