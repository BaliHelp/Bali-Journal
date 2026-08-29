'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Loader2, Clock, XCircle, Plus } from 'lucide-react'
import { useLang, type Lang } from '@/lib/use-lang'

interface AdvertiserProfile {
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  companyName: string
  rejectionReason: string | null
}

interface SlotOption {
  id: string
  name: string
  position: string
  device: string
  width: number
  height: number
  pricePerDay: number
  defaultDurationDays: number
}

interface InvoiceRow {
  id: string
  invoiceNumber: string
  amount: number
  status: 'UNPAID' | 'VERIFYING' | 'PAID' | 'REJECTED'
  rejectionReason: string | null
}

interface AdRow {
  id: string
  advertiserName: string
  mediaUrl: string
  isActive: boolean
  startDate: string
  endDate: string
  slot: SlotOption
  invoice: InvoiceRow | null
}

interface PaymentInfo {
  bankName: string | null
  bankAccountNo: string | null
  bankAccountName: string | null
}

const translations = {
  en: {
    loadProfileFailed: 'Failed to load profile',
    genericError: 'Something went wrong',
    pickFileFirst: 'Choose an ad creative file first',
    createAdFailed: 'Failed to create ad',
    uploadProofFailed: 'Failed to upload payment proof',
    pendingTitle: 'Awaiting Admin Approval',
    pendingDesc: (name: string) => `Your advertiser account "${name}" is under review. You'll be able to place ads once approved.`,
    rejectedTitle: 'Registration Rejected',
    rejectedDefault: 'Your advertiser account was not approved.',
    dashboardTitle: 'Advertiser Dashboard',
    newAdTitle: 'Create New Ad',
    newAdDesc: 'Pick a slot, upload your creative, and set the run dates',
    noSlots: 'No ad slots are available for purchase right now.',
    slotLabel: 'Ad Slot',
    slotPlaceholder: 'Choose a slot',
    perDay: '/day',
    start: 'Start',
    end: 'End',
    destinationLink: 'Destination Link (optional)',
    creativeFile: 'Creative File (image or .webm/.mp4 video)',
    estimatedCost: 'Estimated cost',
    days: 'days',
    createAdBtn: 'Create Ad & Invoice',
    myAdsTitle: 'My Ads',
    colSlot: 'Slot',
    colPeriod: 'Period',
    colDuration: 'Duration',
    colTimeLeft: 'Time Left',
    colStatus: 'Status',
    noAds: 'No ads yet.',
    invoicesTitle: 'Invoices & Payment',
    invoicesDesc: 'Transfer manually to the account below, then upload proof of payment',
    bank: 'Bank',
    accountNo: 'Account No.',
    accountName: 'Account Name',
    colInvoiceNo: 'Invoice No.',
    colAmount: 'Amount',
    colAction: 'Action',
    noInvoices: 'No invoices yet.',
    uploadProof: 'Upload Proof',
  },
  id: {
    loadProfileFailed: 'Gagal memuat profil',
    genericError: 'Terjadi kesalahan',
    pickFileFirst: 'Pilih file creative iklan terlebih dahulu',
    createAdFailed: 'Gagal membuat iklan',
    uploadProofFailed: 'Gagal upload bukti transfer',
    pendingTitle: 'Menunggu Persetujuan Admin',
    pendingDesc: (name: string) => `Akun pengiklan "${name}" sedang ditinjau. Anda akan bisa memasang iklan setelah disetujui.`,
    rejectedTitle: 'Pendaftaran Ditolak',
    rejectedDefault: 'Akun pengiklan Anda tidak disetujui.',
    dashboardTitle: 'Dashboard Pengiklan',
    newAdTitle: 'Buat Iklan Baru',
    newAdDesc: 'Pilih slot, unggah creative, dan tentukan periode tayang',
    noSlots: 'Belum ada slot iklan yang tersedia untuk dibeli saat ini.',
    slotLabel: 'Slot Iklan',
    slotPlaceholder: 'Pilih slot',
    perDay: '/hari',
    start: 'Mulai',
    end: 'Selesai',
    destinationLink: 'Link Tujuan (opsional)',
    creativeFile: 'File Creative (gambar atau video .webm/.mp4)',
    estimatedCost: 'Estimasi biaya',
    days: 'hari',
    createAdBtn: 'Buat Iklan & Invoice',
    myAdsTitle: 'Iklan Saya',
    colSlot: 'Slot',
    colPeriod: 'Periode',
    colDuration: 'Durasi',
    colTimeLeft: 'Sisa Waktu',
    colStatus: 'Status',
    noAds: 'Belum ada iklan.',
    invoicesTitle: 'Invoice & Pembayaran',
    invoicesDesc: 'Transfer manual ke rekening berikut, lalu unggah bukti transfer',
    bank: 'Bank',
    accountNo: 'No. Rekening',
    accountName: 'Atas Nama',
    colInvoiceNo: 'No. Invoice',
    colAmount: 'Nominal',
    colAction: 'Aksi',
    noInvoices: 'Belum ada invoice.',
    uploadProof: 'Upload Bukti',
  },
}

function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(amount)
}

function adStatusLabel(ad: AdRow, lang: Lang): { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' } {
  if (ad.invoice?.status === 'REJECTED') return { label: lang === 'id' ? 'Bukti Ditolak' : 'Proof Rejected', variant: 'destructive' }
  if (!ad.isActive) {
    if (ad.invoice?.status === 'VERIFYING') return { label: lang === 'id' ? 'Menunggu Verifikasi' : 'Awaiting Verification', variant: 'secondary' }
    return { label: lang === 'id' ? 'Menunggu Pembayaran' : 'Awaiting Payment', variant: 'secondary' }
  }
  const now = new Date()
  if (new Date(ad.endDate) < now) return { label: lang === 'id' ? 'Kadaluarsa' : 'Expired', variant: 'outline' }
  if (new Date(ad.startDate) > now) return { label: lang === 'id' ? 'Terjadwal' : 'Scheduled', variant: 'outline' }
  return { label: lang === 'id' ? 'Aktif' : 'Active', variant: 'default' }
}

function durationInfo(ad: AdRow, lang: Lang): { totalDays: number; remainingText: string } {
  const DAY_MS = 24 * 60 * 60 * 1000
  const start = new Date(ad.startDate)
  const end = new Date(ad.endDate)
  const now = new Date()
  const totalDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / DAY_MS))

  if (!ad.isActive) return { totalDays, remainingText: '-' }
  if (start > now) {
    const daysUntilStart = Math.ceil((start.getTime() - now.getTime()) / DAY_MS)
    return { totalDays, remainingText: lang === 'id' ? `Mulai dalam ${daysUntilStart} hari` : `Starts in ${daysUntilStart} days` }
  }
  if (end < now) {
    const daysAgo = Math.ceil((now.getTime() - end.getTime()) / DAY_MS)
    return { totalDays, remainingText: lang === 'id' ? `Berakhir ${daysAgo} hari lalu` : `Ended ${daysAgo} days ago` }
  }
  const daysLeft = Math.ceil((end.getTime() - now.getTime()) / DAY_MS)
  return { totalDays, remainingText: lang === 'id' ? `${daysLeft} hari lagi` : `${daysLeft} days left` }
}

export default function AdvertiserDashboardPage() {
  const router = useRouter()
  const lang = useLang()
  const t = translations[lang]
  const [authChecked, setAuthChecked] = useState(false)
  const [profile, setProfile] = useState<AdvertiserProfile | null>(null)
  const [slots, setSlots] = useState<SlotOption[]>([])
  const [ads, setAds] = useState<AdRow[]>([])
  const [paymentInfo, setPaymentInfo] = useState<PaymentInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({ slotId: '', linkUrl: '', startDate: '', endDate: '' })
  const [file, setFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [uploadingProofFor, setUploadingProofFor] = useState<string | null>(null)

  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch('/api/auth/session')
        const data = await res.json()
        if (!res.ok || !data.user || data.user.role !== 'ADVERTISER') {
          router.push('/login')
          return
        }
        setAuthChecked(true)
      } catch {
        router.push('/login')
      }
    }
    checkAuth()
  }, [router])

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const profileRes = await fetch('/api/advertiser/profile')
      const profileData = await profileRes.json()
      if (!profileRes.ok) throw new Error(profileData.error || t.loadProfileFailed)
      setProfile(profileData.advertiser)

      if (profileData.advertiser?.status === 'APPROVED') {
        const [slotsRes, adsRes, paymentRes] = await Promise.all([
          fetch('/api/advertiser/slots'),
          fetch('/api/advertiser/ads'),
          fetch('/api/advertiser/payment-info'),
        ])
        const slotsData = await slotsRes.json()
        const adsData = await adsRes.json()
        const paymentData = await paymentRes.json()
        setSlots(slotsData.slots || [])
        setAds(adsData.ads || [])
        setPaymentInfo(paymentData)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t.genericError)
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (authChecked) fetchAll()
  }, [authChecked, fetchAll])

  const selectedSlot = slots.find((s) => s.id === form.slotId)
  const days =
    form.startDate && form.endDate
      ? Math.max(1, Math.ceil((new Date(form.endDate).getTime() - new Date(form.startDate).getTime()) / (24 * 60 * 60 * 1000)))
      : 0
  const estimatedTotal = selectedSlot && days > 0 ? selectedSlot.pricePerDay * days : 0

  async function handleCreateAd(e: React.FormEvent) {
    e.preventDefault()
    if (!file) {
      setError(t.pickFileFirst)
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const fd = new FormData()
      fd.append('slotId', form.slotId)
      fd.append('linkUrl', form.linkUrl)
      fd.append('startDate', form.startDate)
      fd.append('endDate', form.endDate)
      fd.append('file', file)

      const res = await fetch('/api/advertiser/ads', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || t.createAdFailed)

      setForm({ slotId: '', linkUrl: '', startDate: '', endDate: '' })
      setFile(null)
      await fetchAll()
    } catch (err) {
      setError(err instanceof Error ? err.message : t.genericError)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleUploadProof(invoiceId: string, proofFile: File) {
    setUploadingProofFor(invoiceId)
    setError(null)
    try {
      const fd = new FormData()
      fd.append('file', proofFile)
      const res = await fetch(`/api/advertiser/invoices/${invoiceId}/proof`, { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || t.uploadProofFailed)
      await fetchAll()
    } catch (err) {
      setError(err instanceof Error ? err.message : t.genericError)
    } finally {
      setUploadingProofFor(null)
    }
  }

  if (!authChecked || loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!profile) return null

  if (profile.status === 'PENDING') {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-16">
        <Card>
          <CardHeader className="text-center">
            <Clock className="h-10 w-10 mx-auto mb-2 text-muted-foreground" />
            <CardTitle>{t.pendingTitle}</CardTitle>
            <CardDescription>
              {t.pendingDesc(profile.companyName)}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  if (profile.status === 'REJECTED') {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-16">
        <Card>
          <CardHeader className="text-center">
            <XCircle className="h-10 w-10 mx-auto mb-2 text-destructive" />
            <CardTitle>{t.rejectedTitle}</CardTitle>
            <CardDescription>
              {profile.rejectionReason || t.rejectedDefault}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t.dashboardTitle}</h1>
        <p className="text-muted-foreground">{profile.companyName}</p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t.newAdTitle}</CardTitle>
          <CardDescription>{t.newAdDesc}</CardDescription>
        </CardHeader>
        <CardContent>
          {slots.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t.noSlots}</p>
          ) : (
            <form onSubmit={handleCreateAd} className="space-y-4">
              <div className="space-y-2">
                <Label>{t.slotLabel}</Label>
                <Select
                  value={form.slotId}
                  onValueChange={(v) => {
                    const slot = slots.find((s) => s.id === v)
                    const shouldPrefillDates = !form.startDate && !form.endDate && slot
                    if (shouldPrefillDates) {
                      const start = new Date()
                      const end = new Date(start.getTime() + slot.defaultDurationDays * 24 * 60 * 60 * 1000)
                      setForm({
                        ...form,
                        slotId: v,
                        startDate: start.toISOString().slice(0, 10),
                        endDate: end.toISOString().slice(0, 10),
                      })
                    } else {
                      setForm({ ...form, slotId: v })
                    }
                  }}
                >
                  <SelectTrigger><SelectValue placeholder={t.slotPlaceholder} /></SelectTrigger>
                  <SelectContent>
                    {slots.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name} ({s.width}x{s.height} px) - {formatRupiah(s.pricePerDay)}{t.perDay}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t.start}</Label>
                  <Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label>{t.end}</Label>
                  <Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} required />
                </div>
              </div>
              <div className="space-y-2">
                <Label>{t.destinationLink}</Label>
                <Input type="url" placeholder="https://..." value={form.linkUrl} onChange={(e) => setForm({ ...form, linkUrl: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>{t.creativeFile}</Label>
                <Input type="file" accept="image/*,video/webm,video/mp4" onChange={(e) => setFile(e.target.files?.[0] || null)} required />
              </div>
              {estimatedTotal > 0 && (
                <p className="text-sm">
                  {t.estimatedCost}: <span className="font-semibold">{formatRupiah(estimatedTotal)}</span> ({days} {t.days})
                </p>
              )}
              <Button type="submit" disabled={submitting || !form.slotId}>
                {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
                {t.createAdBtn}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t.myAdsTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t.colSlot}</TableHead>
                <TableHead>{t.colPeriod}</TableHead>
                <TableHead>{t.colDuration}</TableHead>
                <TableHead>{t.colTimeLeft}</TableHead>
                <TableHead>{t.colStatus}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ads.map((ad) => {
                const status = adStatusLabel(ad, lang)
                const duration = durationInfo(ad, lang)
                return (
                  <TableRow key={ad.id}>
                    <TableCell className="font-medium">{ad.slot?.name}</TableCell>
                    <TableCell className="text-xs">
                      {new Date(ad.startDate).toLocaleDateString(lang === 'id' ? 'id-ID' : 'en-US')} - {new Date(ad.endDate).toLocaleDateString(lang === 'id' ? 'id-ID' : 'en-US')}
                    </TableCell>
                    <TableCell className="text-xs">{duration.totalDays} {t.days}</TableCell>
                    <TableCell className="text-xs">{duration.remainingText}</TableCell>
                    <TableCell><Badge variant={status.variant}>{status.label}</Badge></TableCell>
                  </TableRow>
                )
              })}
              {ads.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">{t.noAds}</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t.invoicesTitle}</CardTitle>
          <CardDescription>{t.invoicesDesc}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {paymentInfo?.bankAccountNo && (
            <div className="p-4 rounded-lg border bg-muted/30 text-sm">
              <p><span className="text-muted-foreground">{t.bank}:</span> {paymentInfo.bankName}</p>
              <p><span className="text-muted-foreground">{t.accountNo}:</span> {paymentInfo.bankAccountNo}</p>
              <p><span className="text-muted-foreground">{t.accountName}:</span> {paymentInfo.bankAccountName}</p>
            </div>
          )}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t.colInvoiceNo}</TableHead>
                <TableHead>{t.colAmount}</TableHead>
                <TableHead>{t.colStatus}</TableHead>
                <TableHead className="text-right">{t.colAction}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ads.filter((ad) => ad.invoice).map((ad) => (
                <TableRow key={ad.invoice!.id}>
                  <TableCell className="font-mono text-xs">
                    <Link href={`/invoice/${ad.invoice!.id}`} target="_blank" className="text-primary underline underline-offset-2 hover:no-underline">
                      {ad.invoice!.invoiceNumber}
                    </Link>
                  </TableCell>
                  <TableCell>{formatRupiah(ad.invoice!.amount)}</TableCell>
                  <TableCell>
                    <Badge variant={ad.invoice!.status === 'PAID' ? 'default' : ad.invoice!.status === 'REJECTED' ? 'destructive' : 'secondary'}>
                      {ad.invoice!.status}
                    </Badge>
                    {ad.invoice!.status === 'REJECTED' && ad.invoice!.rejectionReason && (
                      <p className="text-xs text-destructive mt-1">{ad.invoice!.rejectionReason}</p>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {(ad.invoice!.status === 'UNPAID' || ad.invoice!.status === 'REJECTED') && (
                      <>
                        <input
                          type="file"
                          accept="image/*,application/pdf"
                          className="hidden"
                          id={`proof-upload-${ad.invoice!.id}`}
                          disabled={uploadingProofFor !== null}
                          onChange={(e) => {
                            const f = e.target.files?.[0]
                            if (f) handleUploadProof(ad.invoice!.id, f)
                            e.target.value = ''
                          }}
                        />
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={uploadingProofFor !== null}
                          onClick={() => document.getElementById(`proof-upload-${ad.invoice!.id}`)?.click()}
                        >
                          {uploadingProofFor === ad.invoice!.id ? <Loader2 className="h-4 w-4 animate-spin" /> : t.uploadProof}
                        </Button>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {ads.filter((ad) => ad.invoice).length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">{t.noInvoices}</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
