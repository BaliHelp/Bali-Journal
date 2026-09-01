'use client'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Share2, Link2, Facebook, Instagram } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useLang } from '@/lib/use-lang'

interface ShareMenuProps {
  articleId: string
  title: string
  /** Full absolute URL to the article - passed in so this stays a pure/testable component instead of reading window.location itself. */
  url: string
}

const translations = {
  en: {
    share: 'Share',
    copyLink: 'Share Link',
    whatsapp: 'WhatsApp',
    facebook: 'Facebook',
    instagram: 'Instagram',
    linkCopiedTitle: 'Link copied',
    linkCopiedDesc: 'Article link copied to clipboard.',
    copyFailedTitle: 'Failed to copy link',
    igCopiedDesc: 'Link copied - paste it into your Instagram Story or bio (Instagram doesn’t support direct link sharing).',
  },
  id: {
    share: 'Bagikan',
    copyLink: 'Salin Tautan',
    whatsapp: 'WhatsApp',
    facebook: 'Facebook',
    instagram: 'Instagram',
    linkCopiedTitle: 'Tautan disalin',
    linkCopiedDesc: 'Link artikel sudah disalin ke clipboard.',
    copyFailedTitle: 'Gagal menyalin tautan',
    igCopiedDesc: 'Link disalin - tempel di Story atau bio Instagram kamu (Instagram tidak mendukung share link langsung).',
  },
}

/** Real WhatsApp glyph - lucide-react has no brand icon for it, MessageCircle would be ambiguous with the site's other messaging UI. */
function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21h.01c5.46 0 9.91-4.45 9.91-9.91C21.96 6.45 17.5 2 12.04 2Zm5.83 14.17c-.24.68-1.4 1.32-1.93 1.36-.5.05-1.02.25-3.42-.71-2.9-1.16-4.76-4.12-4.9-4.31-.14-.19-1.17-1.56-1.17-2.98s.75-2.11 1.02-2.4c.26-.28.57-.35.76-.35.19 0 .38 0 .55.01.18.01.42-.07.65.5.24.58.81 2 .88 2.14.07.14.12.31.02.5-.09.19-.14.31-.28.48-.14.16-.29.36-.42.49-.14.14-.28.29-.12.57.16.28.71 1.17 1.52 1.9 1.05.94 1.93 1.23 2.21 1.37.28.14.44.12.6-.07.16-.19.68-.79.86-1.06.19-.28.38-.23.63-.14.26.09 1.64.77 1.92.91.28.14.47.21.54.33.07.12.07.68-.17 1.36Z" />
    </svg>
  )
}

/**
 * Multi-platform share menu (top-right of the article header) - distinct
 * from the "Save"-paired Share button lower on the page (which uses the
 * native OS share sheet on mobile, or falls back to a plain copy). This one
 * always opens a menu with explicit per-platform links, per user request.
 *
 * Instagram has no public web share intent for arbitrary URLs (deliberate
 * platform restriction), so that option copies the link with an explanatory
 * toast telling the reader to paste it into a Story or their bio, instead of
 * silently doing nothing or opening a dead link.
 */
export function ShareMenu({ articleId, title, url }: ShareMenuProps) {
  const { toast } = useToast()
  const lang = useLang()
  const t = translations[lang]

  // Fire-and-forget - powers the admin Metrics panel's "Most Shared"
  // indicator. Never blocks the actual share action on this succeeding.
  function trackShare() {
    fetch(`/api/articles/${articleId}/share`, { method: 'POST' }).catch(() => {})
  }

  async function copyLink(onSuccessDesc: string) {
    try {
      await navigator.clipboard.writeText(url)
      toast({ title: t.linkCopiedTitle, description: onSuccessDesc })
      trackShare()
    } catch {
      toast({ title: t.copyFailedTitle, variant: 'destructive' })
    }
  }

  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}`
  const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <Share2 className="h-4 w-4 mr-2" />
          {t.share}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => copyLink(t.linkCopiedDesc)}>
          <Link2 className="h-4 w-4 mr-2" />
          {t.copyLink}
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" onClick={trackShare}>
            <WhatsAppIcon />
            <span className="ml-2">{t.whatsapp}</span>
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href={facebookUrl} target="_blank" rel="noopener noreferrer" onClick={trackShare}>
            <Facebook className="h-4 w-4 mr-2" />
            {t.facebook}
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => copyLink(t.igCopiedDesc)}>
          <Instagram className="h-4 w-4 mr-2" />
          {t.instagram}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
