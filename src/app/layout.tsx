import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { cache } from 'react'
import './globals.css'
import { Toaster } from '@/components/ui/toaster'
import { Header } from '@/components/layout/header'
import { Footer } from '@/components/layout/footer'
import { BreakingNews } from '@/components/layout/breaking-news'
import { ThemeProvider } from '@/components/theme-provider'
import { AdSlot } from '@/components/ads/ad-slot'
import { PlaceAdsCTA } from '@/components/ads/place-ads-cta'
import { OrganizationJsonLd, WebsiteJsonLd } from '@/components/seo/article-json-ld'
import { getBreakingNewsArticles } from '@/lib/breaking-news'

// BUG FIX (2026-09-02): BreakingNews used to be a pure client component
// that server-rendered stale hardcoded fallback headlines (from the
// pre-rebrand NewsBali era, likely 404 links by now), then fetched the
// real data client-side AFTER hydration - every single page load paid for
// a full extra network round trip AND a visible flash from fake headlines
// to real ones, on top of that fetch competing for this project's single
// pooled DB connection (connection_limit=1) against whatever else that
// page was already loading. Fetching it here, server-side, in the layout
// every page already goes through removes both problems: no separate
// request, no flash, and it's real-time accurate on every full page load
// (this layout has no revalidate/cache directive, so it runs fresh per
// request like the rest of this project's dynamic pages). Scoped to the
// last 7 days (src/lib/breaking-news.ts) per explicit request - only
// genuinely recent headlines should carry a "BREAKING" label.
const getBreakingNews = cache(getBreakingNewsArticles)

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  metadataBase: new URL('https://www.balijournal.com'),
  title: {
    default: 'Bali Journal - Independent Investigative Journalism',
    template: '%s | Bali Journal',
  },
  // Kept under 160 chars - Bing Webmaster Tools flagged the old 198-char
  // version as an SEO error ("Meta Description too long or too short",
  // Bing's own stated limit is 25-160 chars; Google truncates similarly
  // around ~155-160). Full context lives in openGraph.description /
  // twitter.description below instead, which don't have this constraint.
  description: 'Bali News updated daily - independent investigative journalism covering Tourism, Government, Investment, Incidents, and Local affairs across Bali, Indonesia.',
  keywords: ['Bali news', 'Bali news today', 'daily Bali news', 'Bali viral', 'news Bali', 'Investigative Journalism', 'Bali Tourism', 'Bali Investment', 'Bali Government', 'Canggu News', 'Bali Safety', 'Travel Advice Bali', 'Bali Journal'],
  // Root-level default: the homepage's own canonical. Every other route
  // (article, category, /news, /search, static pages) sets its own
  // canonical below/in its own metadata - without an explicit canonical
  // per page, Next.js doesn't emit one at all, and www vs. non-www /
  // trailing-slash variants would otherwise be seen by Google as separate
  // duplicate URLs instead of consolidating signals onto www.balijournal.com.
  alternates: {
    canonical: '/',
  },
  authors: [{ name: 'Bali Journal Team' }],
  creator: 'Bali Journal Media',
  publisher: 'Bali Journal Media',
  icons: {
    icon: [
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-48x48.png', sizes: '48x48', type: 'image/png' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
    shortcut: '/favicon.ico',
  },
  openGraph: {
    title: 'Bali Journal',
    description: 'Investigative Journalism Platform for Bali',
    url: 'https://www.balijournal.com',
    siteName: 'Bali Journal',
    images: [
      {
        url: '/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'Bali Journal - Investigative Journalism from Bali, Indonesia',
      },
    ],
    type: 'website',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Bali Journal',
    description: 'Independent news from Bali, Indonesia.',
    images: ['/og-image.jpg'],
    creator: '@balijournal',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const breakingNews = await getBreakingNews()

  return (
    <html lang="id" suppressHydrationWarning>
      <body className={`${inter.variable} antialiased bg-background text-foreground font-sans`} suppressHydrationWarning>
        <OrganizationJsonLd />
        <WebsiteJsonLd />
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <div className="min-h-screen flex flex-col">
            <Header />
            <AdSlot position="MOBILE_BANNER" device="MOBILE" className="py-2" />
            <BreakingNews initialNews={breakingNews} />
            <main className="flex-1">
              {children}
            </main>
            <AdSlot position="FOOTER" className="py-4" />
            <PlaceAdsCTA />
            <Footer />
          </div>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  )
}
