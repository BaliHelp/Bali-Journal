import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth/session'

/** Lists Contact Form submissions for the Admin Dashboard Email panel, most recent first. */
export async function GET() {
    const session = await getSession()
    if (!session || (session.role !== 'ADMIN' && session.role !== 'EDITOR')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const submissions = await db.contactSubmission.findMany({
        orderBy: { createdAt: 'desc' },
        take: 200,
    })

    return NextResponse.json({ submissions })
}
