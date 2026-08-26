import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth/session'
import { storeAdMedia } from '@/lib/ads/media'
import { generateInvoiceNumber } from '@/lib/ads/invoice'

async function requireEditor() {
    const session = await getSession()
    return session && (session.role === 'ADMIN' || session.role === 'EDITOR') ? session : null
}

export async function GET() {
    if (!(await requireEditor())) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const ads = await db.ad.findMany({
        orderBy: { createdAt: 'desc' },
        include: { slot: true, invoice: true },
    })
    return NextResponse.json({ ads })
}

export async function POST(req: NextRequest) {
    if (!(await requireEditor())) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const formData = await req.formData()
        const slotId = formData.get('slotId') as string | null
        const advertiserName = formData.get('advertiserName') as string | null
        const linkUrl = (formData.get('linkUrl') as string | null) || null
        const startDate = formData.get('startDate') as string | null
        const endDate = formData.get('endDate') as string | null
        const file = formData.get('file')
        const advertiserId = (formData.get('advertiserId') as string | null) || null
        const invoiceAmountRaw = formData.get('invoiceAmount') as string | null

        if (!slotId || !startDate || !endDate) {
            return NextResponse.json(
                { error: 'slotId, startDate, endDate are required' },
                { status: 400 }
            )
        }
        if (!advertiserId && !advertiserName) {
            return NextResponse.json({ error: 'advertiserName is required for a house ad' }, { status: 400 })
        }
        if (!(file instanceof File)) {
            return NextResponse.json({ error: 'file (image or video) is required' }, { status: 400 })
        }

        const slot = await db.adSlot.findUnique({ where: { id: slotId } })
        if (!slot) {
            return NextResponse.json({ error: 'Ad slot not found' }, { status: 404 })
        }

        // Admin creating this on behalf of a registered advertiser - mirrors the
        // self-service flow (Ad starts inactive, paired 1:1 with an Invoice), so
        // the existing "Invoices" admin tab is the single place payment gets
        // verified and the ad flipped live, regardless of who created it.
        if (advertiserId) {
            const advertiser = await db.advertiser.findUnique({ where: { id: advertiserId } })
            if (!advertiser) {
                return NextResponse.json({ error: 'Advertiser not found' }, { status: 404 })
            }

            const start = new Date(startDate)
            const end = new Date(endDate)
            if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) {
                return NextResponse.json({ error: 'Rentang tanggal tidak valid' }, { status: 400 })
            }

            let amount = invoiceAmountRaw ? Number(invoiceAmountRaw) : NaN
            if (!invoiceAmountRaw || isNaN(amount)) {
                if (slot.pricePerDay == null) {
                    return NextResponse.json({ error: 'invoiceAmount is required (slot has no default price)' }, { status: 400 })
                }
                const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)))
                amount = slot.pricePerDay * days
            }

            const stored = await storeAdMedia(file, advertiser.companyName)
            if ('error' in stored) {
                return NextResponse.json({ error: stored.error }, { status: 400 })
            }

            const { ad, invoice } = await db.$transaction(async (tx) => {
                const ad = await tx.ad.create({
                    data: {
                        slotId,
                        advertiserId,
                        advertiserName: advertiser.companyName,
                        mediaUrl: stored.url,
                        mediaType: stored.mediaType,
                        linkUrl,
                        startDate: start,
                        endDate: end,
                        isActive: false,
                    },
                })
                const invoice = await tx.invoice.create({
                    data: {
                        invoiceNumber: generateInvoiceNumber(),
                        advertiserId,
                        adId: ad.id,
                        amount,
                    },
                })
                return { ad, invoice }
            })

            return NextResponse.json({ ad, invoice })
        }

        const stored = await storeAdMedia(file, advertiserName!)
        if ('error' in stored) {
            return NextResponse.json({ error: stored.error }, { status: 400 })
        }

        const ad = await db.ad.create({
            data: {
                slotId,
                advertiserName: advertiserName!,
                mediaUrl: stored.url,
                mediaType: stored.mediaType,
                linkUrl,
                startDate: new Date(startDate),
                endDate: new Date(endDate),
            },
        })

        return NextResponse.json({ ad })
    } catch (error) {
        console.error('Create ad error:', error)
        return NextResponse.json({ error: 'Failed to create ad' }, { status: 500 })
    }
}
