import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth/session'

async function requireAdmin() {
    const session = await getSession()
    return session && session.role === 'ADMIN' ? session : null
}

export async function GET(req: NextRequest) {
    if (!(await requireAdmin())) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const status = req.nextUrl.searchParams.get('status')

    const advertisers = await db.advertiser.findMany({
        where: status ? { status: status as 'PENDING' | 'APPROVED' | 'REJECTED' } : undefined,
        include: { user: { select: { email: true, name: true } } },
        orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ advertisers })
}
