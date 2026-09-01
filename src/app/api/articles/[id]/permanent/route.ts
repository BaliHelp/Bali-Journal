import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth/session'

/**
 * Real, irreversible delete - only callable on an article already in Trash
 * (status: TRASHED), so nothing can be permanently destroyed without first
 * passing through the Trash review step (DELETE /api/articles/[id]).
 */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const article = await db.article.findUnique({ where: { id }, select: { status: true } })
    if (!article) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 })
    }
    if (article.status !== 'TRASHED') {
      return NextResponse.json({ error: 'Only trashed articles can be permanently deleted' }, { status: 400 })
    }

    await db.evidence.deleteMany({ where: { articleId: id } })
    await db.comment.deleteMany({ where: { articleId: id } })
    await db.article.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Permanent delete error:', error)
    return NextResponse.json({ error: 'Failed to permanently delete article' }, { status: 500 })
  }
}
