'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Loader2, Clock, XCircle, Plus } from 'lucide-react'

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

function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(amount)
}

function adStatusLabel(ad: AdRow): { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' } {
  if (ad.invoice?.status === 'REJECTED') return { label: 'Bukti Ditolak', variant: 'destructive' }
  if (!ad.isActive) {
    if (ad.invoice?.status === 'VERIFYING') return { label: 'Menunggu Verifikasi', variant: 'secondary' }
    return { label: 'Menunggu Pembayaran', variant: 'secondary' }
  }
  const now = new Date()
  if (new Date(ad.endDate) < now) return { label: 'Kadaluarsa', variant: 'outline' }
  if (new Date(ad.startDate) > now) return { label: 'Terjadwal', variant: 'outline' }
  return { label: 'Aktif', variant: 'default' }
}

export default function AdvertiserDashboardPage() {
  const router = useRouter()
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
      if (!profileRes.ok) throw new Error(profileData.error || 'Gagal memuat profil')
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
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan')
    } finally {
      setLoading(false)
    }
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
      setError('Pilih file creative iklan terlebih dahulu')
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
      if (!res.ok) throw new Error(data.error || 'Gagal membuat iklan')

      setForm({ slotId: '', linkUrl: '', startDate: '', endDate: '' })
      setFile(null)
      await fetchAll()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan')
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
      if (!res.ok) throw new Error(data.error || 'Gagal upload bukti transfer')
      await fetchAll()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan')
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
            <CardTitle>Menunggu Persetujuan Admin</CardTitle>
            <CardDescription>
              Akun pengiklan &quot;{profile.companyName}&quot; sedang ditinjau. Anda akan bisa memasang iklan setelah disetujui.
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
            <CardTitle>Pendaftaran Ditolak</CardTitle>
            <CardDescription>
              {profile.rejectionReason || 'Akun pengiklan Anda tidak disetujui.'}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard Pengiklan</h1>
        <p className="text-muted-foreground">{profile.companyName}</p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Buat Iklan Baru</CardTitle>
          <CardDescription>Pilih slot, unggah creative, dan tentukan periode tayang</CardDescription>
        </CardHeader>
        <CardContent>
          {slots.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada slot iklan yang tersedia untuk dibeli saat ini.</p>
          ) : (
            <form onSubmit={handleCreateAd} className="space-y-4">
              <div className="space-y-2">
                <Label>Slot Iklan</Label>
                <Select value={form.slotId} onValueChange={(v) => setForm({ ...form, slotId: v })}>
                  <SelectTrigger><SelectValue placeholder="Pilih slot" /></SelectTrigger>
                  <SelectContent>
                    {slots.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name} ({s.width}x{s.height}) - {formatRupiah(s.pricePerDay)}/hari
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Mulai</Label>
                  <Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label>Selesai</Label>
                  <Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} required />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Link Tujuan (opsional)</Label>
                <Input type="url" placeholder="https://..." value={form.linkUrl} onChange={(e) => setForm({ ...form, linkUrl: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>File Creative (gambar atau video .webm/.mp4)</Label>
                <Input type="file" accept="image/*,video/webm,video/mp4" onChange={(e) => setFile(e.target.files?.[0] || null)} required />
              </div>
              {estimatedTotal > 0 && (
                <p className="text-sm">
                  Estimasi biaya: <span className="font-semibold">{formatRupiah(estimatedTotal)}</span> ({days} hari)
                </p>
              )}
              <Button type="submit" disabled={submitting || !form.slotId}>
                {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
                Buat Iklan & Invoice
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Iklan Saya</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Slot</TableHead>
                <TableHead>Periode</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ads.map((ad) => {
                const status = adStatusLabel(ad)
                return (
                  <TableRow key={ad.id}>
                    <TableCell className="font-medium">{ad.slot?.name}</TableCell>
                    <TableCell className="text-xs">
                      {new Date(ad.startDate).toLocaleDateString('id-ID')} - {new Date(ad.endDate).toLocaleDateString('id-ID')}
                    </TableCell>
                    <TableCell><Badge variant={status.variant}>{status.label}</Badge></TableCell>
                  </TableRow>
                )
              })}
              {ads.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">Belum ada iklan.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Invoice & Pembayaran</CardTitle>
          <CardDescription>Transfer manual ke rekening berikut, lalu unggah bukti transfer</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {paymentInfo?.bankAccountNo && (
            <div className="p-4 rounded-lg border bg-muted/30 text-sm">
              <p><span className="text-muted-foreground">Bank:</span> {paymentInfo.bankName}</p>
              <p><span className="text-muted-foreground">No. Rekening:</span> {paymentInfo.bankAccountNo}</p>
              <p><span className="text-muted-foreground">Atas Nama:</span> {paymentInfo.bankAccountName}</p>
            </div>
          )}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>No. Invoice</TableHead>
                <TableHead>Nominal</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ads.filter((ad) => ad.invoice).map((ad) => (
                <TableRow key={ad.invoice!.id}>
                  <TableCell className="font-mono text-xs">{ad.invoice!.invoiceNumber}</TableCell>
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
                          {uploadingProofFor === ad.invoice!.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Upload Bukti'}
                        </Button>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {ads.filter((ad) => ad.invoice).length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Belum ada invoice.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
