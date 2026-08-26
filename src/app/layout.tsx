import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Toaster } from '@/components/ui/toaster'
import { Header } from '@/components/layout/header'
import { Footer } from '@/components/layout/footer'
import { BreakingNews } from '@/components/layout/breaking-news'
import { ThemeProvider } from '@/components/theme-provider'
import { AdSlot } from '@/components/ads/ad-slot'
import { RotatingAdSlot } from '@/components/ads/rotating-ad-slot'
import { PlaceAdsCTA } from '@/components/ads/place-ads-cta'

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  metadataBase: new URL('https://newsbali.online'),
  title: {
    default: 'NewsBali Online - Independent Investigative Journalism',
    template: '%s | NewsBali Online',
  },
  description: 'Bali\'s premier independent investigative journalism platform. Delivering evidence-based news on Tourism, Investment, Incidents, and Local affairs in Bali, Indonesia.',
  keywords: ['Bali news', 'Investigative Journalism', 'Bali Tourism', 'Bali Investment', 'Canggu News', 'Bali Safety', 'Travel Advice Bali', 'NewsBali'],
  authors: [{ name: 'NewsBali Team' }],
  creator: 'NewsBali Media',
  publisher: 'NewsBali Media',
  icons: {
    icon: '/Logo.webp',
    apple: '/Logo.webp',
  },
  openGraph: {
    title: 'NewsBali Online',
    description: 'Investigative Journalism Platform for Bali',
    url: 'https://newsbali.online',
    siteName: 'NewsBali Online',
    images: [
      {
        url: '/opengraph-image', // Dynamic OG Image
        width: 1200,
        height: 630,
        alt: 'NewsBali Online Cover',
      },
    ],
    type: 'website',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'NewsBali Online',
    description: 'Independent news from Bali, Indonesia.',
    images: ['/opengraph-image'],
    creator: '@newsbali',
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body className={`${inter.variable} antialiased bg-background text-foreground font-sans`} suppressHydrationWarning>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <div className="min-h-screen flex flex-col">
            <Header />
            <RotatingAdSlot position="HEADER" device="DESKTOP" className="py-2" />
            <AdSlot position="MOBILE_BANNER" device="MOBILE" className="py-2" />
            <BreakingNews />
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
