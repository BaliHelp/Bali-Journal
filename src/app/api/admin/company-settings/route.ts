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

    const settings = await db.companySettings.findFirst()
    return NextResponse.json({ settings })
}

export async function PUT(req: NextRequest) {
    if (!(await requireAdmin())) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const body = await req.json()
        const data = {
            companyName: body.companyName ?? null,
            address: body.address ?? null,
            npwp: body.npwp ?? null,
            phone: body.phone ?? null,
            bankName: body.bankName ?? null,
            bankAccountNo: body.bankAccountNo ?? null,
            bankAccountName: body.bankAccountName ?? null,
        }

        const existing = await db.companySettings.findFirst()
        const settings = existing
            ? await db.companySettings.update({ where: { id: existing.id }, data })
            : await db.companySettings.create({ data })

        return NextResponse.json({ settings })
    } catch (error) {
        console.error('Update company settings error:', error)
        return NextResponse.json({ error: 'Failed to update company settings' }, { status: 500 })
    }
}
