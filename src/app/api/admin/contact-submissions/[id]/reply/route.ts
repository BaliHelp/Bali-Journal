import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth/session'
import { sendContactReply } from '@/lib/email/resend'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await getSession()
    if (!session || (session.role !== 'ADMIN' && session.role !== 'EDITOR')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const { message } = await request.json()
    if (!message || typeof message !== 'string' || message.trim().length < 1) {
        return NextResponse.json({ error: 'Reply message is required' }, { status: 400 })
    }

    const submission = await db.contactSubmission.findUnique({ where: { id } })
    if (!submission) {
        return NextResponse.json({ error: 'Submission not found' }, { status: 404 })
    }

    try {
        await sendContactReply({
            to: submission.email,
            subject: `Re: ${submission.subject}`,
            message,
            originalMessage: submission.message,
            originalSubject: submission.subject,
        })
    } catch (error) {
        console.error('Failed to send contact reply:', error)
        return NextResponse.json(
            { error: 'Failed to send email', details: error instanceof Error ? error.message : 'Unknown' },
            { status: 500 }
        )
    }

    const updated = await db.contactSubmission.update({
        where: { id },
        data: {
            status: 'REPLIED',
            replyMessage: message,
            repliedBy: session.name || session.email,
            repliedAt: new Date(),
        },
    })

    return NextResponse.json({ success: true, submission: updated })
}
