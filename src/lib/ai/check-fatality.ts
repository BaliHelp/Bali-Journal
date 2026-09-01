import { db } from '@/lib/db'
import { analyzeLegalRisk, repairCriticalRisk } from '@/lib/ai/legal-risk'
import { checkPublishRequirements } from '@/lib/legal/publish-lock'

export interface CheckFatalityResult {
  before: { riskLevel: string; riskScore: number }
  after: { riskLevel: string; riskScore: number }
  attempts: number
  resolved: boolean
  wasRewritten: boolean
  published: boolean
  missingRequirements: string[]
}

/**
 * "Check Fatality" - the shared logic behind the Articles panel's manual
 * popup action AND the auto-publish-high-risk cron job. Re-analyzes an
 * article's current legal risk; if CRITICAL, runs the repair loop (up to 3
 * attempts). Always stamps legalReviewedBy/legalReviewedAt on completion -
 * running this check IS the human-in-the-loop legal review
 * checkPublishRequirements() requires for HIGH-risk articles. If every
 * other publish requirement is already met (image, evidence, content
 * length), auto-publishes right after - this is what lets a HIGH-risk
 * article go live without a separate manual Publish click, whether this
 * ran because an admin clicked "Check & Perbaiki Risiko" or because the
 * cron job picked it up automatically.
 */
export async function checkFatality(articleId: string, reviewerName: string): Promise<CheckFatalityResult | null> {
  const article = await db.article.findUnique({ where: { id: articleId } })
  if (!article) return null

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
      initialAnalysis,
      article.category
    )
    finalTitle = repair.title
    finalExcerpt = repair.excerpt
    finalContent = repair.content
    finalAnalysis = repair.riskAnalysis
    attempts = repair.attempts
    resolved = repair.resolved
  }

  await db.article.update({
    where: { id: articleId },
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

  let published = false
  const publishCheck = await checkPublishRequirements(articleId)
  if (article.status !== 'PUBLISHED' && publishCheck.canPublish) {
    await db.article.update({
      where: { id: articleId },
      data: { status: 'PUBLISHED', publishedAt: new Date() },
    })
    published = true
  }

  return {
    before,
    after: { riskLevel: finalAnalysis.riskLevel, riskScore: finalAnalysis.riskScore },
    attempts,
    resolved,
    wasRewritten: initialAnalysis.riskLevel === 'CRITICAL',
    published,
    missingRequirements: published ? [] : publishCheck.missingRequirements,
  }
}
