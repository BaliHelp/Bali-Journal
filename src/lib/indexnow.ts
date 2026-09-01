import { SITE_URL, SITE_DOMAIN } from '@/lib/site-config'

// IndexNow protocol (https://www.indexnow.org) - one shared endpoint that
// fans out to every participating search engine (Bing, Yandex, and others),
// so publishing an article doesn't have to wait for their crawlers to
// discover it on their own schedule. Key must match the .txt file hosted
// at the site root (public/<key>.txt) - see Bing Webmaster Tools' own
// IndexNow setup instructions, which is where this key came from.
const INDEXNOW_KEY = '9fdc400c5f92422a82d1c73987c5b221'
const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow'

/**
 * Submits a batch of URLs to IndexNow. Best-effort - a failure here should
 * never break the actual publish flow, so this never throws; callers just
 * get a boolean back.
 */
export async function submitToIndexNow(urls: string[]): Promise<boolean> {
    if (urls.length === 0) return true

    try {
        const res = await fetch(INDEXNOW_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
            body: JSON.stringify({
                host: SITE_DOMAIN,
                key: INDEXNOW_KEY,
                keyLocation: `${SITE_URL}/${INDEXNOW_KEY}.txt`,
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
