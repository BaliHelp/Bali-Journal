'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Loader2 } from 'lucide-react'
import { useLang } from '@/lib/use-lang'
import { adPositionLabel } from '@/lib/ads/positions'

interface AdSlotRow {
  id: string
  name: string
  position: string
  device: string
  width: number
  height: number
  pricePerDay: number | null
  defaultDurationDays: number
}

type AuthState = 'loading' | 'anon' | 'user' | 'advertiser'

const translations = {
  en: {
    slot: 'Slot',
    size: 'Size',
    pricePerDay: 'Price / Day',
    action: '',
    order: 'Order',
    noSlots: 'No ad slots are available for purchase right now.',
    dialogTitle: (name: string) => `Order: ${name}`,
    dialogDesc: 'Fill in the details below - your invoice is generated instantly.',
    typeLabel: 'Ordering as',
    typeCompany: 'Company',
    typeIndividual: 'Individual',
    nameLabel: 'Company Name',
    nameLabelIndividual: 'Full Name',
    phoneLabel: 'Phone / WhatsApp',
    contactNameLabel: 'Contact Person Name',
    emailLabel: 'Email',
    passwordLabel: 'Password',
    confirmPasswordLabel: 'Confirm Password',
    orderingAs: (name: string) => `Ordering as ${name}`,
    linkUrlLabel: 'Ad Click-through URL (optional)',
    startDateLabel: 'Start Date',
    endDateLabel: 'End Date',
    fileLabel: 'Ad Creative (image or video)',
    days: (n: number) => `${n} day${n > 1 ? 's' : ''}`,
    total: 'Total',
    submit: 'Place Order',
    submitting: 'Processing...',
    pickFileFirst: 'Choose an ad creative file first',
    passwordMismatch: 'Passwords do not match',
    passwordTooShort: 'Password must be at least 6 characters',
    genericError: 'Something went wrong',
  },
  id: {
    slot: 'Slot',
    size: 'Ukuran',
    pricePerDay: 'Harga / Hari',
    action: '',
    order: 'Pesan',
    noSlots: 'Belum ada slot iklan yang tersedia untuk dipesan.',
    dialogTitle: (name: string) => `Pesan: ${name}`,
    dialogDesc: 'Isi detail di bawah - invoice Anda langsung dibuat setelah submit.',
    typeLabel: 'Memesan sebagai',
    typeCompany: 'Perusahaan',
    typeIndividual: 'Perorangan',
    nameLabel: 'Nama Perusahaan',
    nameLabelIndividual: 'Nama Lengkap',
    phoneLabel: 'Nomor Telepon / WhatsApp',
    contactNameLabel: 'Nama Penanggung Jawab',
    emailLabel: 'Email',
    passwordLabel: 'Password',
    confirmPasswordLabel: 'Konfirmasi Password',
    orderingAs: (name: string) => `Memesan sebagai ${name}`,
    linkUrlLabel: 'URL Tujuan Klik Iklan (opsional)',
    startDateLabel: 'Tanggal Mulai',
    endDateLabel: 'Tanggal Selesai',
    fileLabel: 'Creative Iklan (gambar atau video)',
    days: (n: number) => `${n} hari`,
    total: 'Total',
    submit: 'Buat Pesanan',
    submitting: 'Memproses...',
    pickFileFirst: 'Pilih file creative iklan terlebih dahulu',
    passwordMismatch: 'Konfirmasi password tidak cocok',
    passwordTooShort: 'Password minimal 6 karakter',
    genericError: 'Terjadi kesalahan',
  },
}

function formatRupiah(amount: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(amount)
}

function toDateInput(d: Date) {
  return d.toISOString().slice(0, 10)
}

export function AdsOrderFlow({ slots }: { slots: AdSlotRow[] }) {
  const router = useRouter()
  const lang = useLang()
  const t = translations[lang]

  const [authState, setAuthState] = useState<AuthState>('loading')
  const [existingName, setExistingName] = useState<string | null>(null)

  const [orderSlot, setOrderSlot] = useState<AdSlotRow | null>(null)
  const [advertiserType, setAdvertiserType] = useState<'COMPANY' | 'INDIVIDUAL'>('COMPANY')
  const [displayName, setDisplayName] = useState('')
  const [phone, setPhone] = useState('')
  const [contactName, setContactName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function checkAuth() {
      const advertiserRes = await fetch('/api/advertiser/profile')
      if (advertiserRes.ok) {
        const data = await advertiserRes.json()
        setAuthState('advertiser')
        setExistingName(data.advertiser?.companyName ?? null)
        return
      }
      const sessionRes = await fetch('/api/auth/session')
      if (sessionRes.ok) {
        const data = await sessionRes.json()
        if (data.user) {
          setAuthState('user')
          setContactName(data.user.name || '')
          setEmail(data.user.email || '')
          return
        }
      }
      setAuthState('anon')
    }
    checkAuth()
  }, [])

  function openOrder(slot: AdSlotRow) {
    const start = new Date()
    const end = new Date(start.getTime() + slot.defaultDurationDays * 24 * 60 * 60 * 1000)
    setStartDate(toDateInput(start))
    setEndDate(toDateInput(end))
    setError(null)
    setOrderSlot(slot)
  }

  const days =
    startDate && endDate
      ? Math.max(1, Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (24 * 60 * 60 * 1000)))
      : 0
  const total = orderSlot?.pricePerDay ? days * orderSlot.pricePerDay : 0

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!file) {
      setError(t.pickFileFirst)
      return
    }
    if (authState === 'anon') {
      if (password !== confirmPassword) {
        setError(t.passwordMismatch)
        return
      }
      if (password.length < 6) {
        setError(t.passwordTooShort)
        return
      }
    }

    setSubmitting(true)
    try {
      // Step 1: ensure an Advertiser profile exists on this session (creates
      // the account too if the visitor wasn't logged in at all) - a no-op
      // on the server if one already exists.
      if (authState !== 'advertiser') {
        const identityBody =
          authState === 'anon'
            ? { email, password, name: contactName, advertiserType, companyName: displayName, phone }
            : { advertiserType, companyName: displayName, phone }

        const identityRes = await fetch('/api/advertiser/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(identityBody),
        })
        const identityData = await identityRes.json()
        if (!identityRes.ok) throw new Error(identityData.error || t.genericError)
      }

      // Step 2: create the ad + invoice for the selected slot.
      const fd = new FormData()
      fd.append('slotId', orderSlot!.id)
      fd.append('startDate', startDate)
      fd.append('endDate', endDate)
      if (linkUrl.trim()) fd.append('linkUrl', linkUrl.trim())
      fd.append('file', file)

      const orderRes = await fetch('/api/advertiser/ads', { method: 'POST', body: fd })
      const orderData = await orderRes.json()
      if (!orderRes.ok) throw new Error(orderData.error || t.genericError)

      router.push(`/invoice/${orderData.invoice.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : t.genericError)
      setSubmitting(false)
    }
  }

  return (
    <>
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="p-4 font-medium">{t.slot}</th>
              <th className="p-4 font-medium">{t.size}</th>
              <th className="p-4 font-medium">{t.pricePerDay}</th>
              <th className="p-4 font-medium">{t.action}</th>
            </tr>
          </thead>
          <tbody>
            {slots.map((slot) => (
              <tr key={slot.id} className="border-b last:border-0">
                <td className="p-4">
                  <p className="font-medium">{adPositionLabel(slot.position)}</p>
                  <div className="mt-1 flex items-center gap-1.5">
                    <Badge variant="outline" className="text-[10px]">{slot.device}</Badge>
                  </div>
                </td>
                <td className="p-4 text-muted-foreground">{slot.width}×{slot.height}px</td>
                <td className="p-4 font-medium">{formatRupiah(slot.pricePerDay || 0)}</td>
                <td className="p-4 text-right">
                  <Button size="sm" onClick={() => openOrder(slot)}>{t.order}</Button>
                </td>
              </tr>
            ))}
            {slots.length === 0 && (
              <tr>
                <td colSpan={4} className="p-8 text-center text-muted-foreground">{t.noSlots}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={!!orderSlot} onOpenChange={(open) => !open && setOrderSlot(null)}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          {orderSlot && (
            <>
              <DialogHeader>
                <DialogTitle>{t.dialogTitle(adPositionLabel(orderSlot.position))}</DialogTitle>
                <DialogDescription>{t.dialogDesc}</DialogDescription>
              </DialogHeader>

              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                {authState === 'advertiser' ? (
                  <p className="text-sm text-muted-foreground">{t.orderingAs(existingName || '')}</p>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label>{t.typeLabel}</Label>
                      <RadioGroup
                        value={advertiserType}
                        onValueChange={(v) => setAdvertiserType(v as 'COMPANY' | 'INDIVIDUAL')}
                        className="flex gap-4"
                      >
                        <label className="flex items-center gap-2 text-sm">
                          <RadioGroupItem value="COMPANY" /> {t.typeCompany}
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                          <RadioGroupItem value="INDIVIDUAL" /> {t.typeIndividual}
                        </label>
                      </RadioGroup>
                    </div>

                    <div className="space-y-2">
                      <Label>{advertiserType === 'COMPANY' ? t.nameLabel : t.nameLabelIndividual}</Label>
                      <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
                    </div>

                    <div className="space-y-2">
                      <Label>{t.phoneLabel}</Label>
                      <Input value={phone} onChange={(e) => setPhone(e.target.value)} required />
                    </div>

                    {authState === 'anon' && (
                      <>
                        <div className="space-y-2">
                          <Label>{t.contactNameLabel}</Label>
                          <Input value={contactName} onChange={(e) => setContactName(e.target.value)} required />
                        </div>
                        <div className="space-y-2">
                          <Label>{t.emailLabel}</Label>
                          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <Label>{t.passwordLabel}</Label>
                            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                          </div>
                          <div className="space-y-2">
                            <Label>{t.confirmPasswordLabel}</Label>
                            <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
                          </div>
                        </div>
                      </>
                    )}
                  </>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>{t.startDateLabel}</Label>
                    <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label>{t.endDateLabel}</Label>
                    <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>{t.linkUrlLabel}</Label>
                  <Input type="url" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://" />
                </div>

                <div className="space-y-2">
                  <Label>{t.fileLabel}</Label>
                  <Input type="file" accept="image/*,video/webm,video/mp4" onChange={(e) => setFile(e.target.files?.[0] || null)} required />
                </div>

                {days > 0 && (
                  <div className="flex items-center justify-between rounded-md border bg-muted/30 p-3 text-sm">
                    <span className="text-muted-foreground">{t.days(days)}</span>
                    <span className="font-semibold">{t.total}: {formatRupiah(total)}</span>
                  </div>
                )}

                <DialogFooter>
                  <Button type="submit" disabled={submitting || authState === 'loading'} className="w-full">
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : t.submit}
                  </Button>
                </DialogFooter>
              </form>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
