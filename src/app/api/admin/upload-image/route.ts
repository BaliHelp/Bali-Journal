import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'
import { getSession } from '@/lib/auth/session'
import { persistImage } from '@/lib/images/image-service'

const MAX_UPLOAD_BYTES = 15 * 1024 * 1024 // 15MB ceiling for a photo before WebP conversion
const WEBP_MAX_WIDTH = 1600 // good visual quality without an oversized file
const WEBP_QUALITY = 82

/**
 * Generic "upload a photo, get back a WebP URL" endpoint - unlike
 * /api/admin/articles/[id]/upload-image, this doesn't require an existing
 * article, so the Create Article dialog can offer image upload before the
 * article itself has been saved (it just fills the featuredImageUrl field
 * with the returned URL, same as pasting a URL manually).
 */
export async function POST(req: NextRequest) {
    try {
        const session = await getSession()
        if (!session || (session.role !== 'ADMIN' && session.role !== 'EDITOR')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const formData = await req.formData()
        const file = formData.get('file')
        const label = formData.get('label')

        if (!(file instanceof File)) {
            return NextResponse.json({ error: 'file is required' }, { status: 400 })
        }
        if (file.size > MAX_UPLOAD_BYTES) {
            return NextResponse.json({ error: 'File too large (max 15MB)' }, { status: 400 })
        }
        if (!file.type.startsWith('image/')) {
            return NextResponse.json({ error: 'File must be an image' }, { status: 400 })
        }

        const inputBuffer = Buffer.from(await file.arrayBuffer())
        const webpBuffer = await sharp(inputBuffer)
            .resize({ width: WEBP_MAX_WIDTH, withoutEnlargement: true })
            .webp({ quality: WEBP_QUALITY })
            .toBuffer()

        const url = await persistImage(webpBuffer, 'image/webp', typeof label === 'string' && label ? label : 'image')

        return NextResponse.json({ url })
    } catch (error) {
        console.error('Upload image error:', error)
        return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 })
    }
}
