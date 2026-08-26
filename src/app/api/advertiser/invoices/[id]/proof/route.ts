import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdvertiser } from '@/lib/ads/auth'
import { storeProofFile } from '@/lib/ads/media'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireAdvertiser()
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const invoice = await db.invoice.findUnique({ where: { id } })

  if (!invoice || invoice.advertiserId !== ctx.advertiser.id) {
    return NextResponse.json({ error: 'Invoice tidak ditemukan' }, { status: 404 })
  }

  if (invoice.status !== 'UNPAID' && invoice.status !== 'REJECTED') {
    return NextResponse.json({ error: 'Invoice ini tidak bisa diupload ulang buktinya' }, { status: 400 })
  }

  try {
    const formData = await req.formData()
    const file = formData.get('file')
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'File bukti transfer wajib diupload' }, { status: 400 })
    }

    const stored = await storeProofFile(file, invoice.invoiceNumber)
    if ('error' in stored) {
      return NextResponse.json({ error: stored.error }, { status: 400 })
    }

    const updated = await db.invoice.update({
      where: { id: invoice.id },
      data: {
        proofUrl: stored.url,
        status: 'VERIFYING',
        rejectionReason: null,
      },
    })

    return NextResponse.json({ invoice: updated })
  } catch (error) {
    console.error('Upload proof error:', error)
    return NextResponse.json({ error: 'Gagal upload bukti transfer' }, { status: 500 })
  }
}
