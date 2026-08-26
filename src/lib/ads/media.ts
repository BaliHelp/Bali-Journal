import fs from 'fs/promises'
import path from 'path'
import sharp from 'sharp'

/**
 * Media storage for ad creatives - separate upload dir from article images
 * (public/uploads/ads) since ads can be video, unlike anything else in the
 * image pipeline. Images get the same WebP conversion as article photos
 * (image-service.ts); video is stored as-is (webm/mp4), no server-side
 * transcoding - not worth the complexity for admin-only uploads, and the
 * browser will simply refuse to play an unsupported codec if one slips
 * through, it's not a security issue.
 */

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads', 'ads')
const PUBLIC_PREFIX = '/uploads/ads'
const MAX_IMAGE_BYTES = 8 * 1024 * 1024 // 8MB
const MAX_VIDEO_BYTES = 25 * 1024 * 1024 // 25MB - short looped ad clips only
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
    await fs.mkdir(UPLOAD_DIR, { recursive: true })
    const base = safeBaseName(label)

    if (file.type.startsWith('image/')) {
        if (file.size > MAX_IMAGE_BYTES) return { error: 'Image too large (max 8MB)' }
        const buffer = Buffer.from(await file.arrayBuffer())
        const webp = await sharp(buffer).webp({ quality: WEBP_QUALITY }).toBuffer()
        const fileName = `${base}-${randomSuffix()}.webp`
        await fs.writeFile(path.join(UPLOAD_DIR, fileName), webp)
        return { url: `${PUBLIC_PREFIX}/${fileName}`, mediaType: 'IMAGE' }
    }

    if (ALLOWED_VIDEO_TYPES.has(file.type)) {
        if (file.size > MAX_VIDEO_BYTES) return { error: 'Video too large (max 25MB)' }
        const buffer = Buffer.from(await file.arrayBuffer())
        const ext = file.type === 'video/webm' ? 'webm' : 'mp4'
        const fileName = `${base}-${randomSuffix()}.${ext}`
        await fs.writeFile(path.join(UPLOAD_DIR, fileName), buffer)
        return { url: `${PUBLIC_PREFIX}/${fileName}`, mediaType: 'VIDEO' }
    }

    return { error: 'File must be an image, or a .webm/.mp4 video' }
}
