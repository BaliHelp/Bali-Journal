import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdvertiser } from '@/lib/ads/auth'
import { storeAdMedia } from '@/lib/ads/media'
import { generateInvoiceNumber } from '@/lib/ads/invoice'

export async function GET() {
  const ctx = await requireAdvertiser()
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const ads = await db.ad.findMany({
    where: { advertiserId: ctx.advertiser.id },
    include: { slot: true, invoice: true },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ ads })
}

export async function POST(req: NextRequest) {
  const ctx = await requireAdvertiser()
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Only a REJECTED account is blocked from ordering - PENDING is allowed so
  // a brand-new self-service signup can place their first order immediately
  // (nothing goes live until admin verifies the invoice payment anyway, so
  // there's no risk in letting the order itself go through before review).
  if (ctx.advertiser.status === 'REJECTED') {
    return NextResponse.json(
      { error: 'Akun advertiser Anda ditolak. Hubungi admin untuk informasi lebih lanjut.' },
      { status: 403 }
    )
  }

  try {
    const formData = await req.formData()
    const slotId = formData.get('slotId')
    const linkUrl = formData.get('linkUrl')
    const startDateRaw = formData.get('startDate')
    const endDateRaw = formData.get('endDate')
    const file = formData.get('file')

    if (
      typeof slotId !== 'string' ||
      typeof startDateRaw !== 'string' ||
      typeof endDateRaw !== 'string' ||
      !(file instanceof File)
    ) {
      return NextResponse.json({ error: 'Data tidak lengkap' }, { status: 400 })
    }

    const slot = await db.adSlot.findUnique({ where: { id: slotId } })
    if (!slot || slot.pricePerDay == null) {
      return NextResponse.json({ error: 'Slot iklan tidak tersedia untuk dibeli' }, { status: 400 })
    }

    const startDate = new Date(startDateRaw)
    const endDate = new Date(endDateRaw)
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime()) || endDate <= startDate) {
      return NextResponse.json({ error: 'Rentang tanggal tidak valid' }, { status: 400 })
    }

    const days = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000)))
    const amount = slot.pricePerDay * days

    const media = await storeAdMedia(file, ctx.advertiser.companyName)
    if ('error' in media) {
      return NextResponse.json({ error: media.error }, { status: 400 })
    }

    const { ad, invoice } = await db.$transaction(async (tx) => {
      const ad = await tx.ad.create({
        data: {
          slotId: slot.id,
          advertiserId: ctx.advertiser.id,
          advertiserName: ctx.advertiser.companyName,
          mediaUrl: media.url,
          mediaType: media.mediaType,
          linkUrl: typeof linkUrl === 'string' && linkUrl.trim() ? linkUrl.trim() : null,
          startDate,
          endDate,
          isActive: false,
        },
      })

      const invoice = await tx.invoice.create({
        data: {
          invoiceNumber: generateInvoiceNumber(),
          advertiserId: ctx.advertiser.id,
          adId: ad.id,
          amount,
        },
      })

      return { ad, invoice }
    })

    return NextResponse.json({ ad, invoice })
  } catch (error) {
    console.error('Create advertiser ad error:', error)
    return NextResponse.json({ error: 'Gagal membuat iklan' }, { status: 500 })
  }
}
