'use client'

import { useLang } from '@/lib/use-lang'

const CATEGORY_LABELS = {
  en: {
    TOURISM: 'Tourism',
    GOVERNMENT: 'Government',
    INVESTMENT: 'Investment',
    INCIDENTS: 'Incidents',
    LOCAL: 'Local',
    JOBS: 'Jobs',
    OPINION: 'Opinion',
  },
  id: {
    TOURISM: 'Pariwisata',
    GOVERNMENT: 'Pemerintahan',
    INVESTMENT: 'Investasi',
    INCIDENTS: 'Insiden',
    LOCAL: 'Lokal',
    JOBS: 'Pekerjaan',
    OPINION: 'Opini',
  },
} as const

export function CategoryLabel({ category }: { category: string }) {
  const lang = useLang()
  return <>{CATEGORY_LABELS[lang][category as keyof typeof CATEGORY_LABELS['en']] ?? category}</>
}
