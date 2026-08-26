import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth/session'

async function requireAdmin() {
    const session = await getSession()
    return session && session.role === 'ADMIN' ? session : null
}

export async function GET() {
    try {
        if (!(await requireAdmin())) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Fetch configs, sorted by time
        const schedules = await db.scheduleConfig.findMany({
            orderBy: { time: 'asc' }
        })
        return NextResponse.json({ success: true, schedules })
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch schedule' }, { status: 500 })
    }
}

export async function POST(req: Request) {
    try {
        if (!(await requireAdmin())) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await req.json()
        const { time, label, slots, isActive } = body

        const schedule = await db.scheduleConfig.create({
            data: { time, label, slots, isActive }
        })

        return NextResponse.json({ success: true, schedule })
    } catch (error) {
        return NextResponse.json({ error: 'Failed to create schedule' }, { status: 500 })
    }
}

export async function PUT(req: Request) {
    try {
        if (!(await requireAdmin())) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await req.json()
        const { id, time, label, slots, isActive } = body

        const schedule = await db.scheduleConfig.update({
            where: { id },
            data: { time, label, slots, isActive }
        })

        return NextResponse.json({ success: true, schedule })
    } catch (error) {
        return NextResponse.json({ error: 'Failed to update schedule' }, { status: 500 })
    }
}

export async function DELETE(req: Request) {
    try {
        if (!(await requireAdmin())) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { searchParams } = new URL(req.url)
        const id = searchParams.get('id')

        if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

        await db.scheduleConfig.delete({ where: { id } })
        return NextResponse.json({ success: true })
    } catch (error) {
        return NextResponse.json({ error: 'Failed to delete schedule' }, { status: 500 })
    }
}
