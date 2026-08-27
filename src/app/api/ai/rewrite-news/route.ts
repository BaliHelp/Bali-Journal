import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { rewriteExternalNewsToArticle } from '@/lib/ai/rewrite-external-news'

export async function POST(req: NextRequest) {
    try {
        const session = await getSession()
        if (!session || (session.role !== 'ADMIN' && session.role !== 'EDITOR')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { url, autoPublish } = await req.json()

        if (!url) {
            return NextResponse.json({ error: 'URL is required' }, { status: 400 })
        }

        const { article } = await rewriteExternalNewsToArticle({
            url,
            status: autoPublish ? 'PUBLISHED' : 'DRAFT',
        })

        return NextResponse.json({ success: true, article })
    } catch (error: any) {
        console.error('Rewrite Error:', error)
        return NextResponse.json({ error: error.message }, { status: error.status || 500 })
    }
}
