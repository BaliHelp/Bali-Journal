import { NextRequest } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { rewriteExternalNewsToArticle } from '@/lib/ai/rewrite-external-news'

function sseEvent(event: string, data: unknown): string {
    return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
}

/**
 * Streams live progress (Server-Sent Events) while rewriting one external
 * article instead of one silent request that only resolves at the very end -
 * the admin sees each real pipeline checkpoint (fetch, AI rewrite, image
 * generation, save) as it happens, not just a spinner for 15-30+ seconds.
 */
export async function POST(req: NextRequest) {
    const session = await getSession()
    if (!session || (session.role !== 'ADMIN' && session.role !== 'EDITOR')) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    }

    const { url, autoPublish } = await req.json()
    if (!url) {
        return new Response(JSON.stringify({ error: 'URL is required' }), { status: 400 })
    }

    const stream = new ReadableStream({
        async start(controller) {
            const encoder = new TextEncoder()
            const send = (event: string, data: unknown) => controller.enqueue(encoder.encode(sseEvent(event, data)))

            try {
                const { article } = await rewriteExternalNewsToArticle({
                    url,
                    status: autoPublish ? 'PUBLISHED' : 'DRAFT',
                    onProgress: (stage) => send('progress', { stage }),
                })
                send('done', { success: true, article })
            } catch (error) {
                console.error('Rewrite Error:', error)
                const message = error instanceof Error ? error.message : 'Failed to rewrite article'
                send('error', { error: message })
            } finally {
                controller.close()
            }
        },
    })

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            Connection: 'keep-alive',
        },
    })
}
