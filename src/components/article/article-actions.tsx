'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Share2, Bookmark, BookmarkCheck } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useLang } from '@/lib/use-lang'

interface ArticleActionsProps {
  slug: string
  title: string
  excerpt: string
}

const BOOKMARKS_KEY = 'newsbali_bookmarks'

const translations = {
  en: {
    share: 'Share',
    save: 'Save',
    saved: 'Saved',
    linkCopiedTitle: 'Link copied',
    linkCopiedDesc: 'Article link copied to clipboard.',
    copyFailedTitle: 'Failed to copy link',
    removedTitle: 'Removed from saved',
    savedTitle: 'Article saved',
    savedDesc: 'You can find it again in your browser history.',
  },
  id: {
    share: 'Bagikan',
    save: 'Simpan',
    saved: 'Tersimpan',
    linkCopiedTitle: 'Tautan disalin',
    linkCopiedDesc: 'Link artikel sudah disalin ke clipboard.',
    copyFailedTitle: 'Gagal menyalin tautan',
    removedTitle: 'Dihapus dari simpanan',
    savedTitle: 'Artikel disimpan',
    savedDesc: 'Bisa dilihat lagi lewat riwayat browser Anda.',
  },
}

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
  const lang = useLang()
  const t = translations[lang]

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
      toast({ title: t.linkCopiedTitle, description: t.linkCopiedDesc })
    } catch {
      toast({ title: t.copyFailedTitle, variant: 'destructive' })
    }
  }

  const handleSave = () => {
    const current = readBookmarks()
    const next = isSaved ? current.filter((s) => s !== slug) : [...current, slug]
    writeBookmarks(next)
    setIsSaved(!isSaved)
    toast({
      title: isSaved ? t.removedTitle : t.savedTitle,
      description: isSaved ? undefined : t.savedDesc,
    })
  }

  return (
    <div className="flex flex-wrap gap-2 mb-8">
      <Button variant="outline" size="sm" onClick={handleShare}>
        <Share2 className="h-4 w-4 mr-2" />
        {t.share}
      </Button>
      <Button variant="outline" size="sm" onClick={handleSave}>
        {isSaved ? <BookmarkCheck className="h-4 w-4 mr-2" /> : <Bookmark className="h-4 w-4 mr-2" />}
        {isSaved ? t.saved : t.save}
      </Button>
    </div>
  )
}
