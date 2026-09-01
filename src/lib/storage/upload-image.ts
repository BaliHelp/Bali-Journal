import { createClient } from '@supabase/supabase-js'

/**
 * Persistent image storage for article photos.
 *
 * Replaces the old local-disk approach (fs.writeFile into public/uploads/)
 * which is fundamentally broken on Vercel: serverless functions have a
 * read-only filesystem at runtime, and public/uploads/ was gitignored
 * anyway, so nothing written there ever reached production - confirmed via
 * a real deploy where every article photo 404'd (2026-09-01).
 *
 * Primary: Supabase Storage (same project as the DB, no new account).
 * Fallback: Vercel Blob - if Supabase Storage upload fails for any reason
 * (bucket misconfigured, quota, transient error), the image still gets
 * stored instead of the article silently ending up with no photo. This is
 * deliberate redundancy per user request ("kita harus punya cadangan"),
 * not just an error path.
 */

const BUCKET = 'article-images'

let supabaseAdmin: ReturnType<typeof createClient> | null = null
function getSupabaseAdmin() {
    if (supabaseAdmin) return supabaseAdmin
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !serviceKey) return null
    supabaseAdmin = createClient(url, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
    })
    return supabaseAdmin
}

async function uploadToSupabase(
    buffer: Buffer,
    contentType: string,
    fileName: string
): Promise<string | null> {
    const client = getSupabaseAdmin()
    if (!client) return null
    try {
        const { error } = await client.storage.from(BUCKET).upload(fileName, buffer, {
            contentType,
            upsert: false,
        })
        if (error) {
            console.error('Supabase Storage upload failed:', error.message)
            return null
        }
        const { data } = client.storage.from(BUCKET).getPublicUrl(fileName)
        return data.publicUrl
    } catch (error) {
        console.error('Supabase Storage upload threw:', error)
        return null
    }
}

async function uploadToVercelBlob(
    buffer: Buffer,
    contentType: string,
    fileName: string
): Promise<string | null> {
    if (!process.env.BLOB_READ_WRITE_TOKEN) return null
    try {
        const { put } = await import('@vercel/blob')
        const result = await put(fileName, buffer, {
            access: 'public',
            contentType,
            addRandomSuffix: false,
        })
        return result.url
    } catch (error) {
        console.error('Vercel Blob upload failed:', error)
        return null
    }
}

/**
 * Uploads an image buffer to persistent cloud storage and returns its
 * public URL (a full https:// URL now, NOT a local "/uploads/..." path).
 * Tries Supabase Storage first, falls back to Vercel Blob. Returns null
 * only if BOTH fail (or neither is configured) - callers should treat that
 * the same as "no image available", same as before.
 */
export async function uploadImage(
    buffer: Buffer,
    contentType: string,
    fileName: string
): Promise<{ url: string; provider: 'supabase' | 'vercel-blob' } | null> {
    const supabaseUrl = await uploadToSupabase(buffer, contentType, fileName)
    if (supabaseUrl) return { url: supabaseUrl, provider: 'supabase' }

    const blobUrl = await uploadToVercelBlob(buffer, contentType, fileName)
    if (blobUrl) return { url: blobUrl, provider: 'vercel-blob' }

    return null
}
