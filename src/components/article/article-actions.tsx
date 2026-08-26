'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Share2, Bookmark, BookmarkCheck } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface ArticleActionsProps {
  slug: string
  title: string
  excerpt: string
}

const BOOKMARKS_KEY = 'newsbali_bookmarks'

function readBookmarks(): string[] {
  try {
    const raw = localStorage.getItem(BOOKMARKS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function writeBookmarks(slugs: string[]) {
  try {
    localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(slugs))
  } catch {
    // localStorage unavailable (private mode, etc.) - saved state just won't persist
  }
}

export function ArticleActions({ slug, title, excerpt }: ArticleActionsProps) {
  const { toast } = useToast()
  const [isSaved, setIsSaved] = useState(false)

  useEffect(() => {
    setIsSaved(readBookmarks().includes(slug))
  }, [slug])

  const handleShare = async () => {
    const url = typeof window !== 'undefined' ? window.location.href : ''

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title, text: excerpt, url })
      } catch {
        // user cancelled the native share sheet - not an error
      }
      return
    }

    try {
      await navigator.clipboard.writeText(url)
      toast({ title: 'Tautan disalin', description: 'Link artikel sudah disalin ke clipboard.' })
    } catch {
      toast({ title: 'Gagal menyalin tautan', variant: 'destructive' })
    }
  }

  const handleSave = () => {
    const current = readBookmarks()
    const next = isSaved ? current.filter((s) => s !== slug) : [...current, slug]
    writeBookmarks(next)
    setIsSaved(!isSaved)
    toast({
      title: isSaved ? 'Dihapus dari simpanan' : 'Artikel disimpan',
      description: isSaved ? undefined : 'Bisa dilihat lagi lewat riwayat browser Anda.',
    })
  }

  return (
    <div className="flex flex-wrap gap-2 mb-8">
      <Button variant="outline" size="sm" onClick={handleShare}>
        <Share2 className="h-4 w-4 mr-2" />
        Bagikan
      </Button>
      <Button variant="outline" size="sm" onClick={handleSave}>
        {isSaved ? <BookmarkCheck className="h-4 w-4 mr-2" /> : <Bookmark className="h-4 w-4 mr-2" />}
        {isSaved ? 'Tersimpan' : 'Simpan'}
      </Button>
    </div>
  )
}
