// Client for the MyAI OS gateway (https://console.myai.nexus).
//
// NOTE: this is NOT an OpenAI-compatible API despite superficial similarity.
// You send a `field` (task category) instead of a `model` - the gateway
// picks the underlying provider/model itself via internal tier routing
// (see GET /api/v1/models for the live tier config, which can change every
// ~12h). The response shape is also custom: { result, provider_used, ... },
// not OpenAI's { choices: [{ message }] }.
//
// `result` may come back wrapped in a ```json fenced code block even when
// the prompt asks for raw JSON, so JSON-expecting callers should use
// myaiCompleteJSON() rather than parsing `result` directly.

const MYAI_BASE_URL = process.env.MYAI_BASE_URL || 'https://console.myai.nexus/api/v1'

// The gateway's full field list is larger (OCR, visa docs, etc.) - only the
// ones this app actually uses are listed here.
export type MyaiField =
    | 'content_journalist'
    | 'reasoning_general'
    | 'chatbot'

// Per-agent task field. WIE (writer) and WUE (breaking news) both produce
// article copy, AUDY (compliance/moderation/legal-risk/tone) makes judgment
// calls rather than writing prose, AS (coordinator) just needs short
// conversational replies.
//
// NOTE: 'chatbot_general' was tried for AS but the gateway injects its own
// baked-in persona for that field (a visa/IT services assistant) that
// bleeds into responses regardless of our system prompt. Plain 'chatbot'
// stays neutral and follows our persona correctly.
export const MYAI_FIELDS = {
    WIE: 'content_journalist',
    AUDY: 'reasoning_general',
    AS: 'chatbot',
    WUE: 'content_journalist',
} as const satisfies Record<string, MyaiField>

export type AgentKey = keyof typeof MYAI_FIELDS

export interface MyaiMessage {
    role: 'system' | 'user' | 'assistant'
    content: string
}

interface MyaiResponse {
    field: string
    schema_version: string
    provider_used: string
    processed_at: string
    // Despite the name, this is NOT always a string: for plain-text prompts
    // some fields (e.g. content_journalist) wrap it as { response: "..." },
    // and for prompts that imply a JSON schema it comes back as that schema
    // already parsed into an object. See normalizeResult().
    result: unknown
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
}

// Collapses the gateway's inconsistent `result` shapes down to a single
// string: pass strings through, unwrap the { response: "..." } convention
// used for plain-text replies, and stringify anything else (e.g. an
// already-parsed JSON object) so callers always get text back.
function normalizeResult(result: unknown): string {
    if (typeof result === 'string') return result
    if (result && typeof result === 'object') {
        const maybeResponse = (result as Record<string, unknown>).response
        if (typeof maybeResponse === 'string') return maybeResponse
        return JSON.stringify(result)
    }
    return String(result)
}

export async function myaiComplete(field: MyaiField, messages: MyaiMessage[]): Promise<string> {
    const res = await fetch(`${MYAI_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.MYAI_API_KEY}`,
        },
        body: JSON.stringify({ field, messages }),
    })

    if (!res.ok) {
        throw new Error(`MyAI OS request failed (${res.status}): ${await res.text()}`)
    }

    const data: MyaiResponse = await res.json()
    return normalizeResult(data.result)
}

// The gateway wraps JSON in ```json fences even when asked for raw JSON,
// and sometimes appends extra prose commentary after the closing fence.
// Pull out just the JSON: prefer the fenced block if present, then find the
// first balanced {...} or [...] (string-literal aware, so braces inside
// quoted text don't throw off the bracket count).
function extractJson(raw: string): string {
    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)
    const text = fenced ? fenced[1] : raw

    const start = text.search(/[[{]/)
    if (start === -1) return text.trim()

    const open = text[start]
    const close = open === '{' ? '}' : ']'
    let depth = 0
    let inString = false
    let escaped = false
    for (let i = start; i < text.length; i++) {
        const ch = text[i]
        if (inString) {
            if (escaped) escaped = false
            else if (ch === '\\') escaped = true
            else if (ch === '"') inString = false
            continue
        }
        if (ch === '"') { inString = true; continue }
        if (ch === open) depth++
        else if (ch === close) {
            depth--
            if (depth === 0) return text.slice(start, i + 1)
        }
    }
    return text.slice(start).trim()
}

export async function myaiCompleteJSON<T = any>(field: MyaiField, messages: MyaiMessage[]): Promise<T> {
    const raw = await myaiComplete(field, messages)
    return JSON.parse(extractJson(raw))
}

export async function myaiPing(): Promise<void> {
    const res = await fetch(`${MYAI_BASE_URL}/models`)
    if (!res.ok) throw new Error(`MyAI OS ping failed (${res.status})`)
}
