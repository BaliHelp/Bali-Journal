import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth/session'

interface Params {
    params: Promise<{ id: string }>
}

async function requireAdmin() {
    const session = await getSession()
    return session && session.role === 'ADMIN' ? session : null
}

export async function PATCH(req: NextRequest, { params }: Params) {
    if (!(await requireAdmin())) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const { id } = await params
        const body = await req.json()
        const slot = await db.adSlot.update({
            where: { id },
            data: {
                name: body.name,
                position: body.position,
                device: body.device,
                width: body.width !== undefined ? Number(body.width) : undefined,
                height: body.height !== undefined ? Number(body.height) : undefined,
                pricePerDay:
                    body.pricePerDay === null
                        ? null
                        : body.pricePerDay !== undefined
                          ? Number(body.pricePerDay)
                          : undefined,
            },
        })
        return NextResponse.json({ slot })
    } catch (error) {
        console.error('Update ad slot error:', error)
        return NextResponse.json({ error: 'Failed to update ad slot' }, { status: 500 })
    }
}

export async function DELETE(req: NextRequest, { params }: Params) {
    if (!(await requireAdmin())) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const { id } = await params
        await db.ad.deleteMany({ where: { slotId: id } })
        await db.adSlot.delete({ where: { id } })
        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Delete ad slot error:', error)
        return NextResponse.json({ error: 'Failed to delete ad slot' }, { status: 500 })
    }
}
