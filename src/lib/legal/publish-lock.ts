import { db } from '@/lib/db'

export interface PublishCheckResult {
  canPublish: boolean
  missingRequirements: string[]
  warnings: string[]
}

export async function checkPublishRequirements(articleId: string): Promise<PublishCheckResult> {
  const article = await db.article.findUnique({
    where: { id: articleId },
    include: {
      evidences: true,
    },
  })

  if (!article) {
    return {
      canPublish: false,
      missingRequirements: ['Artikel tidak ditemukan'],
      warnings: [],
    }
  }

  const missingRequirements: string[] = []
  const warnings: string[] = []

  // Check featured image requirements
  if (!article.featuredImageUrl) {
    missingRequirements.push('Gambar utama wajib diunggah')
  }
  if (!article.featuredImageAlt) {
    missingRequirements.push('Alt text gambar utama wajib diisi')
  }
  if (!article.imageSource) {
    missingRequirements.push('Sumber gambar wajib diisi')
  }

  // Check evidence requirements
  if (article.evidences.length < 1) {
    missingRequirements.push('Minimal 1 bukti pendukung wajib diunggah')
  }

  // CRITICAL is a hard block regardless of legal review sign-off - matches
  // what the site's own Transparency page states ("Critical risk, cannot
  // be published"). Bring it down via the Articles panel's "Check Fatality"
  // action first.
  if (article.riskLevel === 'CRITICAL') {
    missingRequirements.push('Artikel berisiko CRITICAL tidak dapat dipublikasikan sampai risikonya diturunkan')
  } else if (article.riskLevel === 'HIGH') {
    // Legal review sign-off is set by the "Check Fatality" action in the
    // admin Articles panel (src/app/api/articles/[id]/repair-risk) - before
    // that existed, nothing in the codebase ever set these two fields, so
    // every HIGH-risk article was permanently stuck here.
    if (!article.legalReviewedBy || !article.legalReviewedAt) {
      missingRequirements.push('Artikel berisiko tinggi memerlukan tinjauan hukum sebelum dipublikasikan')
    }
  }

  // Check content requirements
  if (article.content.length < 200) {
    missingRequirements.push('Konten artikel minimal 200 karakter')
  }
  if (article.excerpt.length < 50) {
    missingRequirements.push('Ringkasan artikel minimal 50 karakter')
  }

  // Add warnings for medium risk
  if (article.riskLevel === 'MEDIUM') {
    warnings.push('Artikel memiliki risiko menengah - pertimbangkan tinjauan hukum')
  }

  // Add warning for accusations
  if (article.containsAccusation) {
    warnings.push('Artikel mengandung tuduhan - pastikan semua klaim didukung bukti')
  }

  return {
    canPublish: missingRequirements.length === 0,
    missingRequirements,
    warnings,
  }
}

export async function enforcePublishLock(articleId: string): Promise<boolean> {
  const check = await checkPublishRequirements(articleId)
  return check.canPublish
}

export async function canUserPublish(userId: string, articleId: string): Promise<PublishCheckResult & { hasPermission: boolean }> {
  const article = await db.article.findUnique({
    where: { id: articleId },
    select: { authorId: true },
  })

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { role: true },
  })

  const hasPermission = 
    user?.role === 'ADMIN' || 
    user?.role === 'EDITOR' || 
    article?.authorId === userId

  const check = await checkPublishRequirements(articleId)

  return {
    ...check,
    hasPermission,
  }
}
