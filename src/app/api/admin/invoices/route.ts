import { NextResponse } from 'next/server'
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

    const invoices = await db.invoice.findMany({
        include: {
            advertiser: { select: { companyName: true, user: { select: { email: true } } } },
            ad: { include: { slot: true } },
        },
        orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ invoices })
}
