import sharp from 'sharp'
import { uploadImage } from '@/lib/storage/upload-image'

/**
 * Media storage for ad creatives and advertiser proof uploads - images get
 * the same WebP conversion as article photos; video/PDF are stored as-is
 * (no server-side transcoding - not worth the complexity for admin-only
 * uploads, and the browser will simply refuse to play an unsupported codec
 * if one slips through, it's not a security issue).
 *
 * Uploads go through the shared cloud storage helper (Supabase Storage,
 * Vercel Blob fallback - src/lib/storage/upload-image.ts), NOT local disk.
 * This used to write to public/uploads/ads and public/uploads/proofs on
 * local disk, which is broken on Vercel the same way article images were
 * (read-only filesystem at runtime, folder gitignored anyway) - fixed
 * alongside that bug, 2026-09-01.
 */

const MAX_IMAGE_BYTES = 8 * 1024 * 1024 // 8MB
const MAX_VIDEO_BYTES = 25 * 1024 * 1024 // 25MB - short looped ad clips only
const MAX_PROOF_BYTES = 8 * 1024 * 1024 // 8MB
const WEBP_QUALITY = 85

const ALLOWED_VIDEO_TYPES = new Set(['video/webm', 'video/mp4'])

function randomSuffix(): string {
    return Math.floor(Math.random() * 1_000_000).toString(36)
}

function safeBaseName(name: string): string {
    return (
        name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '')
            .slice(0, 60) || 'ad'
    )
}

export async function storeAdMedia(
    file: File,
    label: string
): Promise<{ url: string; mediaType: 'IMAGE' | 'VIDEO' } | { error: string }> {
    const base = safeBaseName(label)

    if (file.type.startsWith('image/')) {
        if (file.size > MAX_IMAGE_BYTES) return { error: 'Image too large (max 8MB)' }
        const buffer = Buffer.from(await file.arrayBuffer())
        const webp = await sharp(buffer).webp({ quality: WEBP_QUALITY }).toBuffer()
        const fileName = `ads/${base}-${randomSuffix()}.webp`
        const result = await uploadImage(webp, 'image/webp', fileName)
        if (!result) return { error: 'Upload failed - storage unavailable' }
        return { url: result.url, mediaType: 'IMAGE' }
    }

    if (ALLOWED_VIDEO_TYPES.has(file.type)) {
        if (file.size > MAX_VIDEO_BYTES) return { error: 'Video too large (max 25MB)' }
        const buffer = Buffer.from(await file.arrayBuffer())
        const ext = file.type === 'video/webm' ? 'webm' : 'mp4'
        const fileName = `ads/${base}-${randomSuffix()}.${ext}`
        const result = await uploadImage(buffer, file.type, fileName)
        if (!result) return { error: 'Upload failed - storage unavailable' }
        return { url: result.url, mediaType: 'VIDEO' }
    }

    return { error: 'File must be an image, or a .webm/.mp4 video' }
}

/**
 * Bank transfer proof uploads (advertiser self-service payment flow) - images
 * get the same WebP treatment as everything else, but a PDF receipt can't go
 * through sharp so it's stored as-is.
 */
export async function storeProofFile(
    file: File,
    label: string
): Promise<{ url: string } | { error: string }> {
    if (file.size > MAX_PROOF_BYTES) return { error: 'File too large (max 8MB)' }

    const base = safeBaseName(label)

    if (file.type.startsWith('image/')) {
        const buffer = Buffer.from(await file.arrayBuffer())
        const webp = await sharp(buffer).webp({ quality: WEBP_QUALITY }).toBuffer()
        const fileName = `proofs/${base}-${randomSuffix()}.webp`
        const result = await uploadImage(webp, 'image/webp', fileName)
        if (!result) return { error: 'Upload failed - storage unavailable' }
        return { url: result.url }
    }

    if (file.type === 'application/pdf') {
        const buffer = Buffer.from(await file.arrayBuffer())
        const fileName = `proofs/${base}-${randomSuffix()}.pdf`
        const result = await uploadImage(buffer, 'application/pdf', fileName)
        if (!result) return { error: 'Upload failed - storage unavailable' }
        return { url: result.url }
    }

    return { error: 'File must be an image or a PDF' }
}
