import { db } from '@/lib/db'
import { notFound } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { COMPANY_NAME, SITE_NAME } from '@/lib/site-config'
import { CheckCircle2, Clock, XCircle, FileWarning } from 'lucide-react'

function formatRupiah(amount: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(amount)
}

function formatDate(date: Date) {
  return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
}

const STATUS_META: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: typeof CheckCircle2 }> = {
  PAID: { label: 'Lunas', variant: 'default', icon: CheckCircle2 },
  VERIFYING: { label: 'Menunggu Verifikasi', variant: 'secondary', icon: Clock },
  UNPAID: { label: 'Belum Dibayar', variant: 'outline', icon: FileWarning },
  REJECTED: { label: 'Bukti Ditolak', variant: 'destructive', icon: XCircle },
}

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const invoice = await db.invoice.findUnique({
    where: { id },
    include: {
      advertiser: { include: { user: { select: { email: true, name: true } } } },
      ad: { include: { slot: true } },
    },
  })

  if (!invoice) notFound()

  const company = await db.companySettings.findFirst()

  const { ad, advertiser } = invoice
  const { slot } = ad
  const days = Math.max(1, Math.ceil((ad.endDate.getTime() - ad.startDate.getTime()) / (24 * 60 * 60 * 1000)))
  const ratePerDay = slot.pricePerDay ?? Math.round(invoice.amount / days)
  const status = STATUS_META[invoice.status]
  const StatusIcon = status.icon

  return (
    <div className="container mx-auto max-w-3xl px-4 py-10">
      <div className="rounded-xl border bg-card shadow-sm">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4 border-b p-6 md:p-8">
          <div>
            <p className="text-xl font-bold tracking-tight">
              {SITE_NAME.split(' ')[0]} <span className="text-primary">{SITE_NAME.split(' ').slice(1).join(' ')}</span>
            </p>
            <p className="text-sm text-muted-foreground">{COMPANY_NAME}</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-muted-foreground/80">INVOICE</p>
            <p className="font-mono text-sm">{invoice.invoiceNumber}</p>
          </div>
        </div>

        {/* Status + dates */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-muted/40 px-6 py-4 md:px-8">
          <Badge variant={status.variant} className="flex items-center gap-1.5 py-1 px-3 text-sm">
            <StatusIcon className="h-3.5 w-3.5" />
            {status.label}
          </Badge>
          <div className="text-sm text-muted-foreground">
            Diterbitkan {formatDate(invoice.createdAt)}
            {invoice.status === 'PAID' && invoice.paidAt && <> · Dibayar {formatDate(invoice.paidAt)}</>}
          </div>
        </div>

        {invoice.status === 'REJECTED' && invoice.rejectionReason && (
          <div className="mx-6 mt-6 rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive md:mx-8">
            <span className="font-semibold">Alasan penolakan bukti transfer:</span> {invoice.rejectionReason}
          </div>
        )}

        {/* Billed from / to */}
        <div className="grid gap-8 p-6 md:grid-cols-2 md:p-8">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ditagihkan Oleh</p>
            <p className="font-semibold">{company?.companyName || COMPANY_NAME}</p>
            {company?.address && <p className="text-sm text-muted-foreground">{company.address}</p>}
            {company?.npwp && <p className="text-sm text-muted-foreground">NPWP: {company.npwp}</p>}
            {company?.phone && <p className="text-sm text-muted-foreground">{company.phone}</p>}
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ditagihkan Kepada</p>
            <p className="font-semibold">{advertiser.companyName}</p>
            <p className="text-sm text-muted-foreground">{advertiser.user.email}</p>
            <p className="text-sm text-muted-foreground">{advertiser.phone}</p>
          </div>
        </div>

        <Separator />

        {/* Line item */}
        <div className="p-6 md:p-8">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="pb-2 font-medium">Deskripsi</th>
                  <th className="pb-2 font-medium">Periode Tayang</th>
                  <th className="pb-2 text-right font-medium">Hari</th>
                  <th className="pb-2 text-right font-medium">Tarif/Hari</th>
                  <th className="pb-2 text-right font-medium">Jumlah</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="py-3 pr-4">
                    <p className="font-medium">{slot.name}</p>
                    <p className="text-xs text-muted-foreground">{slot.width}×{slot.height}px · {ad.advertiserName}</p>
                  </td>
                  <td className="py-3 pr-4 text-muted-foreground">
                    {formatDate(ad.startDate)} – {formatDate(ad.endDate)}
                  </td>
                  <td className="py-3 pr-4 text-right">{days}</td>
                  <td className="py-3 pr-4 text-right">{formatRupiah(ratePerDay)}</td>
                  <td className="py-3 text-right font-medium">{formatRupiah(invoice.amount)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="mt-6 flex justify-end">
            <div className="w-full max-w-xs space-y-2">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Subtotal</span>
                <span>{formatRupiah(invoice.amount)}</span>
              </div>
              <Separator />
              <div className="flex justify-between text-base font-bold">
                <span>Total</span>
                <span>{formatRupiah(invoice.amount)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Payment info - shown whenever payment hasn't cleared yet */}
        {(invoice.status === 'UNPAID' || invoice.status === 'REJECTED') && company?.bankAccountNo && (
          <>
            <Separator />
            <div className="p-6 md:p-8">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Instruksi Pembayaran</p>
              <div className="rounded-lg border bg-muted/30 p-4 text-sm">
                <p>Transfer manual ke rekening berikut, lalu unggah bukti transfer dari Dashboard Advertiser Anda:</p>
                <div className="mt-3 grid gap-1">
                  <p><span className="text-muted-foreground">Bank:</span> <span className="font-medium">{company.bankName}</span></p>
                  <p><span className="text-muted-foreground">No. Rekening:</span> <span className="font-mono font-medium">{company.bankAccountNo}</span></p>
                  <p><span className="text-muted-foreground">Atas Nama:</span> <span className="font-medium">{company.bankAccountName}</span></p>
                </div>
              </div>
            </div>
          </>
        )}

        {invoice.proofUrl && (
          <>
            <Separator />
            <div className="p-6 md:p-8">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Bukti Transfer</p>
              <a href={invoice.proofUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-primary underline">
                Lihat bukti yang diunggah
              </a>
            </div>
          </>
        )}

        <div className="border-t px-6 py-4 text-center text-xs text-muted-foreground md:px-8">
          Invoice ini diterbitkan otomatis oleh {SITE_NAME} · {invoice.id}
        </div>
      </div>
    </div>
  )
}
