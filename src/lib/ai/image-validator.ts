const BROWSER_UA =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

export async function validateImageUrl(url: string): Promise<boolean> {
    if (!url) return false

    // Locally-stored images are always considered valid — the file lives on
    // our own server, no third-party availability involved.
    if (url.startsWith('/uploads/')) return true

    try {
        // Check if it's a valid URL string
        new URL(url)

        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 15_000)

        const res = await fetch(url, {
            method: 'HEAD',
            redirect: 'follow',
            signal: controller.signal,
            headers: { 'User-Agent': BROWSER_UA },
        })

        clearTimeout(timeoutId)

        if (!res.ok) return false

        const contentType = res.headers.get('content-type')
        return contentType?.startsWith('image/') || false
    } catch (error) {
        console.warn(`Image validation failed for ${url}:`, error)
        return false
    }
}

export async function checkArticleImages(articles: any[]) {
    const updates = []

    for (const article of articles) {
        if (article.featuredImageUrl) {
            const isValid = await validateImageUrl(article.featuredImageUrl)
            if (!isValid) {
                updates.push({
                    id: article.id,
                    title: article.title,
                    status: 'BROKEN_IMAGE'
                })
            }
        } else {
            updates.push({
                id: article.id,
                title: article.title,
                status: 'MISSING_IMAGE'
            })
        }
    }

    return updates
}
