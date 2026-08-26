'use client'

import { useLang } from '@/lib/use-lang'

/** Formats a date in the reader's chosen language (was hardcoded to id-ID regardless of toggle). */
export function ArticleDate({ date }: { date: Date | string | null | undefined }) {
  const lang = useLang()
  if (!date) return null
  const d = new Date(date)
  return (
    <>
      {d.toLocaleDateString(lang === 'id' ? 'id-ID' : 'en-US', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })}
    </>
  )
}
