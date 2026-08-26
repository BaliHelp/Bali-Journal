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

        if (body.status !== 'PAID' && body.status !== 'REJECTED') {
            return NextResponse.json({ error: 'status must be PAID or REJECTED' }, { status: 400 })
        }

        const invoice = await db.invoice.findUnique({ where: { id } })
        if (!invoice) {
            return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
        }

        const updated = await db.$transaction(async (tx) => {
            const invoice = await tx.invoice.update({
                where: { id },
                data:
                    body.status === 'PAID'
                        ? { status: 'PAID', paidAt: new Date(), rejectionReason: null }
                        : { status: 'REJECTED', rejectionReason: body.rejectionReason || 'Bukti transfer tidak valid' },
            })

            if (body.status === 'PAID') {
                await tx.ad.update({ where: { id: invoice.adId }, data: { isActive: true } })
            }

            return invoice
        })

        return NextResponse.json({ invoice: updated })
    } catch (error) {
        console.error('Update invoice error:', error)
        return NextResponse.json({ error: 'Failed to update invoice' }, { status: 500 })
    }
}
