import { NextResponse } from 'next/server'
import { getBreakingNewsArticles } from '@/lib/breaking-news'

export async function GET() {
  try {
    const articles = await getBreakingNewsArticles()
    return NextResponse.json({ articles })
  } catch (error) {
    console.error('Get breaking news error:', error)
    return NextResponse.json(
      { articles: [], error: 'Failed to fetch breaking news' },
      { status: 500 }
    )
  }
}
