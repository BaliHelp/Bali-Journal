import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdvertiser } from '@/lib/ads/auth'

// Only the bank fields are exposed here - advertisers don't need to see the
// company's NPWP/address, that's for the invoice document itself (admin-only).
export async function GET() {
  const ctx = await requireAdvertiser()
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const settings = await db.companySettings.findFirst()

  return NextResponse.json({
    bankName: settings?.bankName ?? null,
    bankAccountNo: settings?.bankAccountNo ?? null,
    bankAccountName: settings?.bankAccountName ?? null,
  })
}
