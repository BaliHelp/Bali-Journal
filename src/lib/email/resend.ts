import { Resend } from 'resend'

// Powers the Admin Dashboard Email panel (replies to Contact Form
// submissions). No Gmail/SMTP credentials involved anywhere in this path -
// Resend sends independently via its own API key against a domain verified
// directly with Resend (balijournal.com, confirmed verified 2026-09-02).

let client: Resend | null = null
function getClient(): Resend {
    if (!client) {
        const apiKey = process.env.RESEND_API_KEY
        if (!apiKey) throw new Error('RESEND_API_KEY is not set')
        client = new Resend(apiKey)
    }
    return client
}

export interface SendReplyInput {
    to: string
    subject: string
    /** Plain text - wrapped in a minimal HTML template below. */
    message: string
    /** The original message being replied to, quoted for context. */
    originalMessage?: string
    originalSubject?: string
}

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
}

export async function sendContactReply({ to, subject, message, originalMessage, originalSubject }: SendReplyInput): Promise<void> {
    const fromName = process.env.RESEND_FROM_NAME || 'Bali Journal'
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'contact@balijournal.com'

    const bodyHtml = escapeHtml(message).replace(/\n/g, '<br />')
    const quotedHtml = originalMessage
        ? `<blockquote style="margin:24px 0 0;padding-left:12px;border-left:3px solid #ddd;color:#666;font-size:14px;">
             <p style="margin:0 0 4px;font-weight:600;">Pesan asli${originalSubject ? ` - "${escapeHtml(originalSubject)}"` : ''}:</p>
             <p style="margin:0;white-space:pre-wrap;">${escapeHtml(originalMessage).replace(/\n/g, '<br />')}</p>
           </blockquote>`
        : ''

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#111;">
        <p style="white-space:pre-wrap;">${bodyHtml}</p>
        ${quotedHtml}
        <hr style="margin:24px 0;border:none;border-top:1px solid #eee;" />
        <p style="font-size:12px;color:#999;">Dikirim oleh tim Bali Journal.</p>
      </div>
    `.trim()

    const result = await getClient().emails.send({
        from: `${fromName} <${fromEmail}>`,
        to,
        subject,
        html,
        text: message,
    })

    if (result.error) {
        throw new Error(`Resend send failed: ${result.error.message}`)
    }
}
