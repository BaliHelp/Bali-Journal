'use client'

import { useLang } from '@/lib/use-lang'

/** Drop-in bilingual string for use inside Server Components (which can't call useLang() directly). */
export function LangText({ en, id }: { en: string; id: string }) {
  const lang = useLang()
  return <>{lang === 'id' ? id : en}</>
}
