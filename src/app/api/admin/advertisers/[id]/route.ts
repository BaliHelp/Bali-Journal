import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth/session'

async function requireAdmin() {
    const session = await getSession()
    return session && session.role === 'ADMIN' ? session : null
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    if (!(await requireAdmin())) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const { id } = await params
        const body = await req.json()

        if (body.status !== 'APPROVED' && body.status !== 'REJECTED') {
            return NextResponse.json({ error: 'status must be APPROVED or REJECTED' }, { status: 400 })
        }

        const advertiser = await db.advertiser.update({
            where: { id },
            data: {
                status: body.status,
                rejectionReason: body.status === 'REJECTED' ? (body.rejectionReason || 'Tidak memenuhi syarat') : null,
            },
        })

        return NextResponse.json({ advertiser })
    } catch (error) {
        console.error('Update advertiser error:', error)
        return NextResponse.json({ error: 'Failed to update advertiser' }, { status: 500 })
    }
}
