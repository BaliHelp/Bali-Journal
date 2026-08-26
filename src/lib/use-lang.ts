'use client'

import { useEffect, useState } from 'react'

export type Lang = 'en' | 'id'

function getSavedLang(): Lang {
  if (typeof window === 'undefined') return 'en'
  return (localStorage.getItem('lang') as Lang) || 'en'
}

/**
 * Reads the site-wide language preference set by the Header's toggle.
 * English is the default (matches SSR output, avoids a flash of the wrong
 * language) - the saved preference is only applied after mount, and kept in
 * sync via the same `storage` event Header dispatches on toggle.
 */
export function useLang(): Lang {
  const [lang, setLang] = useState<Lang>('en')

  useEffect(() => {
    setLang(getSavedLang())
    function handleStorageChange(e: StorageEvent) {
      if (e.key === 'lang' && e.newValue) setLang(e.newValue as Lang)
    }
    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [])

  return lang
}
