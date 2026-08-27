// Unsplash search API - real stock photography, not generative AI. Used as
// an additional rotation source specifically for the Feb-Aug 2026 bulk
// backfill batch (see scripts/bulk-backfill-content.ts): unlike Pollinations,
// there's no generative-model failure mode to worry about here (the images
// are real photos taken by real photographers), so it's a safe way to widen
// visual variety without touching the Gemini-majority ratio that the
// generator pool normally uses for safety reasons (see image-service.ts).
//
// Free tier: https://unsplash.com/developers - needs UNSPLASH_ACCESS_KEY in
// .env. If the key is missing or the request fails, this just returns null
// and the caller's fallback chain moves on - same pattern as every other
// candidate source.

interface UnsplashSearchResult {
    results: { urls: { regular: string } }[]
}

export async function searchUnsplashPhoto(query: string): Promise<{ buffer: Buffer; contentType: string } | null> {
    const accessKey = process.env.UNSPLASH_ACCESS_KEY
    if (!accessKey) return null

    try {
        const searchRes = await fetch(
            `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=5&orientation=landscape`,
            { headers: { Authorization: `Client-ID ${accessKey}` }, signal: AbortSignal.timeout(15_000) }
        )
        if (!searchRes.ok) return null

        const data = (await searchRes.json()) as UnsplashSearchResult
        if (!data.results || data.results.length === 0) return null

        const pick = data.results[Math.floor(Math.random() * data.results.length)]
        const imageRes = await fetch(pick.urls.regular, { signal: AbortSignal.timeout(15_000) })
        if (!imageRes.ok) return null

        const buffer = Buffer.from(await imageRes.arrayBuffer())
        const contentType = imageRes.headers.get('content-type') || 'image/jpeg'
        return { buffer, contentType }
    } catch {
        return null
    }
}
