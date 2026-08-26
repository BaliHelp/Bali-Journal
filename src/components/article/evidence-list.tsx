'use client'

import { Badge } from '@/components/ui/badge'
import { FileText, Image, Video, Music, ExternalLink, CheckCircle } from 'lucide-react'
import { useLang } from '@/lib/use-lang'

interface Evidence {
  id: string
  fileUrl: string
  type: string
  source: string
  description: string | null
  verified: boolean
}

interface EvidenceListProps {
  evidences: Evidence[]
}

const typeIcons: Record<string, typeof FileText> = {
  document: FileText,
  image: Image,
  video: Video,
  audio: Music,
}

const typeLabels = {
  en: { document: 'Document', image: 'Image', video: 'Video', audio: 'Audio' },
  id: { document: 'Dokumen', image: 'Gambar', video: 'Video', audio: 'Audio' },
} as const

const translations = {
  en: { heading: 'Supporting Evidence', verified: 'Verified', source: 'Source' },
  id: { heading: 'Bukti Pendukung', verified: 'Terverifikasi', source: 'Sumber' },
}

export function EvidenceList({ evidences }: EvidenceListProps) {
  const lang = useLang()
  const t = translations[lang]
  const labels = typeLabels[lang]

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold flex items-center gap-2">
        <FileText className="h-5 w-5" />
        {t.heading} ({evidences.length})
      </h3>
      <div className="grid gap-3">
        {evidences.map((evidence) => {
          const Icon = typeIcons[evidence.type] || FileText
          return (
            <div
              key={evidence.id}
              className="flex items-start gap-3 p-3 rounded-lg border bg-muted/30"
            >
              <div className="p-2 rounded-lg bg-background">
                <Icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">
                    {labels[evidence.type as keyof typeof labels] || evidence.type}
                  </span>
                  {evidence.verified && (
                    <Badge variant="outline" className="text-xs text-green-600 border-green-600">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      {t.verified}
                    </Badge>
                  )}
                </div>
                {evidence.description && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {evidence.description}
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  {t.source}: {evidence.source}
                </p>
              </div>
              <a
                href={evidence.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 hover:bg-background rounded-lg transition-colors"
              >
                <ExternalLink className="h-4 w-4 text-muted-foreground" />
              </a>
            </div>
          )
        })}
      </div>
    </div>
  )
}
