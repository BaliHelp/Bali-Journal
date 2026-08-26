import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth/session'
import { storeAdMedia } from '@/lib/ads/media'

interface Params {
    params: Promise<{ id: string }>
}

async function requireEditor() {
    const session = await getSession()
    return session && (session.role === 'ADMIN' || session.role === 'EDITOR') ? session : null
}

/**
 * Accepts either JSON (quick isActive toggle from the table) or multipart
 * form data (full edit dialog - name/link/dates plus an optional creative
 * replacement). Keeping both means the existing one-click toggle doesn't
 * need to change while the new edit dialog gets everything it needs.
 */
export async function PATCH(req: NextRequest, { params }: Params) {
    if (!(await requireEditor())) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const { id } = await params
        const contentType = req.headers.get('content-type') || ''

        if (contentType.includes('application/json')) {
            const body = await req.json()
            const ad = await db.ad.update({
                where: { id },
                data: {
                    isActive: body.isActive,
                    linkUrl: body.linkUrl,
                    startDate: body.startDate ? new Date(body.startDate) : undefined,
                    endDate: body.endDate ? new Date(body.endDate) : undefined,
                },
            })
            return NextResponse.json({ ad })
        }

        const formData = await req.formData()
        const advertiserName = formData.get('advertiserName') as string | null
        const linkUrl = formData.get('linkUrl') as string | null
        const startDate = formData.get('startDate') as string | null
        const endDate = formData.get('endDate') as string | null
        const isActiveRaw = formData.get('isActive') as string | null
        const file = formData.get('file')

        let mediaUrl: string | undefined
        let mediaType: 'IMAGE' | 'VIDEO' | undefined
        if (file instanceof File && file.size > 0) {
            const existing = await db.ad.findUnique({ where: { id } })
            const stored = await storeAdMedia(file, advertiserName || existing?.advertiserName || 'ad')
            if ('error' in stored) {
                return NextResponse.json({ error: stored.error }, { status: 400 })
            }
            mediaUrl = stored.url
            mediaType = stored.mediaType
        }

        const ad = await db.ad.update({
            where: { id },
            data: {
                advertiserName: advertiserName || undefined,
                linkUrl: linkUrl !== null ? (linkUrl.trim() || null) : undefined,
                startDate: startDate ? new Date(startDate) : undefined,
                endDate: endDate ? new Date(endDate) : undefined,
                isActive: isActiveRaw !== null ? isActiveRaw === 'true' : undefined,
                mediaUrl,
                mediaType,
            },
        })
        return NextResponse.json({ ad })
    } catch (error) {
        console.error('Update ad error:', error)
        return NextResponse.json({ error: 'Failed to update ad' }, { status: 500 })
    }
}

export async function DELETE(req: NextRequest, { params }: Params) {
    if (!(await requireEditor())) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const { id } = await params
        await db.ad.delete({ where: { id } })
        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Delete ad error:', error)
        return NextResponse.json({ error: 'Failed to delete ad' }, { status: 500 })
    }
}
