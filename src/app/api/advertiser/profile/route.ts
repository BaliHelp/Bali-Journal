import { NextResponse } from 'next/server'
import { requireAdvertiser } from '@/lib/ads/auth'

export async function GET() {
  const ctx = await requireAdvertiser()
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return NextResponse.json({
    user: ctx.user,
    advertiser: ctx.advertiser,
  })
}
