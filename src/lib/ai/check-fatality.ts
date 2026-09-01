import { db } from '@/lib/db'
import { analyzeLegalRisk, repairCriticalRisk } from '@/lib/ai/legal-risk'
import { checkPublishRequirements } from '@/lib/legal/publish-lock'
import { scheduleDelayedCall } from '@/lib/qstash'

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
 * popup action AND the one-time delayed auto-recheck (see
 * src/app/api/articles/[id]/auto-check-fatality). Re-analyzes an article's
 * current legal risk; if CRITICAL, runs the repair loop (up to 3 attempts).
 * Always stamps legalReviewedBy/legalReviewedAt on completion - running
 * this check IS the human-in-the-loop legal review
 * checkPublishRequirements() requires for HIGH-risk articles. If every
 * other publish requirement is already met (image, evidence, content
 * length), auto-publishes right after.
 *
 * If the result lands on HIGH and still can't publish (missing evidence,
 * etc.), this schedules exactly ONE delayed re-check for THIS article via
 * QStash (10 minutes later) - not a recurring scan of every article, just
 * one more attempt at this specific one, giving a human a window to add
 * what's missing first. `isAutoRecheck` prevents that delayed call from
 * scheduling yet another one after itself.
 */
export async function checkFatality(
  articleId: string,
  reviewerName: string,
  options?: { isAutoRecheck?: boolean }
): Promise<CheckFatalityResult | null> {
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

  if (!published && finalAnalysis.riskLevel === 'HIGH' && !options?.isAutoRecheck) {
    try {
      await scheduleDelayedCall(`/api/articles/${articleId}/auto-check-fatality`, 10 * 60)
    } catch (error) {
      // Never let a scheduling failure break the check itself - the admin
      // still sees the up-to-date risk score/status either way, they'd
      // just need to click "Check & Perbaiki Risiko" again manually.
      console.error(`Failed to schedule delayed re-check for article ${articleId}:`, error)
    }
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
