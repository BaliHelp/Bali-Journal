import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdvertiser } from '@/lib/ads/auth'

// Only slots the admin has priced are offered for self-service purchase -
// AdSlot.pricePerDay is null for house/admin-only slots from Phase 1.
export async function GET() {
  const ctx = await requireAdvertiser()
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const slots = await db.adSlot.findMany({
    where: { pricePerDay: { not: null } },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ slots })
}
