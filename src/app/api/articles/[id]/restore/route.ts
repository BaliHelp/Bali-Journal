import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth/session'

/** Restores an article out of Trash back to whatever status it had before being trashed. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session || (session.role !== 'ADMIN' && session.role !== 'EDITOR')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const article = await db.article.findUnique({ where: { id }, select: { status: true, previousStatus: true } })
    if (!article) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 })
    }
    if (article.status !== 'TRASHED') {
      return NextResponse.json({ error: 'Article is not in trash' }, { status: 400 })
    }

    const updated = await db.article.update({
      where: { id },
      data: {
        status: article.previousStatus || 'DRAFT',
        previousStatus: null,
        deletedAt: null,
      },
    })

    return NextResponse.json({ success: true, article: updated })
  } catch (error) {
    console.error('Restore article error:', error)
    return NextResponse.json({ error: 'Failed to restore article' }, { status: 500 })
  }
}
