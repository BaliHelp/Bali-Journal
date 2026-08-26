import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth/session'

async function requireAdmin() {
    const session = await getSession()
    return session && session.role === 'ADMIN' ? session : null
}

export async function GET() {
    if (!(await requireAdmin())) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const slots = await db.adSlot.findMany({
        orderBy: { createdAt: 'desc' },
        include: { ads: { select: { id: true, isActive: true } } },
    })
    return NextResponse.json({ slots })
}

export async function POST(req: NextRequest) {
    if (!(await requireAdmin())) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const body = await req.json()
        const { name, position, device, width, height } = body

        if (!name || !position || !device || !width || !height) {
            return NextResponse.json({ error: 'name, position, device, width, height are required' }, { status: 400 })
        }

        const slot = await db.adSlot.create({
            data: { name, position, device, width: Number(width), height: Number(height) },
        })
        return NextResponse.json({ slot })
    } catch (error) {
        console.error('Create ad slot error:', error)
        return NextResponse.json({ error: 'Failed to create ad slot' }, { status: 500 })
    }
}
