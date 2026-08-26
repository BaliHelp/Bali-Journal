import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth/session'
import { storeAdMedia } from '@/lib/ads/media'

async function requireEditor() {
    const session = await getSession()
    return session && (session.role === 'ADMIN' || session.role === 'EDITOR') ? session : null
}

export async function GET() {
    if (!(await requireEditor())) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const ads = await db.ad.findMany({
        orderBy: { createdAt: 'desc' },
        include: { slot: true },
    })
    return NextResponse.json({ ads })
}

export async function POST(req: NextRequest) {
    if (!(await requireEditor())) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const formData = await req.formData()
        const slotId = formData.get('slotId') as string | null
        const advertiserName = formData.get('advertiserName') as string | null
        const linkUrl = (formData.get('linkUrl') as string | null) || null
        const startDate = formData.get('startDate') as string | null
        const endDate = formData.get('endDate') as string | null
        const file = formData.get('file')

        if (!slotId || !advertiserName || !startDate || !endDate) {
            return NextResponse.json(
                { error: 'slotId, advertiserName, startDate, endDate are required' },
                { status: 400 }
            )
        }
        if (!(file instanceof File)) {
            return NextResponse.json({ error: 'file (image or video) is required' }, { status: 400 })
        }

        const slot = await db.adSlot.findUnique({ where: { id: slotId } })
        if (!slot) {
            return NextResponse.json({ error: 'Ad slot not found' }, { status: 404 })
        }

        const stored = await storeAdMedia(file, advertiserName)
        if ('error' in stored) {
            return NextResponse.json({ error: stored.error }, { status: 400 })
        }

        const ad = await db.ad.create({
            data: {
                slotId,
                advertiserName,
                mediaUrl: stored.url,
                mediaType: stored.mediaType,
                linkUrl,
                startDate: new Date(startDate),
                endDate: new Date(endDate),
            },
        })

        return NextResponse.json({ ad })
    } catch (error) {
        console.error('Create ad error:', error)
        return NextResponse.json({ error: 'Failed to create ad' }, { status: 500 })
    }
}
