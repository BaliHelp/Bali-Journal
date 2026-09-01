import { SITE_URL, SITE_DOMAIN } from '@/lib/site-config'

// IndexNow protocol (https://www.indexnow.org) - one shared endpoint that
// fans out to every participating search engine (Bing, Yandex, and others),
// so publishing an article doesn't have to wait for their crawlers to
// discover it on their own schedule.
//
// Key comes from INDEXNOW_KEY (env var, not hardcoded - this project gets
// copied wholesale to sibling projects with different domains, e.g.
// Jurnal Kotabunan, and a hardcoded key would silently submit URLs under
// the WRONG site's identity). The key must also match a .txt file hosted
// at the site root: public/<key>.txt containing just the key itself (get
// both from Bing Webmaster Tools -> your site -> IndexNow). Missing the
// env var just skips submission (logged once) rather than breaking
// anything - same fail-open pattern as this project's other optional
// integrations.
const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow'

/**
 * Submits a batch of URLs to IndexNow. Best-effort - a failure here should
 * never break the actual publish flow, so this never throws; callers just
 * get a boolean back.
 */
export async function submitToIndexNow(urls: string[]): Promise<boolean> {
    if (urls.length === 0) return true

    const key = process.env.INDEXNOW_KEY
    if (!key) {
        console.warn('INDEXNOW_KEY not set - skipping IndexNow submission. See .env.example.')
        return false
    }

    try {
        const res = await fetch(INDEXNOW_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
            body: JSON.stringify({
                host: SITE_DOMAIN,
                key,
                keyLocation: `${SITE_URL}/${key}.txt`,
                urlList: urls,
            }),
        })
        // IndexNow returns 200 or 202 on success - anything else means the
        // batch was rejected (bad key, malformed host, etc.)
        if (!res.ok) {
            console.error(`IndexNow submission failed: ${res.status} ${await res.text().catch(() => '')}`)
            return false
        }
        return true
    } catch (err) {
        console.error('IndexNow submission error:', err)
        return false
    }
}
