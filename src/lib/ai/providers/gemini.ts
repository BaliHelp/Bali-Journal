// Direct Google AI Studio (Gemini) client - deliberately NOT routed through
// MyAI OS. Two things needed it to go direct:
//
// 1. Image generation (`gemini-3.1-flash-lite-image` etc.) - MyAI OS lists
//    these models in its catalog but never wires them into any callable
//    field, so they're unreachable through myaiClient.ts.
// 2. Vision input (reading an image back, e.g. for the NSFW safety gate) -
//    confirmed by direct test that MyAI OS's /chat/completions 500s on any
//    array-shaped `content` (the format multimodal input requires), even
//    text-only arrays. Its own gateway doesn't expose vision at all today,
//    regardless of what individual models claim to support.
//
// COST NOTE: image generation requires an account with active billing - the
// free tier's quota for image-output models is hard-capped at 0, not just
// rate-limited. Vision INPUT (reading an image) is free-tier and confirmed
// working on every key regardless of billing status. So checkImageSafety()
// works on any key; generateImage() only succeeds on a funded one.

const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta'

// Multiple keys = multiple independent Google quotas (unlike OpenRouter,
// which explicitly pools rate limits per-organization regardless of key
// count - see myaiClient.ts's OpenRouter notes for that contrast).
//
// KEY STATUS (checked 2026-08-26 against all 5 keys directly):
//   KEY1, KEY4 - billing enabled, generate images successfully. Both listed
//     first so generateImage()'s round-robin (see imageKeyRotation below)
//     spreads concurrent image jobs across the two funded keys instead of
//     queueing them behind one - e.g. insertInlineImages() firing 2 inline
//     images at once now genuinely runs them in parallel on KEY1 + KEY4.
//   KEY (base), KEY2, KEY3, KEY5 - free tier: image-output quota is a hard
//     "limit: 0", but text and vision INPUT work fine on all of them, so
//     they're still useful as extra checkImageSafety() capacity even though
//     generateImage() will just skip past them if KEY1/KEY4 are both down.
// A key that starts failing (billing runs out again, rate limit, etc.)
// simply falls through to the next one in the list - no code change needed,
// just re-verify with a direct curl test and reorder this array if the
// funded/free split changes.
function apiKeys(): string[] {
    return [
        process.env.GEMINI_API_KEY1,
        process.env.GEMINI_API_KEY4,
        process.env.GEMINI_API_KEY,
        process.env.GEMINI_API_KEY2,
        process.env.GEMINI_API_KEY3,
        process.env.GEMINI_API_KEY5,
    ].filter((k): k is string => !!k)
}

interface GeminiPart {
    text?: string
    inlineData?: { mimeType: string; data: string }
}

async function callGenerateContent(
    model: string,
    parts: GeminiPart[],
    apiKey: string
): Promise<{ ok: true; data: any } | { ok: false; status: number; error: string }> {
    const res = await fetch(`${GEMINI_BASE_URL}/models/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts }] }),
    })

    if (!res.ok) {
        const errorText = await res.text()
        return { ok: false, status: res.status, error: errorText }
    }
    return { ok: true, data: await res.json() }
}

/**
 * Classifies whether an image contains nudity/sexual content. This is the
 * enforcement layer behind the prompt-level SAFE_CONTENT_CLAUSE in
 * image-service.ts - that clause asks generators nicely; this actually
 * looks at the pixels before the file gets published.
 *
 * Fails CLOSED: if every key errors out (quota, network, whatever), this
 * returns unsafe=true so the caller discards the image rather than
 * publishing something nobody actually verified.
 */
export async function checkImageSafety(
    buffer: Buffer,
    mimeType: string
): Promise<{ safe: boolean; reason: string }> {
    const base64 = buffer.toString('base64')
    const keys = apiKeys()

    if (keys.length === 0) {
        return { safe: false, reason: 'No GEMINI_API_KEY configured - cannot verify, failing closed' }
    }

    const prompt =
        'You are a content safety classifier for a public news website. Look at this image and answer ' +
        'ONLY with a JSON object: {"nudity": true or false, "reason": "short explanation"}. ' +
        'Set nudity=true for any nudity, sexual content, or content inappropriate for a general-audience ' +
        'news outlet. Set nudity=false for a normal editorial/news photo (clothed people, places, objects, events).'

    for (const key of keys) {
        const result = await callGenerateContent(
            'gemini-3.6-flash',
            [{ text: prompt }, { inlineData: { mimeType, data: base64 } }],
            key
        )

        if (!result.ok) {
            // Quota/billing on this key - try the next one instead of failing outright.
            if (result.status === 429) continue
            console.error(`Gemini vision safety check failed (status ${result.status}):`, result.error)
            continue
        }

        try {
            const text: string = result.data.candidates[0].content.parts[0].text
            const parsed = JSON.parse(text.replace(/```json\s*|```/g, '').trim())
            return { safe: !parsed.nudity, reason: parsed.reason || '' }
        } catch (error) {
            console.error('Could not parse Gemini safety-check response:', error)
            continue
        }
    }

    return { safe: false, reason: 'All Gemini keys failed to classify - failing closed' }
}

// Round-robins which key each generateImage() call STARTS with, so that
// concurrent calls (e.g. Promise.all() generating 2 inline images at once -
// see insertInlineImages() in image-service.ts) land on different funded
// keys instead of both queuing behind the same one. Safe under concurrency:
// this counter is read+incremented synchronously before the first `await`
// in generateImage(), so back-to-back calls each grab a distinct starting
// index even though their actual network requests then run in parallel.
//
// Rotates ONLY across the known-funded keys (KEY1/KEY4) - free-tier keys
// are guaranteed to 429 on image output (confirmed: hard "limit: 0", not a
// rate limit that might succeed), so including them in the round-robin just
// burns a request-and-fail before reaching a key that can actually work.
// They're still appended as a last-resort fallback in case BOTH funded keys
// are down (e.g. billing lapses again) - just not part of the rotation.
function fundedImageKeys(): string[] {
    return [process.env.GEMINI_API_KEY1, process.env.GEMINI_API_KEY4].filter((k): k is string => !!k)
}

let imageKeyRotation = 0

/**
 * Generates an image via Gemini (Nano Banana). Returns null (not a throw) on
 * failure so callers can fall through to the next generator in their pool -
 * see GENERATOR_POOL in image-service.ts.
 */
export async function generateImage(
    prompt: string,
    model: string = 'gemini-3.1-flash-lite-image'
): Promise<{ buffer: Buffer; mimeType: string } | null> {
    const funded = fundedImageKeys()
    const all = apiKeys()
    if (all.length === 0) return null

    let orderedKeys: string[]
    if (funded.length > 0) {
        const start = imageKeyRotation % funded.length
        imageKeyRotation++
        const rotatedFunded = [...funded.slice(start), ...funded.slice(0, start)]
        orderedKeys = [...rotatedFunded, ...all.filter((k) => !funded.includes(k))]
    } else {
        orderedKeys = all
    }

    for (const key of orderedKeys) {
        const result = await callGenerateContent(model, [{ text: prompt }], key)

        if (!result.ok) {
            console.error(`Gemini image generation failed on this key (status ${result.status}):`, result.error)
            continue
        }

        const parts = result.data?.candidates?.[0]?.content?.parts || []
        const imagePart = parts.find((p: GeminiPart) => p.inlineData)
        if (imagePart?.inlineData) {
            return {
                buffer: Buffer.from(imagePart.inlineData.data, 'base64'),
                mimeType: imagePart.inlineData.mimeType,
            }
        }
    }

    return null
}
