'use client'

import { useLang } from '@/lib/use-lang'

const RISK_LABELS = {
  en: { LOW: 'Low', MEDIUM: 'Medium', HIGH: 'High', CRITICAL: 'Critical' },
  id: { LOW: 'Rendah', MEDIUM: 'Sedang', HIGH: 'Tinggi', CRITICAL: 'Kritis' },
} as const

export function RiskLabel({ level }: { level: string }) {
  const lang = useLang()
  return <>{RISK_LABELS[lang][level as keyof typeof RISK_LABELS['en']] ?? level}</>
}
