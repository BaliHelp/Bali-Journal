import { db } from '@/lib/db'
import { notFound } from 'next/navigation'

import Image from 'next/image'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  User,
  Clock,
  Eye,
  FileText,
  Shield,
  AlertTriangle,
  CheckCircle,
  MessageCircle
} from 'lucide-react'
import Link from 'next/link'
import { ArticleJsonLd } from '@/components/seo/article-json-ld'
import { CommentSection } from '@/components/article/comment-section'
import { EvidenceList } from '@/components/article/evidence-list'
import { ArticleCard } from '@/components/article/article-card'
import { ArticleActions } from '@/components/article/article-actions'
import { AdSlot } from '@/components/ads/ad-slot'
import type { Category } from '@prisma/client'

interface ArticlePageProps {
  params: Promise<{ slug: string }>
}

async function getArticle(slug: string) {
  return db.article.findUnique({
    where: { slug, status: 'PUBLISHED' },
    include: {
      author: { select: { id: true, name: true, email: true } },
      evidences: true,
      comments: {
        where: { status: 'APPROVED' },
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: {
          user: { select: { name: true, avatar: true } },
        },
      },
    },
  })
}

async function incrementViewCount(articleId: string) {
  await db.article.update({
    where: { id: articleId },
    data: { viewCount: { increment: 1 } },
  })
}

const ALL_CATEGORIES: Category[] = ['TOURISM', 'GOVERNMENT', 'INVESTMENT', 'INCIDENTS', 'LOCAL', 'JOBS', 'OPINION']

/**
 * Like real newsrooms do: below the article, one backlink per OTHER
 * category (not just "more like this") so readers cross-navigate the whole
 * site instead of getting stuck in one topic. Skips a category entirely if
 * it has no published article yet, rather than showing a broken/empty card.
 */
async function getOtherCategoryArticles(excludeId: string, excludeCategory: Category) {
  const otherCategories = ALL_CATEGORIES.filter((c) => c !== excludeCategory)

  const results = await Promise.all(
    otherCategories.map((category) =>
      db.article.findFirst({
        where: { status: 'PUBLISHED', category, id: { not: excludeId } },
        orderBy: { publishedAt: 'desc' },
        select: {
          id: true, title: true, slug: true, excerpt: true, category: true,
          featuredImageUrl: true, featuredImageAlt: true, publishedAt: true,
          viewCount: true, aiAssisted: true, author: { select: { name: true } },
        },
      })
    )
  )

  return results.filter((a): a is NonNullable<typeof a> => a !== null)
}

const categoryLabels: Record<string, string> = {
  TOURISM: 'Pariwisata',
  GOVERNMENT: 'Pemerintahan',
  INVESTMENT: 'Investasi',
  INCIDENTS: 'Insiden',
  LOCAL: 'Lokal',
  JOBS: 'Pekerjaan',
  OPINION: 'Opini',
}

const riskLevelLabels: Record<string, { label: string; color: string }> = {
  LOW: { label: 'Rendah', color: 'bg-green-500' },
  MEDIUM: { label: 'Sedang', color: 'bg-yellow-500' },
  HIGH: { label: 'Tinggi', color: 'bg-orange-500' },
  CRITICAL: { label: 'Kritis', color: 'bg-red-500' },
}

export async function generateMetadata({ params }: ArticlePageProps) {
  const { slug } = await params
  const article = await getArticle(slug)

  if (!article) {
    return { title: 'Artikel tidak ditemukan' }
  }

  return {
    title: article.title,
    description: article.excerpt,
    openGraph: {
      title: article.title,
      description: article.excerpt,
      type: 'article',
      publishedTime: article.publishedAt?.toISOString(),
      authors: [article.author?.name || 'Tim NewsBali'],
      images: article.featuredImageUrl ? [{ url: article.featuredImageUrl }] : [],
    },
    twitter: {
      card: 'summary_large_image',
      title: article.title,
      description: article.excerpt,
      images: article.featuredImageUrl ? [article.featuredImageUrl] : [],
    },
  }
}

export default async function ArticlePage({ params }: ArticlePageProps) {
  const { slug } = await params
  const article = await getArticle(slug)

  if (!article) {
    notFound()
  }

  // Increment view count
  await incrementViewCount(article.id)

  const otherCategoryArticles = await getOtherCategoryArticles(article.id, article.category)

  return (
    <>
      <ArticleJsonLd article={article} />

      <article className="py-8">
        <div className="container mx-auto max-w-4xl px-4">
          {/* Breadcrumb */}
          <nav className="mb-6 text-sm text-muted-foreground">
            <Link href="/" className="hover:text-foreground">Beranda</Link>
            <span className="mx-2">/</span>
            <Link
              href={`/category/${article.category.toLowerCase()}`}
              className="hover:text-foreground"
            >
              {categoryLabels[article.category]}
            </Link>
            <span className="mx-2">/</span>
            <span className="text-foreground">{article.title.slice(0, 50)}...</span>
          </nav>

          {/* Header */}
          <header className="mb-8">
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <Badge variant="secondary">
                {categoryLabels[article.category]}
              </Badge>
              <Badge
                variant="outline"
                className="flex items-center gap-1"
              >
                <Shield className="h-3 w-3" />
                Terverifikasi
              </Badge>
            </div>

            <h1 className="text-3xl md:text-4xl font-bold mb-4 leading-tight">
              {article.title}
            </h1>

            <p className="text-lg text-muted-foreground mb-6">
              {article.excerpt}
            </p>

            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4" />
                <span>{article.author?.name || 'Tim NewsBali'}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <span>
                  {article.publishedAt?.toLocaleDateString('id-ID', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4" />
                <span>{article.viewCount} views</span>
              </div>
            </div>
          </header>

          {/* Featured Image */}
          {article.featuredImageUrl && (
            <figure className="mb-8">
              <div className="relative aspect-[16/9] overflow-hidden rounded-lg bg-muted">
                <Image
                  src={article.featuredImageUrl}
                  alt={article.featuredImageAlt || article.title}
                  fill
                  className="object-cover"
                  priority
                />
              </div>
              {article.imageSource && (
                <figcaption className="mt-2 text-sm text-muted-foreground text-center">
                  Sumber: {article.imageSource}
                </figcaption>
              )}
            </figure>
          )}

          {/* Article Content */}
          <div
            className="prose prose-neutral dark:prose-invert max-w-none mb-8"
            dangerouslySetInnerHTML={{ __html: article.content }}
          />

          <AdSlot position="IN_ARTICLE" className="my-8" />

          <Separator className="my-8" />

          {/* Evidence Section */}
          {article.evidences.length > 0 && (
            <>
              <EvidenceList evidences={article.evidences} />
              <Separator className="my-8" />
            </>
          )}

          {/* Article Metadata */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="p-4 rounded-lg border bg-muted/30">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Tingkat Risiko</span>
              </div>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${riskLevelLabels[article.riskLevel]?.color}`} />
                <span className="font-semibold">
                  {riskLevelLabels[article.riskLevel]?.label || article.riskLevel}
                </span>
              </div>
            </div>
            <div className="p-4 rounded-lg border bg-muted/30">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Verifikasi</span>
              </div>
              <span className="font-semibold">
                {article.evidences.filter(e => e.verified).length} dari {article.evidences.length} bukti terverifikasi
              </span>
            </div>
            <div className="p-4 rounded-lg border bg-muted/30">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Bukti Pendukung</span>
              </div>
              <span className="font-semibold">{article.evidences.length} dokumen</span>
            </div>
          </div>

          {/* Share Actions */}
          <ArticleActions slug={article.slug} title={article.title} excerpt={article.excerpt} />

          <Separator className="my-8" />

          {/* Baca Juga - one backlink per other category, so readers cross-navigate the site */}
          {otherCategoryArticles.length > 0 && (
            <>
              <div className="mb-8">
                <h2 className="text-xl font-semibold mb-6">Baca Juga dari Kategori Lain</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {otherCategoryArticles.map((related) => (
                    <ArticleCard key={related.id} article={related} />
                  ))}
                </div>
              </div>
              <Separator className="my-8" />
            </>
          )}

          {/* Comments Section */}
          <div>
            <div className="flex items-center gap-2 mb-6">
              <MessageCircle className="h-5 w-5" />
              <h2 className="text-xl font-semibold">
                Komentar ({article.comments.length})
              </h2>
            </div>
            <CommentSection
              articleId={article.id}
              comments={article.comments}
            />
          </div>
        </div>
      </article>
    </>
  )
}
