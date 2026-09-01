import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth/session'
import { analyzeLegalRisk, repairCriticalRisk } from '@/lib/ai/legal-risk'

interface Params {
  params: Promise<{ id: string }>
}

/**
 * "Check Fatality" - admin-triggered legal-risk check + repair for a single
 * article from the Articles panel, without needing to open the full edit
 * dialog. Re-analyzes current content; if CRITICAL, runs the same repair
 * loop the automated pipelines use (up to 3 attempts). Always stamps
 * legalReviewedBy/legalReviewedAt on completion - triggering this action IS
 * the human-in-the-loop legal review checkPublishRequirements() requires
 * for HIGH-risk articles, and until now nothing in the codebase ever set
 * those two fields, so every HIGH-risk article was permanently stuck
 * behind an unsatisfiable publish requirement.
 */
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const session = await getSession()
    if (!session || (session.role !== 'ADMIN' && session.role !== 'EDITOR')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const article = await db.article.findUnique({ where: { id } })
    if (!article) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 })
    }

    const before = { riskLevel: article.riskLevel, riskScore: article.riskScore }
    const initialAnalysis = await analyzeLegalRisk(article.content, article.title)

    let finalTitle = article.title
    let finalExcerpt = article.excerpt
    let finalContent = article.content
    let finalAnalysis = initialAnalysis
    let attempts = 0
    let resolved = true

    if (initialAnalysis.riskLevel === 'CRITICAL') {
      const repair = await repairCriticalRisk(
        { title: article.title, excerpt: article.excerpt, content: article.content },
        initialAnalysis
      )
      finalTitle = repair.title
      finalExcerpt = repair.excerpt
      finalContent = repair.content
      finalAnalysis = repair.riskAnalysis
      attempts = repair.attempts
      resolved = repair.resolved
    }

    const reviewerName = session.name || session.email

    const updated = await db.article.update({
      where: { id },
      data: {
        title: finalTitle,
        excerpt: finalExcerpt,
        content: finalContent,
        riskLevel: finalAnalysis.riskLevel,
        riskScore: finalAnalysis.riskScore,
        containsAccusation: finalAnalysis.containsAccusation,
        legalReviewRequired: finalAnalysis.requiresLegalReview,
        legalReviewedBy: reviewerName,
        legalReviewedAt: new Date(),
      },
    })

    return NextResponse.json({
      article: updated,
      before,
      after: { riskLevel: finalAnalysis.riskLevel, riskScore: finalAnalysis.riskScore },
      attempts,
      resolved,
      wasRewritten: initialAnalysis.riskLevel === 'CRITICAL',
    })
  } catch (error) {
    console.error('Repair risk error:', error)
    return NextResponse.json({ error: 'Failed to check/repair legal risk' }, { status: 500 })
  }
}
