import { db } from '@/lib/db'
import { notFound } from 'next/navigation'
import { ArticleCard } from '@/components/article/article-card'
import { Badge } from '@/components/ui/badge'

interface CategoryPageProps {
  params: Promise<{ category: string }>
}

const validCategories: Record<string, string> = {
  tourism: 'TOURISM',
  government: 'GOVERNMENT',
  investment: 'INVESTMENT',
  incidents: 'INCIDENTS',
  local: 'LOCAL',
  jobs: 'JOBS',
  opinion: 'OPINION',
}

const categoryLabels: Record<string, string> = {
  TOURISM: 'Tourism',
  GOVERNMENT: 'Government',
  INVESTMENT: 'Investment',
  INCIDENTS: 'Incidents',
  LOCAL: 'Local',
  JOBS: 'Jobs',
  OPINION: 'Opinion',
}

const categoryDescriptions: Record<string, string> = {
  TOURISM: 'News and investigations about Bali tourism industry',
  GOVERNMENT: 'Bali provincial government policies, Governor statements, regulations, public services, key Jakarta updates affecting Bali',
  INVESTMENT: 'Analysis and reports about investment in Bali',
  INCIDENTS: 'Reports of incidents and important events in Bali',
  LOCAL: 'Local news and community stories across Bali',
  JOBS: 'Job information and Bali labor market',
  OPINION: 'Opinions and analysis from our contributors',
}

export async function generateStaticParams() {
  return Object.keys(validCategories).map((category) => ({
    category,
  }))
}

async function getCategoryArticles(category: string) {
  return db.article.findMany({
    where: {
      status: 'PUBLISHED',
      category: category as any,
    },
    orderBy: { publishedAt: 'desc' },
    include: {
      author: { select: { name: true } },
    },
  })
}

export async function generateMetadata({ params }: CategoryPageProps) {
  const { category: categorySlug } = await params
  const category = validCategories[categorySlug]

  if (!category) {
    return { title: 'Category not found' }
  }

  return {
    title: `${categoryLabels[category]} - Bali Journal`,
    description: categoryDescriptions[category],
  }
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { category: categorySlug } = await params
  const category = validCategories[categorySlug]

  if (!category) {
    notFound()
  }

  const articles = await getCategoryArticles(category)

  return (
    <div className="py-8">
      <div className="container mx-auto max-w-7xl px-4">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="secondary" className="text-sm">
              Category
            </Badge>
          </div>
          <h1 className="text-3xl font-bold mb-2">
            {categoryLabels[category]}
          </h1>
          <p className="text-muted-foreground">
            {categoryDescriptions[category]}
          </p>
        </div>

        {/* Articles Grid */}
        {articles.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">
              No articles in this category yet.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {articles.map((article) => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
