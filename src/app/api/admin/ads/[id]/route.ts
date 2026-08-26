import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth/session'

interface Params {
    params: Promise<{ id: string }>
}

async function requireEditor() {
    const session = await getSession()
    return session && (session.role === 'ADMIN' || session.role === 'EDITOR') ? session : null
}

/** Toggle isActive or edit dates/link - creative/media swap goes through POST /api/admin/ads (create a new one) to keep this simple. */
export async function PATCH(req: NextRequest, { params }: Params) {
    if (!(await requireEditor())) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const { id } = await params
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
