import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth/session'

/** Lists everything currently in Trash (status: TRASHED), most recently deleted first. */
export async function GET() {
    const session = await getSession()
    if (!session || (session.role !== 'ADMIN' && session.role !== 'EDITOR')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const articles = await db.article.findMany({
        where: { status: 'TRASHED' },
        orderBy: { deletedAt: 'desc' },
        include: {
            author: { select: { id: true, name: true, email: true } },
        },
    })

    return NextResponse.json({ articles })
}
