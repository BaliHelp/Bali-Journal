'use client'
// Force Rebuild
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarInset,
  SidebarTrigger,
  SidebarSeparator,
} from '@/components/ui/sidebar'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Loader2,
  Plus,
  Trash2,
  Edit,
  Eye,
  CheckCircle,
  XCircle,
  AlertTriangle,
  FileText,
  Users,
  MessageCircle,
  Shield,
  BarChart3,
  Settings,
  Search,
  Send,
  Save,
  Link as LinkIcon,
  Image as ImageIcon,
  LogOut,
  LayoutDashboard,
  Sparkles,
  Brain,
  Zap,
  Activity,
  RefreshCw,
  List,
  Megaphone,
  Upload,
  Users2,
  Receipt
} from 'lucide-react'
import Image from 'next/image'
import { AiControls } from '@/components/admin/ai-controls'
import { AdminChatWidget } from '@/components/admin/chat-widget'
import { AgentStatusCard } from '@/components/admin/agent-status-card'
import { SystemHealthCard } from '@/components/admin/system-health-card'
import { ScheduleCard } from '@/components/admin/schedule-card'

interface NavItem {
  value: string
  label: string
  icon: typeof LayoutDashboard
}

const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: 'Utama',
    items: [{ value: 'overview', label: 'Overview', icon: LayoutDashboard }],
  },
  {
    label: 'Konten',
    items: [
      { value: 'listnews', label: 'List News', icon: List },
      { value: 'articles', label: 'Articles', icon: FileText },
      { value: 'comments', label: 'Comments', icon: MessageCircle },
    ],
  },
  {
    label: 'Manajemen',
    items: [
      { value: 'users', label: 'Users', icon: Users },
      { value: 'reports', label: 'Reports', icon: BarChart3 },
    ],
  },
  {
    label: 'Monetisasi',
    items: [
      { value: 'ads', label: 'Ads', icon: Megaphone },
      { value: 'advertisers', label: 'Advertisers', icon: Users2 },
      { value: 'invoices', label: 'Invoices', icon: Receipt },
    ],
  },
  {
    label: 'Sistem',
    items: [
      { value: 'ai', label: 'AI Center', icon: Brain },
      { value: 'settings', label: 'Settings', icon: Settings },
    ],
  },
]

const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((g) => g.items)

const categories = [
  { value: 'TOURISM', label: 'Pariwisata' },
  { value: 'GOVERNMENT', label: 'Pemerintah' },
  { value: 'INVESTMENT', label: 'Investasi' },
  { value: 'INCIDENTS', label: 'Insiden' },
  { value: 'LOCAL', label: 'Lokal' },
  { value: 'JOBS', label: 'Pekerjaan' },
  { value: 'OPINION', label: 'Opini' },
]

const statusColors: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  DRAFT: 'outline',
  REVIEW: 'secondary',
  PUBLISHED: 'default',
  REJECTED: 'destructive',
  PENDING: 'secondary',
  APPROVED: 'default',
  FLAGGED: 'destructive',
}

const roleColors: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  ADMIN: 'default',
  EDITOR: 'secondary',
  USER: 'outline',
}

const riskColors: Record<string, string> = {
  LOW: 'bg-green-500',
  MEDIUM: 'bg-yellow-500',
  HIGH: 'bg-orange-500',
  CRITICAL: 'bg-red-500',
}

interface AdSlotRow {
  id: string
  name: string
  position: string
  device: string
  width: number
  height: number
  pricePerDay: number | null
  ads: { id: string; isActive: boolean }[]
}

interface AdvertiserRow {
  id: string
  companyName: string
  phone: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  rejectionReason: string | null
  user: { email: string; name: string | null }
}

interface InvoiceRow {
  id: string
  invoiceNumber: string
  amount: number
  status: 'UNPAID' | 'VERIFYING' | 'PAID' | 'REJECTED'
  proofUrl: string | null
  rejectionReason: string | null
  advertiser: { companyName: string; user: { email: string } }
  ad: { slot: { name: string } }
}

interface CompanySettingsData {
  companyName: string
  address: string
  npwp: string
  phone: string
  bankName: string
  bankAccountNo: string
  bankAccountName: string
}

interface AdRow {
  id: string
  slotId: string
  slot: AdSlotRow
  advertiserName: string
  mediaUrl: string
  mediaType: 'IMAGE' | 'VIDEO'
  linkUrl: string | null
  startDate: string
  endDate: string
  isActive: boolean
}

interface Article {
  id: string
  title: string
  slug: string
  excerpt: string
  content: string
  category: string
  featuredImageUrl: string | null
  featuredImageAlt: string | null
  imageSource: string | null
  aiAssisted: boolean
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  riskScore: number
  containsAccusation: boolean
  verificationLevel: string
  evidenceCount: number
  status: 'DRAFT' | 'REVIEW' | 'PUBLISHED' | 'REJECTED'
  viewCount: number
  createdAt: string
  publishedAt: string | null
  author: { name: string | null, email: string }
}

interface Report {
  id: string
  title: string
  category: string
  content: string
  sourceContact: string | null
  evidenceLinks: string | null
  status: string
  createdAt: string
}



interface Comment {
  id: string
  content: string
  status: string
  toxicityScore: number | null
  createdAt: string
  user: { name: string | null; email: string }
  article: { title: string }
}

interface User {
  id: string
  email: string
  name: string | null
  role: string
  createdAt: string
  _count?: { articles: number; comments: number }
}

export default function MasterAdminDashboard() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState('overview')

  // Data states
  const [articles, setArticles] = useState<Article[]>([])
  const [listNewsSearch, setListNewsSearch] = useState('')
  const [reports, setReports] = useState<Report[]>([])
  const [comments, setComments] = useState<Comment[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [stats, setStats] = useState({
    totalArticles: 0,
    publishedArticles: 0,
    totalUsers: 0,
    totalComments: 0,
    pendingComments: 0,
    highRiskArticles: 0,
  })

  // UI states
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Article form state
  const [articleForm, setArticleForm] = useState({
    title: '',
    excerpt: '',
    content: '',
    category: '',
    featuredImageUrl: '',
    featuredImageAlt: '',
    imageSource: '',
    status: 'DRAFT',
  })
  const [editingArticle, setEditingArticle] = useState<Article | null>(null)
  const [showArticleDialog, setShowArticleDialog] = useState(false)
  const [analyzingRisk, setAnalyzingRisk] = useState(false)
  const [riskAnalysis, setRiskAnalysis] = useState<{
    riskScore: number
    riskLevel: string
    containsAccusation: boolean
    recommendations: string[]
  } | null>(null)

  // Photo upload state (article edit dialog)
  const [uploadingSlot, setUploadingSlot] = useState<'top' | 'middle' | 'bottom' | null>(null)

  // Ads panel state
  const [adSlots, setAdSlots] = useState<AdSlotRow[]>([])
  const [ads, setAds] = useState<AdRow[]>([])
  const [showAdSlotDialog, setShowAdSlotDialog] = useState(false)
  const [showAdDialog, setShowAdDialog] = useState(false)
  const [adSlotForm, setAdSlotForm] = useState({ name: '', position: 'HEADER', device: 'DESKTOP', width: 728, height: 90, pricePerDay: '' })
  const [adForm, setAdForm] = useState({ slotId: '', advertiserName: '', linkUrl: '', startDate: '', endDate: '' })
  const [adFile, setAdFile] = useState<File | null>(null)
  const [adsLoading, setAdsLoading] = useState(false)

  async function fetchAdsData() {
    setAdsLoading(true)
    try {
      const [slotsRes, adsRes] = await Promise.all([
        fetch('/api/admin/ad-slots'),
        fetch('/api/admin/ads'),
      ])
      const slotsData = slotsRes.ok ? await slotsRes.json() : { slots: [] }
      const adsData = adsRes.ok ? await adsRes.json() : { ads: [] }
      if (Array.isArray(slotsData.slots)) setAdSlots(slotsData.slots)
      if (Array.isArray(adsData.ads)) setAds(adsData.ads)
    } catch (err) {
      console.error('Error fetching ads data:', err)
    } finally {
      setAdsLoading(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'ads' && adSlots.length === 0 && ads.length === 0) {
      fetchAdsData()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab])

  async function handleCreateAdSlot(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      const res = await fetch('/api/admin/ad-slots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(adSlotForm),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create ad slot')
      setSuccess('Ad slot created!')
      setShowAdSlotDialog(false)
      setAdSlotForm({ name: '', position: 'HEADER', device: 'DESKTOP', width: 728, height: 90, pricePerDay: '' })
      fetchAdsData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create ad slot')
    }
  }

  async function handleDeleteAdSlot(id: string) {
    if (!confirm('Hapus slot iklan ini? Semua iklan di dalamnya ikut terhapus.')) return
    try {
      const res = await fetch(`/api/admin/ad-slots/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete')
      setSuccess('Ad slot deleted!')
      fetchAdsData()
    } catch {
      setError('Failed to delete ad slot')
    }
  }

  async function handleCreateAd(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!adFile) {
      setError('Pilih file gambar/video dulu')
      return
    }
    try {
      const formData = new FormData()
      formData.append('slotId', adForm.slotId)
      formData.append('advertiserName', adForm.advertiserName)
      formData.append('linkUrl', adForm.linkUrl)
      formData.append('startDate', adForm.startDate)
      formData.append('endDate', adForm.endDate)
      formData.append('file', adFile)

      const res = await fetch('/api/admin/ads', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create ad')
      setSuccess('Ad created!')
      setShowAdDialog(false)
      setAdForm({ slotId: '', advertiserName: '', linkUrl: '', startDate: '', endDate: '' })
      setAdFile(null)
      fetchAdsData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create ad')
    }
  }

  async function handleToggleAdActive(id: string, isActive: boolean) {
    try {
      await fetch(`/api/admin/ads/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !isActive }),
      })
      fetchAdsData()
    } catch {
      setError('Failed to update ad')
    }
  }

  async function handleDeleteAd(id: string) {
    if (!confirm('Hapus iklan ini?')) return
    try {
      const res = await fetch(`/api/admin/ads/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete')
      setSuccess('Ad deleted!')
      fetchAdsData()
    } catch {
      setError('Failed to delete ad')
    }
  }

  // Advertisers panel state
  const [advertisers, setAdvertisers] = useState<AdvertiserRow[]>([])
  const [advertisersLoading, setAdvertisersLoading] = useState(false)

  async function fetchAdvertisers() {
    setAdvertisersLoading(true)
    try {
      const res = await fetch('/api/admin/advertisers')
      const data = await res.json()
      if (Array.isArray(data.advertisers)) setAdvertisers(data.advertisers)
    } catch (err) {
      console.error('Error fetching advertisers:', err)
    } finally {
      setAdvertisersLoading(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'advertisers' && advertisers.length === 0) {
      fetchAdvertisers()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab])

  async function handleApproveAdvertiser(id: string) {
    try {
      const res = await fetch(`/api/admin/advertisers/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'APPROVED' }),
      })
      if (!res.ok) throw new Error('Failed to approve advertiser')
      setSuccess('Advertiser approved!')
      fetchAdvertisers()
    } catch {
      setError('Failed to approve advertiser')
    }
  }

  async function handleRejectAdvertiser(id: string) {
    const reason = prompt('Alasan penolakan (opsional):') || undefined
    try {
      const res = await fetch(`/api/admin/advertisers/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'REJECTED', rejectionReason: reason }),
      })
      if (!res.ok) throw new Error('Failed to reject advertiser')
      setSuccess('Advertiser rejected')
      fetchAdvertisers()
    } catch {
      setError('Failed to reject advertiser')
    }
  }

  // Invoices panel state
  const [invoices, setInvoices] = useState<InvoiceRow[]>([])
  const [invoicesLoading, setInvoicesLoading] = useState(false)

  async function fetchInvoices() {
    setInvoicesLoading(true)
    try {
      const res = await fetch('/api/admin/invoices')
      const data = await res.json()
      if (Array.isArray(data.invoices)) setInvoices(data.invoices)
    } catch (err) {
      console.error('Error fetching invoices:', err)
    } finally {
      setInvoicesLoading(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'invoices' && invoices.length === 0) {
      fetchInvoices()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab])

  async function handleVerifyInvoicePaid(id: string) {
    if (!confirm('Konfirmasi: tandai invoice ini LUNAS? Iklan akan langsung aktif tayang.')) return
    try {
      const res = await fetch(`/api/admin/invoices/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'PAID' }),
      })
      if (!res.ok) throw new Error('Failed to verify invoice')
      setSuccess('Invoice diverifikasi lunas, iklan aktif!')
      fetchInvoices()
    } catch {
      setError('Failed to verify invoice')
    }
  }

  async function handleRejectInvoice(id: string) {
    const reason = prompt('Alasan penolakan bukti transfer (opsional):') || undefined
    try {
      const res = await fetch(`/api/admin/invoices/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'REJECTED', rejectionReason: reason }),
      })
      if (!res.ok) throw new Error('Failed to reject invoice')
      setSuccess('Invoice rejected')
      fetchInvoices()
    } catch {
      setError('Failed to reject invoice')
    }
  }

  // Company settings state (used in Settings tab)
  const [companySettings, setCompanySettings] = useState<CompanySettingsData>({
    companyName: '', address: '', npwp: '', phone: '', bankName: '', bankAccountNo: '', bankAccountName: '',
  })
  const [companySettingsLoaded, setCompanySettingsLoaded] = useState(false)
  const [savingCompanySettings, setSavingCompanySettings] = useState(false)

  async function fetchCompanySettings() {
    try {
      const res = await fetch('/api/admin/company-settings')
      const data = await res.json()
      if (data.settings) {
        setCompanySettings({
          companyName: data.settings.companyName || '',
          address: data.settings.address || '',
          npwp: data.settings.npwp || '',
          phone: data.settings.phone || '',
          bankName: data.settings.bankName || '',
          bankAccountNo: data.settings.bankAccountNo || '',
          bankAccountName: data.settings.bankAccountName || '',
        })
      }
    } catch (err) {
      console.error('Error fetching company settings:', err)
    } finally {
      setCompanySettingsLoaded(true)
    }
  }

  useEffect(() => {
    if (activeTab === 'settings' && !companySettingsLoaded) {
      fetchCompanySettings()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab])

  async function handleSaveCompanySettings() {
    setSavingCompanySettings(true)
    try {
      const res = await fetch('/api/admin/company-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(companySettings),
      })
      if (!res.ok) throw new Error('Failed to save')
      setSuccess('Company settings saved!')
    } catch {
      setError('Failed to save company settings')
    } finally {
      setSavingCompanySettings(false)
    }
  }

  // Search state
  const [searchQuery, setSearchQuery] = useState('')
  const [authChecked, setAuthChecked] = useState(false)

  // Check authentication on mount
  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch('/api/auth/session')
        const data = await res.json()

        if (!res.ok || !data.user || (data.user.role !== 'ADMIN' && data.user.role !== 'EDITOR')) {
          router.push('/login')
          return
        }

        setAuthChecked(true)
      } catch (err) {
        router.push('/login')
      }
    }

    checkAuth()
  }, [router])

  // Fetch all data on mount
  useEffect(() => {
    if (authChecked) {
      fetchAllData()
    }
  }, [authChecked])

  async function fetchAllData() {
    setLoading(true)
    try {
      const [articlesRes, commentsRes, usersRes, reportsRes] = await Promise.all([
        fetch('/api/admin/articles'),
        fetch('/api/admin/comments'),
        fetch('/api/admin/users'),
        fetch('/api/admin/reports'),
      ])

      const articlesData = articlesRes.ok ? await articlesRes.json() : { articles: [] }
      const commentsData = commentsRes.ok ? await commentsRes.json() : { comments: [] }
      const usersData = usersRes.ok ? await usersRes.json() : { users: [] }
      const reportsData = reportsRes.ok ? await reportsRes.json() : []

      if (Array.isArray(articlesData.articles)) setArticles(articlesData.articles)
      if (Array.isArray(commentsData.comments)) setComments(commentsData.comments)
      if (Array.isArray(usersData.users)) setUsers(usersData.users)
      if (Array.isArray(reportsData)) setReports(reportsData)

      // Calculate stats
      setStats({
        totalArticles: articlesData.articles?.length || 0,
        publishedArticles: articlesData.articles?.filter((a: Article) => a.status === 'PUBLISHED').length || 0,
        totalUsers: usersData.users?.length || 0,
        totalComments: commentsData.comments?.length || 0,
        pendingComments: commentsData.comments?.filter((c: Comment) => c.status === 'PENDING').length || 0,
        highRiskArticles: articlesData.articles?.filter((a: Article) => ['HIGH', 'CRITICAL'].includes(a.riskLevel)).length || 0,
      })
    } catch (err) {
      console.error('Error fetching data:', err)
      setError('Failed to load dashboard data')
    } finally {
      setLoading(false)
    }
  }

  function resetArticleForm() {
    setArticleForm({
      title: '',
      excerpt: '',
      content: '',
      category: '',
      featuredImageUrl: '',
      featuredImageAlt: '',
      imageSource: '',
      status: 'DRAFT',
    })
    setRiskAnalysis(null)
    setAnalyzingRisk(false)
  }

  async function handleCreateArticle(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const res = await fetch('/api/articles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...articleForm,
          status: articleForm.status || 'DRAFT',
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create article')
      }

      setSuccess('Article created successfully!')
      setShowArticleDialog(false)
      resetArticleForm()
      fetchAllData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  async function handleUpdateArticle(e: React.FormEvent) {
    e.preventDefault()
    if (!editingArticle) return

    setError(null)
    setLoading(true)

    try {
      const res = await fetch(`/api/articles/${editingArticle.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(articleForm),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to update article')
      }

      setSuccess('Article updated successfully!')
      setShowArticleDialog(false)
      setEditingArticle(null)
      resetArticleForm()
      fetchAllData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  async function handlePhotoUpload(position: 'top' | 'middle' | 'bottom', file: File) {
    if (!editingArticle) return

    setUploadingSlot(position)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('position', position)

      const res = await fetch(`/api/admin/articles/${editingArticle.id}/upload-image`, {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to upload photo')
      }

      setSuccess(`Photo uploaded (${position}) and converted to WebP!`)
      setEditingArticle(data.article)
      fetchAllData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload photo')
    } finally {
      setUploadingSlot(null)
    }
  }

  function photoCount(article: Article | null): number {
    if (!article) return 0
    const inContent = (article.content.match(/<img\b/gi) || []).length
    return inContent + (article.featuredImageUrl ? 1 : 0)
  }

  async function handleDeleteArticle(id: string) {
    if (!confirm('Are you sure you want to delete this article?')) return

    try {
      const res = await fetch(`/api/articles/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete')
      setSuccess('Article deleted!')
      fetchAllData()
    } catch (err) {
      setError('Failed to delete article')
    }
  }

  async function handlePublishArticle(id: string) {
    try {
      const res = await fetch(`/api/articles/${id}/publish`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to publish')
      setSuccess(data.published ? 'Article published!' : 'Article unpublished')
      fetchAllData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to publish article')
    }
  }

  async function handleCommentAction(id: string, action: 'approve' | 'reject') {
    try {
      const res = await fetch(`/api/admin/comments/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: action === 'approve' ? 'APPROVED' : 'REJECTED' }),
      })
      if (!res.ok) throw new Error('Failed to update')
      setSuccess(`Comment ${action}d!`)
      fetchAllData()
    } catch (err) {
      setError('Failed to update comment')
    }
  }

  async function handleUserRoleChange(userId: string, newRole: string) {
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      })
      if (!res.ok) throw new Error('Failed to update')
      setSuccess('User role updated!')
      fetchAllData()
    } catch (err) {
      setError('Failed to update user role')
    }
  }

  async function analyzeRisk() {
    if (!articleForm.content || !articleForm.title) return

    setAnalyzingRisk(true)
    try {
      const res = await fetch('/api/articles/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: articleForm.content, title: articleForm.title }),
      })
      const data = await res.json()
      if (res.ok) {
        setRiskAnalysis(data)
      }
    } catch (err) {
      console.error('Risk analysis failed:', err)
    } finally {
      setAnalyzingRisk(false)
    }
  }



  function openEditArticle(article: Article) {
    setEditingArticle(article)
    setArticleForm({
      title: article.title,
      excerpt: article.excerpt,
      content: article.content,
      category: article.category,
      featuredImageUrl: article.featuredImageUrl || '',
      featuredImageAlt: article.featuredImageAlt || '',
      imageSource: article.imageSource || '',
      status: article.status,
    })
    setShowArticleDialog(true)
  }

  function handleLogout() {
    fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }


  async function handleRepairImage(id: string, title: string) {
    if (!confirm(`Regenerate image for "${title}"? This will replace the current image.`)) return

    // Optimistic UI or Loading state could be added here
    setSuccess(`Repairing image for "${title}"...`)

    try {
      const res = await fetch(`/api/articles/${id}/repair`, { method: 'POST' })
      const data = await res.json()

      if (!res.ok) throw new Error(data.error || 'Failed to repair image')

      setSuccess('Image repaired successfully!')
      fetchAllData() // Refresh list to show new image (if we displayed thumbnails)
    } catch (err) {
      setError('Failed to repair image')
    }
  }

  // Enhanced Search Logic
  const filteredArticles = articles.filter(a => {
    const q = searchQuery.toLowerCase()
    return (
      a.title.toLowerCase().includes(q) ||
      a.category.toLowerCase().includes(q) ||
      a.author?.name?.toLowerCase().includes(q) ||
      a.status.toLowerCase().includes(q)
    )
  })

  // Filter Comments
  const filteredComments = comments.filter(c => {
    const q = searchQuery.toLowerCase()
    return (
      c.content.toLowerCase().includes(q) ||
      c.user.email.toLowerCase().includes(q) ||
      c.article.title.toLowerCase().includes(q)
    )
  })

  // Filter Users
  const filteredUsers = users.filter(u => {
    const q = searchQuery.toLowerCase()
    return (
      u.name?.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.role.toLowerCase().includes(q)
    )
  })

  const activeNavLabel = NAV_ITEMS.find((item) => item.value === activeTab)?.label || 'Overview'

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <div className="flex items-center gap-2 px-2 py-1">
            <LayoutDashboard className="h-6 w-6 text-primary shrink-0" />
            <div className="flex flex-col group-data-[collapsible=icon]:hidden">
              <span className="font-bold text-sm leading-tight">NewsBali Master</span>
              <Badge variant="secondary" className="w-fit text-[10px] mt-0.5">v2.1.0</Badge>
            </div>
          </div>
        </SidebarHeader>
        <SidebarContent>
          {NAV_GROUPS.map((group, gi) => (
            <SidebarGroup key={group.label}>
              <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.value}>
                    <SidebarMenuButton
                      isActive={activeTab === item.value}
                      onClick={() => setActiveTab(item.value)}
                      tooltip={item.label}
                    >
                      <item.icon />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
              {gi < NAV_GROUPS.length - 1 && <SidebarSeparator className="mx-0" />}
            </SidebarGroup>
          ))}
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="View Site">
                <a href="/" target="_blank" rel="noopener noreferrer">
                  <LinkIcon />
                  <span>View Site</span>
                </a>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton onClick={handleLogout} tooltip="Logout">
                <LogOut />
                <span>Logout</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset>
      {/* Header */}
      <header className="bg-background border-b sticky top-0 z-50">
        <div className="px-4 h-16 flex items-center gap-3">
          <SidebarTrigger />
          <span className="font-semibold text-lg">{activeNavLabel}</span>
        </div>
      </header>

      <main className="px-4 py-6 md:px-6">
        {/* Quick Stats & Alerts */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Articles</p>
                <h3 className="text-2xl font-bold">{stats.totalArticles}</h3>
              </div>
              <FileText className="h-8 w-8 text-blue-500 opacity-20" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Pending Comments</p>
                <h3 className="text-2xl font-bold">{stats.pendingComments}</h3>
              </div>
              <MessageCircle className="h-8 w-8 text-yellow-500 opacity-20" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">High Risk Articles</p>
                <h3 className="text-2xl font-bold">{stats.highRiskArticles}</h3>
              </div>
              <Shield className="h-8 w-8 text-red-500 opacity-20" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Users</p>
                <h3 className="text-2xl font-bold">{stats.totalUsers}</h3>
              </div>
              <Users className="h-8 w-8 text-green-500 opacity-20" />
            </CardContent>
          </Card>
        </div>

        {/* System Health Check */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <SystemHealthCard />
          <AgentStatusCard />
          <ScheduleCard />
        </div>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="mb-6 border-green-200 bg-green-50 text-green-800">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">

          <TabsContent value="overview">
            <div className="grid gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Welcome back, Admin</CardTitle>
                  <CardDescription>
                    Here is what's happening on NewsBali today.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p>Select a tab to manage content.</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="listnews">
            <Card>
              <CardHeader>
                <CardTitle>List News</CardTitle>
                <CardDescription>Semua berita - Kategori, Judul, dan Ringkasan singkat</CardDescription>
                <div className="pt-2">
                  <Input
                    placeholder="Cari judul atau kategori..."
                    value={listNewsSearch}
                    onChange={(e) => setListNewsSearch(e.target.value)}
                    className="max-w-sm"
                  />
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[140px]">Category</TableHead>
                      <TableHead>Judul Berita</TableHead>
                      <TableHead>Short Description</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {articles
                      .filter((a) => {
                        const q = listNewsSearch.toLowerCase()
                        return !q || a.title.toLowerCase().includes(q) || a.category.toLowerCase().includes(q)
                      })
                      .map((a) => (
                        <TableRow key={a.id}>
                          <TableCell>
                            <Badge variant="secondary">{a.category}</Badge>
                          </TableCell>
                          <TableCell className="font-medium max-w-xs">{a.title}</TableCell>
                          <TableCell className="text-muted-foreground max-w-md">{a.excerpt}</TableCell>
                        </TableRow>
                      ))}
                    {articles.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                          Belum ada berita.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="articles">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Article Management</CardTitle>
                    <CardDescription>Create, edit, and manage all articles</CardDescription>
                  </div>
                  <Dialog open={showArticleDialog} onOpenChange={setShowArticleDialog}>
                    <DialogTrigger asChild>
                      <Button onClick={() => { resetArticleForm(); setEditingArticle(null); }}>
                        <Plus className="h-4 w-4 mr-2" />
                        New Article
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>{editingArticle ? 'Edit Article' : 'Create New Article'}</DialogTitle>
                        <DialogDescription>
                          Fill in the article details. AI will analyze legal risk automatically.
                        </DialogDescription>
                      </DialogHeader>
                      <form onSubmit={editingArticle ? handleUpdateArticle : handleCreateArticle} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <Label htmlFor="title">Title *</Label>
                              <Input
                                id="title"
                                value={articleForm.title}
                                onChange={(e) => setArticleForm({ ...articleForm, title: e.target.value })}
                                placeholder="Article title"
                                required
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="excerpt">Excerpt *</Label>
                              <Textarea
                                id="excerpt"
                                value={articleForm.excerpt}
                                onChange={(e) => setArticleForm({ ...articleForm, excerpt: e.target.value })}
                                placeholder="Brief summary (50-300 chars)"
                                rows={2}
                                required
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="category">Category *</Label>
                              <Select
                                value={articleForm.category}
                                onValueChange={(value) => setArticleForm({ ...articleForm, category: value })}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select category" />
                                </SelectTrigger>
                                <SelectContent>
                                  {categories.map((cat) => (
                                    <SelectItem key={cat.value} value={cat.value}>
                                      {cat.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="status">Status</Label>
                              <Select
                                value={articleForm.status}
                                onValueChange={(value) => setArticleForm({ ...articleForm, status: value })}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="DRAFT">Draft</SelectItem>
                                  <SelectItem value="REVIEW">Review</SelectItem>
                                  <SelectItem value="PUBLISHED">Published</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <Label htmlFor="featuredImageUrl">Image URL *</Label>
                              <div className="relative">
                                <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                  id="featuredImageUrl"
                                  type="url"
                                  value={articleForm.featuredImageUrl}
                                  onChange={(e) => setArticleForm({ ...articleForm, featuredImageUrl: e.target.value })}
                                  placeholder="https://example.com/image.jpg"
                                  className="pl-10"
                                />
                              </div>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="featuredImageAlt">Image Alt Text *</Label>
                              <Input
                                id="featuredImageAlt"
                                value={articleForm.featuredImageAlt}
                                onChange={(e) => setArticleForm({ ...articleForm, featuredImageAlt: e.target.value })}
                                placeholder="Describe the image"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="imageSource">Image Source *</Label>
                              <Input
                                id="imageSource"
                                value={articleForm.imageSource}
                                onChange={(e) => setArticleForm({ ...articleForm, imageSource: e.target.value })}
                                placeholder="Photographer or source"
                              />
                            </div>
                            {articleForm.featuredImageUrl && (
                              <div className="relative aspect-video rounded-lg overflow-hidden bg-muted">
                                <Image
                                  src={articleForm.featuredImageUrl}
                                  alt={articleForm.featuredImageAlt || 'Preview'}
                                  fill
                                  className="object-cover"
                                />
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="content">Content *</Label>
                          <Textarea
                            id="content"
                            value={articleForm.content}
                            onChange={(e) => setArticleForm({ ...articleForm, content: e.target.value })}
                            placeholder="Write your article content here... (HTML supported)"
                            rows={10}
                            required
                          />
                        </div>

                        {/* Risk Analysis */}
                        <div className="flex items-center gap-4 p-4 rounded-lg border bg-muted/30">
                          <Button type="button" variant="outline" onClick={analyzeRisk} disabled={analyzingRisk}>
                            {analyzingRisk ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <Shield className="h-4 w-4 mr-2" />
                            )}
                            Analyze Legal Risk
                          </Button>
                          {riskAnalysis && (
                            <div className="flex items-center gap-4">
                              <Badge variant={riskAnalysis.riskLevel === 'LOW' ? 'default' : riskAnalysis.riskLevel === 'MEDIUM' ? 'secondary' : 'destructive'}>
                                Risk: {riskAnalysis.riskScore}/100 ({riskAnalysis.riskLevel})
                              </Badge>
                              {riskAnalysis.containsAccusation && (
                                <AlertTriangle className="h-4 w-4 text-orange-500" />
                              )}
                            </div>
                          )}
                        </div>

                        {editingArticle ? (
                          <div className="space-y-2 border-t pt-4">
                            <Label className="flex items-center gap-2">
                              <ImageIcon className="h-4 w-4" />
                              Foto Artikel ({photoCount(editingArticle)}/3) - dikonversi otomatis ke WebP
                            </Label>
                            <div className="flex flex-wrap gap-2">
                              {(['top', 'middle', 'bottom'] as const).map((slot) => (
                                <div key={slot}>
                                  <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    id={`photo-upload-${slot}`}
                                    disabled={uploadingSlot !== null || photoCount(editingArticle) >= 3}
                                    onChange={(e) => {
                                      const file = e.target.files?.[0]
                                      if (file) handlePhotoUpload(slot, file)
                                      e.target.value = ''
                                    }}
                                  />
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    disabled={uploadingSlot !== null || photoCount(editingArticle) >= 3}
                                    onClick={() => document.getElementById(`photo-upload-${slot}`)?.click()}
                                  >
                                    {uploadingSlot === slot ? (
                                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    ) : (
                                      <Upload className="h-4 w-4 mr-2" />
                                    )}
                                    {slot === 'top' ? 'Foto Utama' : slot === 'middle' ? 'Foto Tengah' : 'Foto Bawah'}
                                  </Button>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground border-t pt-4">
                            Simpan artikel dulu untuk bisa upload foto.
                          </p>
                        )}

                        <DialogFooter>
                          <Button type="button" variant="outline" onClick={() => setShowArticleDialog(false)}>
                            Cancel
                          </Button>
                          <Button type="submit" disabled={loading}>
                            {loading ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <Save className="h-4 w-4 mr-2" />
                            )}
                            {editingArticle ? 'Update' : 'Create'} Article
                          </Button>
                        </DialogFooter>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>
                <div className="flex items-center gap-4 mt-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search articles..."
                      className="pl-8"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[100px] hidden sm:table-cell">Image</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead className="hidden lg:table-cell">Category</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="hidden xl:table-cell">Risk</TableHead>
                      <TableHead className="hidden xl:table-cell">Views</TableHead>
                      <TableHead className="hidden lg:table-cell">Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredArticles.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          No articles found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredArticles.map((article) => (
                        <TableRow key={article.id}>
                          <TableCell className="hidden sm:table-cell">
                            <div className="relative w-16 h-12 rounded overflow-hidden bg-muted">
                              {article.featuredImageUrl ? (
                                <Image
                                  src={article.featuredImageUrl}
                                  alt={article.featuredImageAlt || ''}
                                  fill
                                  className="object-cover"
                                />
                              ) : (
                                <div className="flex items-center justify-center h-full">
                                  <ImageIcon className="h-4 w-4 text-muted-foreground" />
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="max-w-xs">
                            <p className="font-medium line-clamp-1">{article.title}</p>
                            <p className="text-xs text-muted-foreground hidden md:block">{article.author?.name || 'Unknown'}</p>
                          </TableCell>
                          <TableCell className="hidden lg:table-cell">
                            <Badge variant="outline">{article.category}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={statusColors[article.status] ?? 'default'}>
                              {article.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="hidden xl:table-cell">
                            <div className="flex items-center gap-2">
                              <div className={`w-2 h-2 rounded-full ${riskColors[article.riskLevel] ?? 'bg-gray-400'}`} />
                              <span className="text-sm">{article.riskScore}</span>
                            </div>
                          </TableCell>
                          <TableCell className="hidden xl:table-cell">{article.viewCount}</TableCell>
                          <TableCell className="hidden lg:table-cell">
                            {new Date(article.createdAt).toLocaleDateString('id-ID')}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleRepairImage(article.id, article.title)}
                                title="Repair/Regenerate Image"
                                className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                              >
                                <RefreshCw className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => openEditArticle(article)}>
                                <Edit className="h-4 w-4" />
                              </Button>
                              {article.status !== 'PUBLISHED' ? (
                                <Button variant="ghost" size="icon" onClick={() => handlePublishArticle(article.id)}>
                                  <Send className="h-4 w-4 text-green-500" />
                                </Button>
                              ) : (
                                <Button variant="ghost" size="icon" onClick={() => handlePublishArticle(article.id)}>
                                  <Eye className="h-4 w-4" />
                                </Button>
                              )}
                              <Button variant="ghost" size="icon" onClick={() => handleDeleteArticle(article.id)}>
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="comments">
            <Card>
              <CardHeader>
                <CardTitle>Comment Moderation</CardTitle>
                <CardDescription>Review and moderate user comments with AI assistance</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search comments..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Content</TableHead>
                        <TableHead className="hidden md:table-cell">User</TableHead>
                        <TableHead className="hidden lg:table-cell">Article</TableHead>
                        <TableHead className="hidden sm:table-cell">Toxicity</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="hidden xl:table-cell">Date</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredComments.map((comment) => (
                        <TableRow key={comment.id}>
                          <TableCell className="max-w-xs">
                            <p className="text-sm line-clamp-2">{comment.content}</p>
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            <div>
                              <p className="text-sm font-medium">{comment.user.name || 'Anonymous'}</p>
                              <p className="text-xs text-muted-foreground">{comment.user.email}</p>
                            </div>
                          </TableCell>
                          <TableCell className="max-w-[150px] hidden lg:table-cell">
                            <p className="text-sm line-clamp-1">{comment.article.title}</p>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                            {comment.toxicityScore !== null ? (
                              <Badge variant={comment.toxicityScore > 0.5 ? 'destructive' : 'secondary'}>
                                {(comment.toxicityScore * 100).toFixed(0)}%
                              </Badge>
                            ) : '-'}
                          </TableCell>
                          <TableCell>
                            <Badge variant={statusColors[comment.status]}>{comment.status}</Badge>
                          </TableCell>
                          <TableCell className="hidden xl:table-cell">
                            {new Date(comment.createdAt).toLocaleDateString('id-ID')}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button size="icon" variant="ghost" onClick={() => handleCommentAction(comment.id, 'approve')}>
                                <CheckCircle className="h-4 w-4 text-green-500" />
                              </Button>
                              <Button size="icon" variant="ghost" onClick={() => handleCommentAction(comment.id, 'reject')}>
                                <XCircle className="h-4 w-4 text-red-500" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="users">
            <Card>
              <CardHeader>
                <CardTitle>User Management</CardTitle>
                <CardDescription>Manage user roles and permissions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search users..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead className="hidden md:table-cell">Email</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead className="hidden lg:table-cell">Articles</TableHead>
                        <TableHead className="hidden lg:table-cell">Comments</TableHead>
                        <TableHead className="hidden xl:table-cell">Joined</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredUsers.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell className="font-medium">{user.name || 'No name'}</TableCell>
                          <TableCell className="hidden md:table-cell">{user.email}</TableCell>
                          <TableCell>
                            <Select
                              value={user.role}
                              onValueChange={(value) => handleUserRoleChange(user.id, value)}
                            >
                              <SelectTrigger className="w-28">
                                <Badge variant={roleColors[user.role]}>{user.role}</Badge>
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="USER">USER</SelectItem>
                                <SelectItem value="EDITOR">EDITOR</SelectItem>
                                <SelectItem value="ADMIN">ADMIN</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="hidden lg:table-cell">{user._count?.articles || 0}</TableCell>
                          <TableCell className="hidden lg:table-cell">{user._count?.comments || 0}</TableCell>
                          <TableCell className="hidden xl:table-cell">
                            {new Date(user.createdAt).toLocaleDateString('id-ID')}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button size="icon" variant="ghost">
                              <Edit className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reports">
            <Card>
              <CardHeader>
                <CardTitle>Public Reports</CardTitle>
                <CardDescription>User submitted reports on articles.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border p-8 text-center text-muted-foreground">
                  <p>Report management module coming soon.</p>
                  <p className="text-sm mt-2">{reports.length} reports in database.</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="ads">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Ad Slots</CardTitle>
                      <CardDescription>Definisikan ukuran & posisi slot iklan (standar IAB)</CardDescription>
                    </div>
                    <Dialog open={showAdSlotDialog} onOpenChange={setShowAdSlotDialog}>
                      <DialogTrigger asChild>
                        <Button size="sm"><Plus className="h-4 w-4 mr-2" />New Slot</Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>New Ad Slot</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleCreateAdSlot} className="space-y-4">
                          <div className="space-y-2">
                            <Label>Nama Slot</Label>
                            <Input
                              value={adSlotForm.name}
                              onChange={(e) => setAdSlotForm({ ...adSlotForm, name: e.target.value })}
                              placeholder="Header Leaderboard"
                              required
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label>Posisi</Label>
                              <Select value={adSlotForm.position} onValueChange={(v) => setAdSlotForm({ ...adSlotForm, position: v })}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {['HEADER', 'SIDEBAR', 'IN_ARTICLE', 'FOOTER', 'MOBILE_BANNER'].map((p) => (
                                    <SelectItem key={p} value={p}>{p}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label>Device</Label>
                              <Select value={adSlotForm.device} onValueChange={(v) => setAdSlotForm({ ...adSlotForm, device: v })}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {['DESKTOP', 'MOBILE', 'BOTH'].map((d) => (
                                    <SelectItem key={d} value={d}>{d}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label>Width (px)</Label>
                              <Input
                                type="number"
                                value={adSlotForm.width}
                                onChange={(e) => setAdSlotForm({ ...adSlotForm, width: Number(e.target.value) })}
                                required
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Height (px)</Label>
                              <Input
                                type="number"
                                value={adSlotForm.height}
                                onChange={(e) => setAdSlotForm({ ...adSlotForm, height: Number(e.target.value) })}
                                required
                              />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label>Harga per Hari (Rp) - opsional</Label>
                            <Input
                              type="number"
                              placeholder="Kosongkan jika slot ini khusus admin, tidak dijual ke advertiser"
                              value={adSlotForm.pricePerDay}
                              onChange={(e) => setAdSlotForm({ ...adSlotForm, pricePerDay: e.target.value })}
                            />
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Standar IAB: Leaderboard 728x90, Medium Rectangle 300x250, Mobile Banner 320x50.
                          </p>
                          <DialogFooter>
                            <Button type="submit">Save Slot</Button>
                          </DialogFooter>
                        </form>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nama</TableHead>
                        <TableHead>Posisi</TableHead>
                        <TableHead>Device</TableHead>
                        <TableHead>Ukuran</TableHead>
                        <TableHead>Harga/Hari</TableHead>
                        <TableHead>Iklan Aktif</TableHead>
                        <TableHead className="text-right">Aksi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {adSlots.map((s) => (
                        <TableRow key={s.id}>
                          <TableCell className="font-medium">{s.name}</TableCell>
                          <TableCell><Badge variant="secondary">{s.position}</Badge></TableCell>
                          <TableCell>{s.device}</TableCell>
                          <TableCell>{s.width}x{s.height}</TableCell>
                          <TableCell>
                            {s.pricePerDay != null
                              ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(s.pricePerDay)
                              : <span className="text-muted-foreground">Admin only</span>}
                          </TableCell>
                          <TableCell>{s.ads.filter((a) => a.isActive).length}</TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="icon" onClick={() => handleDeleteAdSlot(s.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      {adSlots.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                            {adsLoading ? 'Loading...' : 'Belum ada ad slot. Buat satu dulu sebelum menambah iklan.'}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Ads</CardTitle>
                      <CardDescription>Kelola iklan yang tayang (gambar atau video WebM/MP4)</CardDescription>
                    </div>
                    <Dialog open={showAdDialog} onOpenChange={setShowAdDialog}>
                      <DialogTrigger asChild>
                        <Button size="sm" disabled={adSlots.length === 0}>
                          <Plus className="h-4 w-4 mr-2" />New Ad
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>New Ad</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleCreateAd} className="space-y-4">
                          <div className="space-y-2">
                            <Label>Ad Slot</Label>
                            <Select value={adForm.slotId} onValueChange={(v) => setAdForm({ ...adForm, slotId: v })}>
                              <SelectTrigger><SelectValue placeholder="Pilih slot" /></SelectTrigger>
                              <SelectContent>
                                {adSlots.map((s) => (
                                  <SelectItem key={s.id} value={s.id}>{s.name} ({s.width}x{s.height})</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Nama Advertiser</Label>
                            <Input
                              value={adForm.advertiserName}
                              onChange={(e) => setAdForm({ ...adForm, advertiserName: e.target.value })}
                              required
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Link Tujuan (opsional)</Label>
                            <Input
                              type="url"
                              value={adForm.linkUrl}
                              onChange={(e) => setAdForm({ ...adForm, linkUrl: e.target.value })}
                              placeholder="https://..."
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label>Mulai</Label>
                              <Input
                                type="date"
                                value={adForm.startDate}
                                onChange={(e) => setAdForm({ ...adForm, startDate: e.target.value })}
                                required
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Selesai</Label>
                              <Input
                                type="date"
                                value={adForm.endDate}
                                onChange={(e) => setAdForm({ ...adForm, endDate: e.target.value })}
                                required
                              />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label>File (gambar atau video .webm/.mp4)</Label>
                            <Input
                              type="file"
                              accept="image/*,video/webm,video/mp4"
                              onChange={(e) => setAdFile(e.target.files?.[0] || null)}
                              required
                            />
                          </div>
                          <DialogFooter>
                            <Button type="submit">Save Ad</Button>
                          </DialogFooter>
                        </form>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Advertiser</TableHead>
                        <TableHead>Slot</TableHead>
                        <TableHead>Tipe</TableHead>
                        <TableHead>Periode</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Aksi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ads.map((ad) => (
                        <TableRow key={ad.id}>
                          <TableCell className="font-medium">{ad.advertiserName}</TableCell>
                          <TableCell>{ad.slot?.name}</TableCell>
                          <TableCell>{ad.mediaType}</TableCell>
                          <TableCell className="text-xs">
                            {new Date(ad.startDate).toLocaleDateString('id-ID')} - {new Date(ad.endDate).toLocaleDateString('id-ID')}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={ad.isActive ? 'default' : 'outline'}
                              className="cursor-pointer"
                              onClick={() => handleToggleAdActive(ad.id, ad.isActive)}
                            >
                              {ad.isActive ? 'Active' : 'Paused'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="icon" onClick={() => handleDeleteAd(ad.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      {ads.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                            {adsLoading ? 'Loading...' : 'Belum ada iklan.'}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="advertisers">
            <Card>
              <CardHeader>
                <CardTitle>Advertisers</CardTitle>
                <CardDescription>Tinjau & setujui pendaftaran akun pengiklan self-service</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Perusahaan</TableHead>
                      <TableHead>Kontak</TableHead>
                      <TableHead>Telepon</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {advertisers.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell className="font-medium">{a.companyName}</TableCell>
                        <TableCell className="text-xs">
                          {a.user.name}<br /><span className="text-muted-foreground">{a.user.email}</span>
                        </TableCell>
                        <TableCell>{a.phone}</TableCell>
                        <TableCell>
                          <Badge variant={a.status === 'APPROVED' ? 'default' : a.status === 'REJECTED' ? 'destructive' : 'secondary'}>
                            {a.status}
                          </Badge>
                          {a.status === 'REJECTED' && a.rejectionReason && (
                            <p className="text-xs text-muted-foreground mt-1">{a.rejectionReason}</p>
                          )}
                        </TableCell>
                        <TableCell className="text-right space-x-2">
                          {a.status !== 'APPROVED' && (
                            <Button size="sm" onClick={() => handleApproveAdvertiser(a.id)}>Approve</Button>
                          )}
                          {a.status !== 'REJECTED' && (
                            <Button size="sm" variant="outline" onClick={() => handleRejectAdvertiser(a.id)}>Reject</Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {advertisers.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          {advertisersLoading ? 'Loading...' : 'Belum ada pendaftar advertiser.'}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="invoices">
            <Card>
              <CardHeader>
                <CardTitle>Invoices</CardTitle>
                <CardDescription>Verifikasi bukti transfer bank manual dari advertiser</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>No. Invoice</TableHead>
                      <TableHead>Advertiser</TableHead>
                      <TableHead>Slot</TableHead>
                      <TableHead>Nominal</TableHead>
                      <TableHead>Bukti</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices.map((inv) => (
                      <TableRow key={inv.id}>
                        <TableCell className="font-mono text-xs">{inv.invoiceNumber}</TableCell>
                        <TableCell className="text-xs">
                          {inv.advertiser.companyName}<br /><span className="text-muted-foreground">{inv.advertiser.user.email}</span>
                        </TableCell>
                        <TableCell>{inv.ad?.slot?.name}</TableCell>
                        <TableCell>
                          {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(inv.amount)}
                        </TableCell>
                        <TableCell>
                          {inv.proofUrl ? (
                            <a href={inv.proofUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline text-xs">
                              Lihat
                            </a>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={inv.status === 'PAID' ? 'default' : inv.status === 'REJECTED' ? 'destructive' : 'secondary'}>
                            {inv.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right space-x-2">
                          {inv.status === 'VERIFYING' && (
                            <>
                              <Button size="sm" onClick={() => handleVerifyInvoicePaid(inv.id)}>Verifikasi Lunas</Button>
                              <Button size="sm" variant="outline" onClick={() => handleRejectInvoice(inv.id)}>Tolak</Button>
                            </>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {invoices.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          {invoicesLoading ? 'Loading...' : 'Belum ada invoice.'}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="ai">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5" />
                  AI Command Center
                </CardTitle>
                <CardDescription>
                  Live terminal and control panel for autonomous news generation
                </CardDescription>
              </CardHeader>
              <CardContent>
                <AiControls
                  onSuccess={(msg) => setSuccess(msg)}
                  onError={(msg) => setError(msg)}
                  onRefresh={fetchAllData}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings">
            <div className="grid gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Company & Bank Info (untuk Invoice)</CardTitle>
                  <CardDescription>Data ini dipakai di invoice pengiklan & ditampilkan sebagai info rekening transfer</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Nama Perusahaan</Label>
                      <Input
                        value={companySettings.companyName}
                        onChange={(e) => setCompanySettings({ ...companySettings, companyName: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>NPWP (opsional)</Label>
                      <Input
                        value={companySettings.npwp}
                        onChange={(e) => setCompanySettings({ ...companySettings, npwp: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label>Alamat</Label>
                      <Input
                        value={companySettings.address}
                        onChange={(e) => setCompanySettings({ ...companySettings, address: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Telepon</Label>
                      <Input
                        value={companySettings.phone}
                        onChange={(e) => setCompanySettings({ ...companySettings, phone: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Nama Bank</Label>
                      <Input
                        value={companySettings.bankName}
                        onChange={(e) => setCompanySettings({ ...companySettings, bankName: e.target.value })}
                        placeholder="BCA / Mandiri / BNI ..."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Nomor Rekening</Label>
                      <Input
                        value={companySettings.bankAccountNo}
                        onChange={(e) => setCompanySettings({ ...companySettings, bankAccountNo: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Atas Nama Rekening</Label>
                      <Input
                        value={companySettings.bankAccountName}
                        onChange={(e) => setCompanySettings({ ...companySettings, bankAccountName: e.target.value })}
                      />
                    </div>
                  </div>
                  <Button onClick={handleSaveCompanySettings} disabled={savingCompanySettings}>
                    {savingCompanySettings ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                    Simpan
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Platform Settings</CardTitle>
                  <CardDescription>Configure platform-wide settings</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Site Name</Label>
                      <Input defaultValue="NewsBali Online" />
                    </div>
                    <div className="space-y-2">
                      <Label>Site URL</Label>
                      <Input defaultValue="https://newsbali.online" />
                    </div>
                    <div className="space-y-2">
                      <Label>Admin Email</Label>
                      <Input defaultValue="admin@newsbali.online" />
                    </div>
                    <div className="space-y-2">
                      <Label>Default Language</Label>
                      <Select defaultValue="id">
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="id">Indonesian</SelectItem>
                          <SelectItem value="en">English</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Button>Save Settings</Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Publish Lock Rules</CardTitle>
                  <CardDescription>Requirements for article publication</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span>Featured image required</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span>Image alt text required</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span>Image source required</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span>Minimum 1 evidence document</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-orange-500" />
                      <span>Legal review required for HIGH risk articles</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Risk Level Thresholds</CardTitle>
                  <CardDescription>Legal risk scoring configuration</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-4 rounded-lg border">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-3 h-3 rounded-full bg-green-500" />
                        <span className="font-medium">LOW</span>
                      </div>
                      <p className="text-sm text-muted-foreground">0-30</p>
                    </div>
                    <div className="p-4 rounded-lg border">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-3 h-3 rounded-full bg-yellow-500" />
                        <span className="font-medium">MEDIUM</span>
                      </div>
                      <p className="text-sm text-muted-foreground">31-60</p>
                    </div>
                    <div className="p-4 rounded-lg border">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-3 h-3 rounded-full bg-orange-500" />
                        <span className="font-medium">HIGH</span>
                      </div>
                      <p className="text-sm text-muted-foreground">61-80</p>
                    </div>
                    <div className="p-4 rounded-lg border">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-3 h-3 rounded-full bg-red-500" />
                        <span className="font-medium">CRITICAL</span>
                      </div>
                      <p className="text-sm text-muted-foreground">81-100</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-red-500">Danger Zone</CardTitle>
                  <CardDescription>Irreversible actions</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-4 rounded-lg border border-red-200 bg-red-50">
                    <div>
                      <p className="font-medium">Reset Database</p>
                      <p className="text-sm text-muted-foreground">Delete all articles and reset content</p>
                    </div>
                    <Button variant="destructive">Reset</Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </main>

      <AdminChatWidget onRefresh={fetchAllData} />
      </SidebarInset>
    </SidebarProvider>
  )
}
