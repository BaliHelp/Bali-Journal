import { NextRequest, NextResponse } from 'next/server'

import { db } from '@/lib/db'
import { getSession } from '@/lib/auth/session'

interface Params {
  params: Promise<{ id: string }>
}

async function requireEditor() {
  const session = await getSession()
  return session && (session.role === 'ADMIN' || session.role === 'EDITOR') ? session : null
}

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const article = await db.article.findUnique({
      where: { id },
      include: {
        author: { select: { id: true, name: true, email: true } },
        evidences: true,
      },
    })

    if (!article) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 })
    }

    // Published content is already public via the slug route - no session
    // needed. Anything else (DRAFT/REVIEW/REJECTED) is unpublished, so only
    // editorial staff should be able to read it by ID.
    if (article.status !== 'PUBLISHED' && !(await requireEditor())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    return NextResponse.json({ article })
  } catch (error) {
    console.error('Get article error:', error)
    return NextResponse.json({ error: 'Failed to fetch article' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: Params) {
  try {
    if (!(await requireEditor())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()

    // publishedAt: only touched on an actual status transition, never
    // stomped on every save. Missing entirely here used to mean an article
    // edited from DRAFT to PUBLISHED (or created PUBLISHED via POST, see
    // that route's own matching fix) got stuck with publishedAt: null
    // forever - no date anywhere it's shown (Breaking News sidebar,
    // article byline).
    let publishedAt: Date | null | undefined = undefined
    if (body.status) {
      const existing = await db.article.findUnique({ where: { id }, select: { publishedAt: true } })
      publishedAt = body.status === 'PUBLISHED' ? (existing?.publishedAt ?? new Date()) : null
    }

    // Slug is optional and admin-editable here - sanitized the same way as
    // on create, but NOT auto-generated from the title (an edit shouldn't
    // silently change a published article's URL unless the admin explicitly
    // typed a new slug). A collision with another article's slug surfaces
    // as the unique-constraint error below rather than being auto-resolved.
    const slug = body.slug
      ? body.slug.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 150)
      : undefined

    // riskAnalysis is optional and only present when the admin clicked
    // "Analyze Legal Risk" again after editing - re-running the analysis
    // client-side but never persisting the result was the actual gap: the
    // stored riskLevel/riskScore used to stay frozen at whatever they were
    // at creation, even after the risky content was edited out.
    const riskAnalysis = body.riskAnalysis as
      | { riskScore: number; riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'; containsAccusation: boolean; requiresLegalReview: boolean }
      | undefined

    const article = await db.article.update({
      where: { id },
      data: {
        title: body.title,
        excerpt: body.excerpt,
        content: body.content,
        category: body.category,
        featuredImageUrl: body.featuredImageUrl,
        featuredImageAlt: body.featuredImageAlt,
        imageSource: body.imageSource,
        status: body.status,
        ...(publishedAt !== undefined ? { publishedAt } : {}),
        ...(slug ? { slug } : {}),
        ...(riskAnalysis
          ? {
              riskScore: riskAnalysis.riskScore,
              riskLevel: riskAnalysis.riskLevel,
              containsAccusation: riskAnalysis.containsAccusation,
              legalReviewRequired: riskAnalysis.requiresLegalReview,
            }
          : {}),
      },
    })

    return NextResponse.json({ article })
  } catch (error) {
    console.error('Update article error:', error)
    return NextResponse.json({ error: 'Failed to update article' }, { status: 500 })
  }
}

// Soft-delete: moves the article to Trash (status: TRASHED) instead of
// deleting it immediately, per explicit request ("semua News yang di hapus
// akan di tampung disitu sebelum benar-benar di hapus"). The old hard-delete
// behavior now lives at DELETE /api/articles/[id]/permanent, only reachable
// from within the Trash panel itself.
export async function DELETE(request: NextRequest, { params }: Params) {
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
    if (article.status === 'TRASHED') {
      return NextResponse.json({ error: 'Article is already in trash' }, { status: 400 })
    }

    const updated = await db.article.update({
      where: { id },
      data: {
        status: 'TRASHED',
        previousStatus: article.status,
        deletedAt: new Date(),
      },
    })

    return NextResponse.json({ success: true, article: updated })
  } catch (error) {
    console.error('Delete article error:', error)
    return NextResponse.json({ error: 'Failed to delete article' }, { status: 500 })
  }
}
