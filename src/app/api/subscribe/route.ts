import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { subscriberSchema } from '@/lib/validators'
import { sendWelcomeEmail } from '@/lib/email/newsletter'

/** Powers the Footer newsletter form - the only place this schema/table was ever wired up until now. */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const parsed = subscriberSchema.safeParse(body)
        if (!parsed.success) {
            return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid input' }, { status: 400 })
        }
        const { email, name } = parsed.data

        const existing = await db.subscriber.findUnique({ where: { email } })

        if (existing?.active) {
            return NextResponse.json({ success: true, alreadySubscribed: true })
        }

        const subscriber = existing
            ? await db.subscriber.update({ where: { id: existing.id }, data: { active: true, name: name ?? existing.name } })
            : await db.subscriber.create({ data: { email, name } })

        // Best-effort - a failed welcome email shouldn't fail the subscription itself.
        await sendWelcomeEmail(email, subscriber.id).catch((err) => {
            console.error('Failed to send welcome email:', err)
        })

        return NextResponse.json({ success: true, alreadySubscribed: false })
    } catch (error) {
        console.error('Subscribe error:', error)
        return NextResponse.json({ error: 'Failed to subscribe' }, { status: 500 })
    }
}
