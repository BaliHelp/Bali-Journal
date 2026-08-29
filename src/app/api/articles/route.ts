import { NextRequest, NextResponse } from 'next/server'

import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { articleSchema } from '@/lib/validators'
import { analyzeLegalRisk } from '@/lib/ai/legal-risk'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const category = searchParams.get('category')

    const articles = await db.article.findMany({
      where: {
        ...(status && { status: status as any }),
        ...(category && { category: category as any }),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        author: { select: { id: true, name: true, email: true } },
        evidences: true,
      },
    })

    return NextResponse.json({ articles })
  } catch (error) {
    console.error('Get articles error:', error)
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat mengambil artikel' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getSession()

    if (!user || (user.role !== 'ADMIN' && user.role !== 'EDITOR')) {
      return NextResponse.json(
        { error: 'Anda tidak memiliki akses' },
        { status: 403 }
      )
    }

    const body = await request.json()

    // Validate input
    const result = articleSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0].message },
        { status: 400 }
      )
    }

    const { title, excerpt, content, category, featuredImageUrl, featuredImageAlt, imageSource, slug: slugOverride } = result.data

    // Use the admin's slug if they set one, otherwise derive it from the title.
    const baseSlug = (slugOverride || title)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 100)

    const existingSlug = await db.article.findFirst({
      where: { slug: { startsWith: baseSlug } },
    })

    const slug = existingSlug ? `${baseSlug}-${Date.now()}` : baseSlug

    // Analyze legal risk
    const riskAnalysis = await analyzeLegalRisk(content, title)

    // Create article
    const article = await db.article.create({
      data: {
        title,
        slug,
        excerpt,
        content,
        category: category as any,
        featuredImageUrl,
        featuredImageAlt,
        imageSource,
        riskLevel: riskAnalysis.riskLevel,
        riskScore: riskAnalysis.riskScore,
        containsAccusation: riskAnalysis.containsAccusation,
        legalReviewRequired: riskAnalysis.requiresLegalReview,
        status: body.status || 'DRAFT',
        authorId: user.id,
      },
    })

    return NextResponse.json({ article, riskAnalysis })
  } catch (error) {
    console.error('Create article error:', error)
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat membuat artikel' },
      { status: 500 }
    )
  }
}
