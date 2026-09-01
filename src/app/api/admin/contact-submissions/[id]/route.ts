import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth/session'

/** Mark a submission READ/ARCHIVED without sending a reply (e.g. spam, or already handled outside the panel). */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await getSession()
    if (!session || (session.role !== 'ADMIN' && session.role !== 'EDITOR')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const { status } = await request.json()
    if (!['UNREAD', 'READ', 'ARCHIVED'].includes(status)) {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    const submission = await db.contactSubmission.update({ where: { id }, data: { status } })
    return NextResponse.json({ submission })
}
