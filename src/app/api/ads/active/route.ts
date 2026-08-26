import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Public - no auth. Just reads currently-running ads for one slot position,
// nothing sensitive (advertiserName/media are meant to be shown publicly).
export async function GET(req: NextRequest) {
    const position = req.nextUrl.searchParams.get('position')
    if (!position) {
        return NextResponse.json({ error: 'position query param is required' }, { status: 400 })
    }

    const now = new Date()
    const ads = await db.ad.findMany({
        where: {
            isActive: true,
            startDate: { lte: now },
            endDate: { gte: now },
            slot: { position: position as any },
        },
        include: { slot: true },
        orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ ads })
}
