import { db } from '@/lib/db'
import { ArticleCard } from '@/components/article/article-card'
import { CategorySection } from '@/components/article/category-section'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Clock, TrendingUp, AlertTriangle, Shield, FileText } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import { AdSlot, AdMedia, getActiveAd } from '@/components/ads/ad-slot'

export const revalidate = 60 // ISR: 60 seconds

async function getLatestArticles() {
  return db.article.findMany({
    where: { status: 'PUBLISHED' },
    orderBy: { publishedAt: 'desc' },
    take: 50, // Increased to 50 for scrollable list
    include: {
      author: { select: { name: true } },
    },
  })
}

async function getFeaturedArticle() {
  return db.article.findFirst({
    where: {
      status: 'PUBLISHED',
      riskLevel: { not: 'CRITICAL' }
    },
    orderBy: [
      { viewCount: 'desc' },
      { publishedAt: 'desc' },
    ],
    include: {
      author: { select: { name: true } },
    },
  })
}

async function getArticlesByCategory(category: string) {
  return db.article.findMany({
    where: {
      status: 'PUBLISHED',
      category: category as any,
    },
    orderBy: { publishedAt: 'desc' },
    take: 4,
    include: {
      author: { select: { name: true } },
    },
  })
}

async function getPublishedCount() {
  return db.article.count({
    where: { status: 'PUBLISHED' }
  })
}

export default async function HomePage() {
  const [
    latestArticles,
    featuredArticle,
    tourismArticles,
    investmentArticles,
    incidentArticles,
    localArticles,
    jobsArticles,
    opinionArticles,
    totalPublished,
    heroLeftAd,
  ] = await Promise.all([
    getLatestArticles(),
    getFeaturedArticle(),
    getArticlesByCategory('TOURISM'),
    getArticlesByCategory('INVESTMENT'),
    getArticlesByCategory('INCIDENTS'),
    getArticlesByCategory('LOCAL'),
    getArticlesByCategory('JOBS'),
    getArticlesByCategory('OPINION'),
    getPublishedCount(),
    getActiveAd('HOME_HERO_LEFT', 'DESKTOP'),
  ])

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="bg-gradient-to-b from-muted/50 to-background">
        <div className="container mx-auto max-w-7xl px-4 py-8">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Ad rail + Featured Article image are grouped in their own row, nested
                inside a column with the below-hero banner - this way the row's
                only two items (rail, image) stretch to match each other exactly
                (default flex align-items: stretch), so the rail's bottom edge
                lines up EXACTLY with the featured image's bottom edge, and the
                below-hero banner sits underneath spanning the full width. */}
            <div className="flex-1 min-w-0 flex flex-col gap-6">
              <div className="flex flex-col lg:flex-row gap-6">
              {/* Ad rail - only takes up space when there's actually an ad to show.
                  Renders heroLeftAd (already fetched above) directly instead of
                  going through <AdSlot>, which would re-run its own independent
                  DB query for the same data - two separate queries for what
                  should be one fact was producing an intermittent mismatch
                  between this presence check and AdSlot's own render. */}
              {heroLeftAd && (
                <div className="hidden lg:block w-[160px] shrink-0">
                  <div className="hidden md:flex w-full h-full justify-center items-center overflow-hidden rounded-lg">
                    <AdMedia ad={heroLeftAd} fill />
                  </div>
                </div>
              )}

            {/* Featured Article image */}
            <div className="flex-1 min-w-0">
              {featuredArticle ? (
                <Link href={`/article/${featuredArticle.slug}`} className="group block">
                  <div className="relative aspect-[16/9] overflow-hidden rounded-lg bg-muted shadow-lg">
                    {featuredArticle.featuredImageUrl ? (
                      <Image
                        src={featuredArticle.featuredImageUrl}
                        alt={featuredArticle.featuredImageAlt || featuredArticle.title}
                        fill
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                        priority
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <FileText className="h-16 w-16 text-muted-foreground" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8">
                      <div className="flex items-center gap-2 mb-3">
                        <Badge variant="secondary" className="bg-primary/90 text-primary-foreground hover:bg-primary">
                          {categoryLabels[featuredArticle.category]}
                        </Badge>
                      </div>
                      <h1 className="text-2xl md:text-4xl font-bold text-white mb-3 line-clamp-2 leading-tight">
                        {featuredArticle.title}
                      </h1>
                      <p className="text-white/80 line-clamp-2 mb-4 text-sm md:text-base max-w-2xl">
                        {featuredArticle.excerpt}
                      </p>
                      <div className="flex items-center gap-4 text-xs md:text-sm text-white/70">
                        <span className="font-medium text-white">{featuredArticle.author?.name || 'Bali Journal Team'}</span>
                        <span>•</span>
                        <span>
                          {featuredArticle.publishedAt?.toLocaleDateString('en-US', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                          })}
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              ) : (
                <div className="aspect-[16/9] rounded-lg bg-muted flex items-center justify-center">
                  <p className="text-muted-foreground">No articles yet</p>
                </div>
              )}
            </div>
              </div>
              <AdSlot position="HOME_HERO_BELOW" device="DESKTOP" className="w-full h-40 rounded-lg overflow-hidden shrink-0" fill />
            </div>

            {/* Sidebar - Latest News (Scrollable) */}
            <div className="lg:w-[380px] shrink-0 flex flex-col h-full bg-background/50 rounded-lg border p-4">
              <div className="flex items-center justify-between mb-4 sticky top-0 bg-background/50 backdrop-blur-sm py-2 z-10 border-b">
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-primary" />
                  <h2 className="text-lg font-semibold text-primary">Breaking News</h2>
                </div>
                <Badge variant="outline" className="text-xs">
                  {latestArticles.length} Updates
                </Badge>
              </div>

              <div className="overflow-y-auto h-[500px] pr-2 space-y-4 scrollbar-thin scrollbar-thumb-primary/20 hover:scrollbar-thumb-primary/40">
                {latestArticles.map((article) => (
                  <Link
                    key={article.id}
                    href={`/article/${article.slug}`}
                    className="group block p-3 rounded-lg hover:bg-muted/80 transition-all border border-transparent hover:border-border"
                  >
                    <div className="flex gap-3">
                      <div className="relative w-20 h-16 flex-shrink-0 rounded overflow-hidden bg-muted">
                        {article.featuredImageUrl ? (
                          <Image
                            src={article.featuredImageUrl}
                            alt={article.featuredImageAlt || article.title}
                            fill
                            className="object-cover transition-transform group-hover:scale-110"
                          />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <FileText className="h-6 w-6 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold line-clamp-2 group-hover:text-primary transition-colors leading-snug">
                          {article.title}
                        </p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <Badge variant="secondary" className="text-[10px] h-4 px-1 rounded-sm">
                            {categoryLabels[article.category]}
                          </Badge>
                          <p className="text-[10px] text-muted-foreground">
                            {article.publishedAt?.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </p>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}

                {latestArticles.length === 0 && (
                  <div className="text-center py-10 text-muted-foreground text-sm">
                    No breaking news at the moment.
                  </div>
                )}
              </div>

              <div className="mt-4 pt-2 border-t">
                <Link href="/news" className="w-full">
                  <Button variant="outline" className="w-full">See All News</Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust Indicators */}
      <section className="border-y bg-muted/30">
        <div className="container mx-auto max-w-7xl px-4 py-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex items-center gap-3 p-4 rounded-lg bg-background/50">
              <Shield className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">100%</p>
                <p className="text-sm text-muted-foreground">Evidence-Based</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 rounded-lg bg-background/50">
              <FileText className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">{totalPublished}</p>
                <p className="text-sm text-muted-foreground">Published Articles</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 rounded-lg bg-background/50">
              <AlertTriangle className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">Legal</p>
                <p className="text-sm text-muted-foreground">Legal Review</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 rounded-lg bg-background/50">
              <TrendingUp className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">Transparent</p>
                <p className="text-sm text-muted-foreground">Editorial Process</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Categories Feed */}
      <div className="space-y-8 py-8">
        {/* Tourism Section */}
        {tourismArticles.length > 0 && (
          <CategorySection
            title="Tourism & Travel"
            category="TOURISM"
            articles={tourismArticles}
            viewAllHref="/category/tourism"
          />
        )}

        {/* Investment Section */}
        {investmentArticles.length > 0 && (
          <CategorySection
            title="Investment & Economy"
            category="INVESTMENT"
            articles={investmentArticles}
            viewAllHref="/category/investment"
          />
        )}

        {/* Incidents Section */}
        {incidentArticles.length > 0 && (
          <CategorySection
            title="Incidents & Safety"
            category="INCIDENTS"
            articles={incidentArticles}
            viewAllHref="/category/incidents"
          />
        )}

        {/* Local Section */}
        {localArticles.length > 0 && (
          <CategorySection
            title="Local News & Community"
            category="LOCAL"
            articles={localArticles}
            viewAllHref="/category/local"
          />
        )}

        {/* Jobs Section */}
        {jobsArticles.length > 0 && (
          <CategorySection
            title="Jobs & Career"
            category="JOBS"
            articles={jobsArticles}
            viewAllHref="/category/jobs"
          />
        )}

        {/* Opinion Section */}
        {opinionArticles.length > 0 && (
          <CategorySection
            title="Opinion & Analysis"
            category="OPINION"
            articles={opinionArticles}
            viewAllHref="/category/opinion"
          />
        )}
      </div>

      {/* Submit Report CTA */}
      <section className="bg-primary text-primary-foreground">
        <div className="container mx-auto max-w-7xl px-4 py-12">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <h2 className="text-2xl font-bold mb-2">Have Information?</h2>
              <p className="text-primary-foreground/80">
                Submit your report or information to our investigative team.
              </p>
            </div>
            <Link href="/submit-report">
              <Button variant="secondary" size="lg">
                Submit Report
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section className="py-12">
        <div className="container mx-auto max-w-7xl px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-2xl font-bold mb-4">Independent Investigative Journalism</h2>
            <p className="text-muted-foreground mb-6">
              Bali Journal is an independent investigative journalism platform focused on
              delivering evidence-based news with high journalistic ethics standards. We are committed
              to providing accurate, balanced, and accountable information.
            </p>
            <div className="flex justify-center gap-4">
              <Link href="/about">
                <Button variant="outline">About Us</Button>
              </Link>
              <Link href="/transparency">
                <Button variant="outline">Transparency</Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
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
