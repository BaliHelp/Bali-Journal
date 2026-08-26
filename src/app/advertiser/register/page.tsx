'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Mail, Lock, User, Building2, Phone, Eye, EyeOff } from 'lucide-react'
import { useLang } from '@/lib/use-lang'

const translations = {
  en: {
    title: 'Register as an Advertiser',
    subtitle: 'Place your ads on Bali Journal',
    companyName: 'Company Name',
    companyNamePlaceholder: 'PT Example Bali',
    contactName: 'Contact Person Name',
    contactNamePlaceholder: 'Your name',
    phone: 'Phone / WhatsApp Number',
    email: 'Email',
    emailPlaceholder: 'name@company.com',
    password: 'Password',
    confirmPassword: 'Confirm Password',
    disclaimer: 'New accounts are reviewed by an admin before you can place ads.',
    submit: 'Register',
    submitting: 'Processing...',
    haveAccount: 'Already have an advertiser account?',
    login: 'Log in',
    passwordMismatch: 'Passwords do not match',
    passwordTooShort: 'Password must be at least 6 characters',
    registerFailed: 'Registration failed',
    genericError: 'Something went wrong',
  },
  id: {
    title: 'Daftar Sebagai Pengiklan',
    subtitle: 'Pasang iklan Anda di Bali Journal',
    companyName: 'Nama Perusahaan',
    companyNamePlaceholder: 'PT Contoh Bali',
    contactName: 'Nama Penanggung Jawab',
    contactNamePlaceholder: 'Nama Anda',
    phone: 'Nomor Telepon / WhatsApp',
    email: 'Email',
    emailPlaceholder: 'nama@perusahaan.com',
    password: 'Password',
    confirmPassword: 'Konfirmasi Password',
    disclaimer: 'Akun baru akan ditinjau admin sebelum bisa memasang iklan.',
    submit: 'Daftar',
    submitting: 'Memproses...',
    haveAccount: 'Sudah punya akun pengiklan?',
    login: 'Masuk',
    passwordMismatch: 'Konfirmasi password tidak cocok',
    passwordTooShort: 'Password minimal 6 karakter',
    registerFailed: 'Registrasi gagal',
    genericError: 'Terjadi kesalahan',
  },
}

export default function AdvertiserRegisterPage() {
  const router = useRouter()
  const lang = useLang()
  const t = translations[lang]
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [phone, setPhone] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password !== confirmPassword) {
      setError(t.passwordMismatch)
      return
    }

    if (password.length < 6) {
      setError(t.passwordTooShort)
      return
    }

    setLoading(true)

    try {
      const res = await fetch('/api/advertiser/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, companyName, phone }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || t.registerFailed)
      }

      router.push('/advertiser')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : t.genericError)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[calc(100vh-200px)] flex items-center justify-center py-12">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">{t.title}</CardTitle>
          <CardDescription>
            {t.subtitle}
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="companyName">{t.companyName}</Label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="companyName"
                  type="text"
                  placeholder={t.companyNamePlaceholder}
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="pl-10"
                  required
                  disabled={loading}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">{t.contactName}</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="name"
                  type="text"
                  placeholder={t.contactNamePlaceholder}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="pl-10"
                  required
                  disabled={loading}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">{t.phone}</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="phone"
                  type="tel"
                  placeholder="08123456789"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="pl-10"
                  required
                  disabled={loading}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">{t.email}</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder={t.emailPlaceholder}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  required
                  disabled={loading}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">{t.password}</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-10"
                  required
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">{t.confirmPassword}</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="confirmPassword"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="pl-10"
                  required
                  disabled={loading}
                />
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              {t.disclaimer}
            </p>
          </CardContent>

          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t.submitting}
                </>
              ) : (
                t.submit
              )}
            </Button>

            <p className="text-sm text-center text-muted-foreground">
              {t.haveAccount}{' '}
              <Link href="/login" className="text-primary hover:underline">
                {t.login}
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
